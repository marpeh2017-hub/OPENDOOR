import { Injectable, Logger } from '@nestjs/common'
import {
  citiesAgree,
  distanceKm,
  qualityRank,
  MIN_ACCEPTABLE_QUALITY,
  type GeocodeHit,
  type GeocodeMatchQuality,
  type GeocodeOutcome,
  type GeocodeQuery,
  type GeocodingProvider,
} from './geocoding.types'

/**
 * Nominatim (OpenStreetMap) geocoding provider.
 *
 * ---------------------------------------------------------------------------
 * USAGE POLICY COMPLIANCE (https://operations.osmfoundation.org/policies/nominatim/)
 * ---------------------------------------------------------------------------
 * The public instance is a donated, shared resource. This class enforces every
 * requirement in code rather than trusting callers to behave:
 *
 *   - **Max 1 request/second, absolutely.** Every outbound call goes through
 *     `#gate`, a single promise chain that will not release the next request
 *     until `MIN_INTERVAL_MS` has elapsed since the previous one STARTED.
 *     Concurrency is therefore 1 by construction — there is no code path that
 *     can issue two requests in parallel.
 *   - **A descriptive User-Agent identifying this application is mandatory.**
 *     A generic agent gets blocked. It is built from configuration and always
 *     names the app and a contact.
 *   - **No bulk geocoding.** The caller-facing sweep is admin-triggered and
 *     batch-capped; there is no background sweep.
 *   - **Cache, don't re-request.** Caching lives one layer up in
 *     `GeocodingService` so it applies to any provider.
 *
 * ---------------------------------------------------------------------------
 * KNOWN LIMITATION — HEBREW ADDRESSES
 * ---------------------------------------------------------------------------
 * Measured against the public instance: the Israeli portion of the Nominatim
 * search index carries no Hebrew street-name tokens. A bounded search for
 * `הרצל` inside the Tel Aviv bounding box returns nothing, while `Herzl`
 * returns the exact house number. Unbounded Hebrew queries are worse than
 * empty — they match on the house NUMBER alone and return a confident-looking
 * result in an entirely different city.
 *
 * That is precisely why `#verify()` below exists and why it is strict. This
 * provider would rather return `CITY_MISMATCH` a hundred times than write one
 * plausible wrong coordinate onto a real project. No transliteration is
 * attempted: inventing a Latin spelling for a Hebrew street name is guessing,
 * and a guess that happens to resolve is the most dangerous outcome of all.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'

/** 1 req/s is the hard policy ceiling; 1100ms leaves margin for clock skew. */
const MIN_INTERVAL_MS = 1_100

/** Retries only for transport/5xx faults, never for a "not found". */
const MAX_ATTEMPTS = 3
const BACKOFF_MS = [1_000, 3_000]

const REQUEST_TIMEOUT_MS = 10_000

/**
 * Two candidates further apart than this, both otherwise acceptable, mean the
 * address is genuinely ambiguous and we decline to choose.
 */
const AMBIGUITY_RADIUS_KM = 1

/** Rough bounding box of Israel, used to reject obviously-off results. */
const IL_BOUNDS = { minLat: 29.4, maxLat: 33.4, minLng: 34.2, maxLng: 35.9 }

interface NominatimResult {
  lat: string
  lon: string
  display_name?: string
  place_rank?: number
  addresstype?: string
  importance?: number
  address?: Record<string, string>
}

/**
 * Maps Nominatim's `place_rank` onto our provenance vocabulary.
 * Ranks follow Nominatim's documented scale: 30 = house/POI level,
 * 26-27 = street, 16-19 = locality/suburb, lower = administrative area.
 */
function qualityFromResult(r: NominatimResult): GeocodeMatchQuality {
  const hasHouseNumber = Boolean(r.address?.house_number)
  const rank = r.place_rank ?? 0
  if (hasHouseNumber && rank >= 28) return 'HOUSE_NUMBER'
  if (rank >= 26) return 'STREET'
  if (rank >= 16) return 'LOCALITY'
  return 'AREA'
}

/** Nominatim's `importance` is already 0..1-ish; clamp rather than rescale. */
function confidenceFromResult(r: NominatimResult): number {
  const imp = typeof r.importance === 'number' ? r.importance : 0
  return Math.max(0, Math.min(1, Number(imp.toFixed(4))))
}

function cityOf(r: NominatimResult): string | null {
  const a = r.address ?? {}
  return a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null
}

@Injectable()
export class NominatimGeocodingProvider implements GeocodingProvider {
  readonly id = 'nominatim'
  readonly attribution = '© OpenStreetMap contributors (Nominatim)'

  private readonly logger = new Logger(NominatimGeocodingProvider.name)

  /**
   * Serialising gate. Each call chains onto the previous one and then waits out
   * the remainder of the minimum interval. This is the single mechanism that
   * guarantees the 1 req/s ceiling — do not add a second request path.
   */
  #gate: Promise<void> = Promise.resolve()
  #lastRequestStartedAt = 0

  private get userAgent(): string {
    // A descriptive agent is REQUIRED by the usage policy. Configurable so a
    // deployment can name its own contact, but never generic.
    const configured = process.env.NOMINATIM_USER_AGENT?.trim()
    if (configured) return configured
    const contact = process.env.NOMINATIM_CONTACT_EMAIL?.trim() ?? 'ops@opendoor.co.il'
    return `UrbanRenewalOS/1.0 (OpenDoor urban-renewal CRM; ${contact})`
  }

  private get baseUrl(): string {
    // Points at a self-hosted Nominatim when one exists — the fix for the
    // Hebrew-indexing limitation documented above.
    return process.env.NOMINATIM_BASE_URL?.trim() || NOMINATIM_BASE
  }

