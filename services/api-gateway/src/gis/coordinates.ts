/**
 * The stored shape of `Project.coordinates` / `Complex.coordinates` /
 * `Building.coordinates`.
 *
 * The Prisma column is `String?` holding JSON. Provenance is carried INSIDE
 * that JSON rather than in new columns, so recording where a coordinate came
 * from needs no migration and no second source of truth. Readers that only
 * care about position ignore the extra keys.
 *
 * Provenance is not optional metadata — it is the mechanism by which a bad
 * geocode can be found and corrected later. Anything written here must say
 * which provider produced it, when, and how well it matched.
 */

export interface LatLng {
  lat: number
  lng: number
}

export type CoordinateSource = 'GEOCODED' | 'MANUAL'

export interface StoredCoordinates extends LatLng {
  /** How this coordinate came to exist. */
  source?: CoordinateSource
  /** Provider id for a geocode (`nominatim`), or the user id for a manual set. */
  provider?: string
  /** ISO timestamp of when it was resolved. */
  resolvedAt?: string
  /** Provider match precision — see `GeocodeMatchQuality`. */
  matchQuality?: string
  /** Provider confidence 0..1, as reported by the provider. */
  confidence?: number
  /** Provider's canonical rendering of what it matched. */
  displayName?: string
  /** Exact query string that produced the match, for reproducibility. */
  query?: string
  /** Free-text justification supplied by a human on a manual override. */
  note?: string
  /** User id that set or last corrected this manually. */
  setByUserId?: string
}

function isValidLat(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90
}

function isValidLng(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180
}

/**
 * Reads the `coordinates` column into a usable object.
 *
 * Accepts BOTH a JSON string (what the `String?` column actually holds) and an
 * already-parsed object, because Prisma has carried this field as `Json?` in
 * earlier revisions and old rows may exist either way. A value that does not
 * parse, or that carries an out-of-range pair, yields `null` — an unreadable
 * coordinate is treated exactly like a missing one and the entity simply does
 * not appear on the map.
 */
export function parseStoredCoordinates(value: unknown): StoredCoordinates | null {
  if (value === null || value === undefined) return null

  let raw: unknown = value
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      raw = JSON.parse(trimmed)
    } catch {
      return null
    }
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>

  const lat = typeof obj.lat === 'number' ? obj.lat : Number(obj.lat)
  const lng = typeof obj.lng === 'number' ? obj.lng : Number(obj.lng)
  if (!isValidLat(lat) || !isValidLng(lng)) return null

  const out: StoredCoordinates = { lat, lng }
  const copyString = (key: 'provider' | 'resolvedAt' | 'matchQuality' | 'displayName' | 'query' | 'note' | 'setByUserId') => {
    const v = obj[key]
    if (typeof v === 'string' && v) out[key] = v
  }
  copyString('provider')
  copyString('resolvedAt')
  copyString('matchQuality')
  copyString('displayName')
  copyString('query')
  copyString('note')
  copyString('setByUserId')
  if (obj.source === 'GEOCODED' || obj.source === 'MANUAL') out.source = obj.source
  if (typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)) {
    out.confidence = obj.confidence
  }
  return out
}

/**
 * Plain-object form for the `Json?` column.
 *
 * Round-tripped through JSON so the value handed to Prisma is guaranteed to be
 * a plain, serialisable structure with no `undefined` keys — Prisma rejects
 * `undefined` inside a Json payload.
 */
export function toJsonValue(value: StoredCoordinates): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

/** Strips provenance down to the bare pair, for the map wire format. */
export function toLatLng(value: StoredCoordinates): LatLng {
  return { lat: value.lat, lng: value.lng }
}

/** Validation shared by the manual-override DTO and the service. */
export function isValidLatLng(lat: number, lng: number): boolean {
  return isValidLat(lat) && isValidLng(lng)
}
