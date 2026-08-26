/**
 * Geocoding provider contract.
 *
 * Geocoding is deliberately modelled as its own capability, separate from tile
 * rendering (`apps/crm/src/lib/gis/map-provider.ts` covers the latter). The
 * only thing the rest of the system may depend on is this interface, so the
 * concrete provider — Nominatim today, govmap or a self-hosted Nominatim
 * tomorrow — can be swapped by changing one DI binding.
 *
 * The contract is intentionally *pessimistic*: `geocode()` never throws for a
 * business outcome and never returns a "best effort" coordinate. It returns
 * either a verified match or a typed failure. A caller can therefore only
 * persist something a provider actually vouched for.
 */

/** Injection token for the active provider. */
export const GEOCODING_PROVIDER = 'GEOCODING_PROVIDER'

/**
 * How precisely the provider resolved the request.
 *
 * This is provenance, not decoration: a `LOCALITY` match is a city centroid and
 * placing a specific building on it would be inventing a location. Callers
 * enforce a minimum quality (see `MIN_ACCEPTABLE_QUALITY`).
 */
export type GeocodeMatchQuality =
  /** Down to the house number — the only quality good enough for a building. */
  | 'HOUSE_NUMBER'
  /** The right street, but not the specific number. */
  | 'STREET'
  /** City/town centroid. Never precise enough for an entity. */
  | 'LOCALITY'
  /** Region, district or coarser. */
  | 'AREA'

const QUALITY_ORDER: GeocodeMatchQuality[] = ['AREA', 'LOCALITY', 'STREET', 'HOUSE_NUMBER']

export function qualityRank(q: GeocodeMatchQuality): number {
  return QUALITY_ORDER.indexOf(q)
}

/**
 * The weakest match that may be written to an entity.
 *
 * STREET, not LOCALITY. A city centroid would put every project in a city on
 * the exact same pixel and imply a precision that does not exist.
 */
export const MIN_ACCEPTABLE_QUALITY: GeocodeMatchQuality = 'STREET'

export type GeocodeFailureReason =
  /** The entity has no address to geocode. */
  | 'NO_ADDRESS'
  /** The provider returned nothing at all. */
  | 'NO_MATCH'
  /** The provider answered, but for a different city than the one requested. */
  | 'CITY_MISMATCH'
  /** The provider answered, but only at locality/area precision. */
  | 'TOO_COARSE'
  /** Several plausible, geographically distant candidates — genuinely unclear. */
  | 'AMBIGUOUS'
  /** Network failure, timeout, or 5xx after retries. */
  | 'PROVIDER_UNAVAILABLE'
  /** The provider asked us to slow down (429 / usage policy block). */
  | 'RATE_LIMITED'

export interface GeocodeQuery {
  /** Street address as stored on the entity, e.g. `הרצל 45`. */
  address: string
  /** City as stored on the entity. Used both to constrain and to VERIFY. */
  city?: string | null
}

export interface GeocodeHit {
  lat: number
  lng: number
  matchQuality: GeocodeMatchQuality
  /**
   * 0..1. Derived from the provider's own ranking, not invented. Present so a
   * suspicious result can be found later — it is provenance, not a score the
   * product reasons about.
   */
  confidence: number
  /** The provider's canonical rendering of what it matched. */
  displayName: string
  /** Provider id that produced this, recorded on the entity. */
  provider: string
  /** The exact query string that produced it, for reproducibility. */
  query: string
}

export type GeocodeOutcome =
  | { status: 'MATCHED'; hit: GeocodeHit }
  | { status: 'FAILED'; reason: GeocodeFailureReason; detail?: string }

export interface GeocodingProvider {
  /** Stable id persisted as provenance, e.g. `nominatim`. */
  readonly id: string
  /** Attribution text that must be shown wherever results are displayed. */
  readonly attribution: string
  /**
   * Resolve an address. Returns a typed outcome; never throws for a business
   * result, never guesses.
   */
  geocode(query: GeocodeQuery): Promise<GeocodeOutcome>
}

/**
 * Normalises a place name for comparison.
 *
 * Hebrew city names arrive in several renderings — `תל אביב`, `תל־אביב–יפו`,
 * `תל אביב-יפו` — that differ only in maqaf/dash/space/quote characters. This
 * strips those so a verification comparison is about the NAME, not typography.
 */
export function normalizePlaceName(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFKC')
    .replace(/[\s־‐-―\-'"׳״.,()]/g, '')
    .toLowerCase()
}

/**
 * True when a provider's returned city is consistent with the requested one.
 *
 * Containment in either direction, because a provider legitimately returns a
 * longer official name (`תל־אביב–יפו`) for a shorter stored one (`תל אביב`).
 */
export function citiesAgree(requested: string | null | undefined, returned: string | null | undefined): boolean {
  const a = normalizePlaceName(requested)
  const b = normalizePlaceName(returned)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

/** Great-circle distance in kilometres — used to judge candidate ambiguity. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
