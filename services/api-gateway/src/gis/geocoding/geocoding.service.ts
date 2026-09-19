import { Inject, Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import { REDIS } from '../../redis/redis.module'
import {
  GEOCODING_PROVIDER,
  normalizePlaceName,
  type GeocodeOutcome,
  type GeocodeQuery,
  type GeocodingProvider,
} from './geocoding.types'

/**
 * Caching front door to whichever `GeocodingProvider` is bound.
 *
 * Callers depend on THIS, never on a concrete provider, so swapping Nominatim
 * for govmap or a self-hosted instance touches one DI binding and nothing else.
 *
 * The cache exists for two reasons, in this order:
 *   1. The Nominatim usage policy explicitly requires results to be cached
 *      rather than re-requested. Honouring it is not optional.
 *   2. Geocoding must never happen on a read path. Coordinates are persisted
 *      on the entity; this cache only prevents a repeated *sweep* from
 *      re-asking for addresses it already asked about.
 *
 * Successes and definitive failures are both cached — a "this address does not
 * resolve" answer is just as expensive to obtain and just as stable. Transient
 * faults (`PROVIDER_UNAVAILABLE`, `RATE_LIMITED`) are NOT cached, because
 * caching an outage would turn a five-minute blip into a month of silence.
 */

const CACHE_PREFIX = 'geocode:v1:'
const TTL_HIT_SECONDS = 60 * 60 * 24 * 30 // 30 days
const TTL_MISS_SECONDS = 60 * 60 * 24 * 3 // 3 days — addresses do get added to OSM

interface RedisLike {
  get(key: string): Promise<string | null>
  setex(key: string, ttl: number, value: string): Promise<unknown>
  del(...keys: string[]): Promise<unknown>
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name)

  constructor(
    @Inject(GEOCODING_PROVIDER) private readonly provider: GeocodingProvider,
    @Inject(REDIS) private readonly redis: RedisLike,
  ) {}

  /** Id of the active provider, surfaced to the admin UI. */
  get providerId(): string {
    return this.provider.id
  }

  get attribution(): string {
    return this.provider.attribution
  }

  async geocode(query: GeocodeQuery, options: { skipCache?: boolean } = {}): Promise<GeocodeOutcome> {
    const key = this.#cacheKey(query)

    if (!options.skipCache) {
      const cached = await this.#readCache(key)
      if (cached) return cached
    }

    const outcome = await this.provider.geocode(query)

    const transient =
      outcome.status === 'FAILED' &&
      (outcome.reason === 'PROVIDER_UNAVAILABLE' || outcome.reason === 'RATE_LIMITED')
    if (!transient) {
      await this.#writeCache(key, outcome)
    }

    return outcome
  }

  /** Drops a cached answer so a corrected address can be re-asked immediately. */
  async invalidate(query: GeocodeQuery): Promise<void> {
    try {
      await this.redis.del(this.#cacheKey(query))
    } catch {
      // A cache that cannot be cleared is not a request failure.
    }
  }

  /**
   * Keyed on the provider plus the NORMALISED address, so `הרצל 45` and
   * `הרצל  45 ` share one entry. Hashed to keep Hebrew out of key names and
   * bound the key length.
   */
  #cacheKey(query: GeocodeQuery): string {
    const canonical = `${normalizePlaceName(query.address)}|${normalizePlaceName(query.city)}`
    const digest = createHash('sha256').update(canonical).digest('hex').slice(0, 32)
    return `${CACHE_PREFIX}${this.provider.id}:${digest}`
  }

  async #readCache(key: string): Promise<GeocodeOutcome | null> {
    try {
      const raw = await this.redis.get(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as GeocodeOutcome
      if (parsed?.status === 'MATCHED' || parsed?.status === 'FAILED') return parsed
      return null
    } catch {
      // An unreadable cache entry must never break a geocode.
      return null
    }
  }

  async #writeCache(key: string, outcome: GeocodeOutcome): Promise<void> {
    const ttl = outcome.status === 'MATCHED' ? TTL_HIT_SECONDS : TTL_MISS_SECONDS
    try {
      await this.redis.setex(key, ttl, JSON.stringify(outcome))
    } catch {
      this.logger.warn('Geocode cache write failed — continuing without cache')
    }
  }
}