  async geocode(query: GeocodeQuery): Promise<GeocodeOutcome> {
    const address = query.address?.trim()
    if (!address) return { status: 'FAILED', reason: 'NO_ADDRESS' }

    const city = query.city?.trim() || null
    const q = city ? `${address}, ${city}, ישראל` : `${address}, ישראל`

    let results: NominatimResult[]
    try {
      results = await this.#fetchWithRetry(q)
    } catch (err) {
      const reason = (err as Error).message === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE'
      // Degrade gracefully: the caller writes nothing and reports the gap.
      this.logger.warn(`Nominatim unavailable (${reason}) — no coordinates written`)
      return { status: 'FAILED', reason, detail: (err as Error).message }
    }

    return this.#verify(results, q, city)
  }

  /**
   * Turns raw provider output into a verified match or a typed refusal.
   *
   * The order matters: geographic sanity, then city agreement, then precision,
   * then ambiguity. Each rejection is specific so the admin UI can say WHY an
   * entity is still unplaced instead of just "failed".
   */
  #verify(results: NominatimResult[], query: string, city: string | null): GeocodeOutcome {
    if (!results.length) return { status: 'FAILED', reason: 'NO_MATCH' }

    const parsed = results
      .map((r) => ({ r, lat: Number(r.lat), lng: Number(r.lon) }))
      .filter(
        (c) =>
          Number.isFinite(c.lat) &&
          Number.isFinite(c.lng) &&
          c.lat >= IL_BOUNDS.minLat &&
          c.lat <= IL_BOUNDS.maxLat &&
          c.lng >= IL_BOUNDS.minLng &&
          c.lng <= IL_BOUNDS.maxLng,
      )

    if (!parsed.length) return { status: 'FAILED', reason: 'NO_MATCH' }

    // City verification. Without a stored city there is nothing to verify
    // against, and an unverifiable match is not one we will persist.
    if (!city) {
      return { status: 'FAILED', reason: 'AMBIGUOUS', detail: 'no city on the entity to verify against' }
    }

    const sameCity = parsed.filter((c) => citiesAgree(city, cityOf(c.r)))
    if (!sameCity.length) {
      const got = parsed.map((c) => cityOf(c.r)).filter(Boolean).join(', ')
      return {
        status: 'FAILED',
        reason: 'CITY_MISMATCH',
        detail: `requested ${city}; provider returned ${got || 'no city'}`,
      }
    }

    const precise = sameCity.filter(
      (c) => qualityRank(qualityFromResult(c.r)) >= qualityRank(MIN_ACCEPTABLE_QUALITY),
    )
    if (!precise.length) {
      return {
        status: 'FAILED',
        reason: 'TOO_COARSE',
        detail: `best match was ${qualityFromResult(sameCity[0].r)}`,
      }
    }

    // Rank by precision first, then by the provider's own importance.
    precise.sort((a, b) => {
      const dq = qualityRank(qualityFromResult(b.r)) - qualityRank(qualityFromResult(a.r))
      if (dq !== 0) return dq
      return confidenceFromResult(b.r) - confidenceFromResult(a.r)
    })

    const best = precise[0]
    const runnerUp = precise[1]
    if (
      runnerUp &&
      qualityFromResult(runnerUp.r) === qualityFromResult(best.r) &&
      distanceKm(best, runnerUp) > AMBIGUITY_RADIUS_KM
    ) {
      return {
        status: 'FAILED',
        reason: 'AMBIGUOUS',
        detail: `${precise.length} equally-precise candidates over ${AMBIGUITY_RADIUS_KM}km apart`,
      }
    }

    const hit: GeocodeHit = {
      lat: best.lat,
      lng: best.lng,
      matchQuality: qualityFromResult(best.r),
      confidence: confidenceFromResult(best.r),
      displayName: best.r.display_name ?? '',
      provider: this.id,
      query,
    }
    return { status: 'MATCHED', hit }
  }

  /** Rate-limited, retrying, timeout-bounded transport. */
  async #fetchWithRetry(q: string): Promise<NominatimResult[]> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1] ?? 3_000)

      const res = await this.#rateLimited(() => this.#request(q))

      if (res.ok) {
        const body = (await res.json()) as NominatimResult[]
        return Array.isArray(body) ? body : []
      }

      // 429 / 403 are the usage-policy signals. Do NOT hammer them.
      if (res.status === 429 || res.status === 403) {
        throw new Error('RATE_LIMITED')
      }
      if (res.status >= 500) {
        lastError = new Error(`provider returned ${res.status}`)
        continue
      }
      // 4xx other than the above is our bug, not a transient fault.
      throw new Error(`provider returned ${res.status}`)
    }

    throw lastError ?? new Error('provider unreachable')
  }

  async #request(q: string): Promise<Response> {
    const url = new URL(this.baseUrl)
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '5')
    // Constrain to Israel at source; without it Hebrew queries have been
    // observed matching places in France and Turkey.
    url.searchParams.set('countrycodes', 'il')
    url.searchParams.set('accept-language', 'he')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      return await fetch(url, {
        headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
        signal: controller.signal,
      })
    } catch (err) {
      throw new Error(`network error: ${(err as Error).name}`)
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Enqueues `fn` behind every earlier call and holds it until at least
   * `MIN_INTERVAL_MS` has passed since the last request began.
   */
  #rateLimited<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.#gate.then(async () => {
      const wait = MIN_INTERVAL_MS - (Date.now() - this.#lastRequestStartedAt)
      if (wait > 0) await sleep(wait)
      this.#lastRequestStartedAt = Date.now()
      return fn()
    })
    // The gate must advance even when a call rejects, or the queue deadlocks.
    this.#gate = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
