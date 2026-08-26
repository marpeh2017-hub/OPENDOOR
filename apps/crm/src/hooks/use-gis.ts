import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/** Mirrors GisController — /api/v1/gis/*. */

export type GisFeatureKind = 'PROJECT' | 'COMPLEX' | 'BUILDING'

export interface LatLng {
  lat: number
  lng: number
}

/**
 * `metrics` is reserved scaffolding for future per-feature map overlays
 * (health score, signature %, data-quality score, next best action). The API
 * returns `{}` today — every field must be treated as optional.
 */
/**
 * Where a coordinate came from. Rendered next to every marker so a wrong point
 * on the map can be traced back to the provider and run that produced it, and
 * so a hand-corrected location is visibly distinct from a provider guess.
 */
export interface GisFeatureProvenance {
  source:       'GEOCODED' | 'MANUAL' | 'UNKNOWN'
  provider:     string | null
  resolvedAt:   string | null
  matchQuality: string | null
  confidence:   number | null
}

export interface GisFeature {
  id:           string
  kind:         GisFeatureKind
  name:         string
  address:      string | null
  city:         string | null
  coordinates:  LatLng
  provenance:   GisFeatureProvenance
  projectId:    string
  projectName:  string
  projectCode:  string
  stage:        string | null
  status:       string | null
  metrics: {
    healthScore?:      number
    signaturePercent?: number
    dataQualityScore?: number
    nextBestAction?:   { code: string; label: string }
  }
}

export interface GisCoverage {
  total:           number
  withCoordinates: number
  geocodable:      number
}

export interface GisOverview {
  features: GisFeature[]
  coverage: {
    projects:  GisCoverage
    complexes: GisCoverage
    buildings: GisCoverage
  }
  hasAnyGeoData: boolean
  cities:        string[]
}

export interface GisFilters {
  projectId?: string
  city?:      string
  search?:    string
}

export type GeoEntityKind = GisFeatureKind

export interface GeocodeCandidate {
  kind:      GeoEntityKind
  id:        string
  name:      string
  address:   string
  city:      string | null
  projectId: string
}

export interface GeocodeEntityResult {
  kind:         GeoEntityKind
  id:           string
  name:         string
  address:      string
  city:         string | null
  status:       'MATCHED' | 'FAILED'
  coordinates?: LatLng
  matchQuality?: string
  confidence?:  number
  displayName?: string
  reason?:      string
  detail?:      string
}

export interface GeocodeRunSummary {
  provider:         string
  attribution:      string
  pending:          number
  attempted:        number
  matched:          number
  failed:           number
  failuresByReason: Record<string, number>
  stoppedEarly:     boolean
  results:          GeocodeEntityResult[]
}

export const gisKeys = {
  all:      ()               => ['gis'] as const,
  overview: (f: GisFilters)  => [...gisKeys.all(), 'overview', f] as const,
  pending:  (projectId?: string) => [...gisKeys.all(), 'geocode-pending', projectId ?? null] as const,
}

export function useGisOverview(filters: GisFilters = {}) {
  const q = new URLSearchParams()
  if (filters.projectId) q.set('projectId', filters.projectId)
  if (filters.city)      q.set('city',      filters.city)
  if (filters.search)    q.set('search',    filters.search)

  return useQuery({
    queryKey: gisKeys.overview(filters),
    queryFn:  () => api.get<GisOverview>(`/gis/overview?${q.toString()}`),
    staleTime: 60_000,
  })
}


/**
 * Entities that have an address but no coordinates — the sweep's work queue.
 *
 * `staleTime: 0` because a sweep or a manual override changes this set, and a
 * stale queue would show work that is already done.
 */
export function useGeocodePending(projectId?: string, enabled = true) {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
  return useQuery({
    queryKey: gisKeys.pending(projectId),
    queryFn:  () => api.get<{ total: number; candidates: GeocodeCandidate[] }>(`/gis/geocode/pending${q}`),
    enabled,
    staleTime: 0,
  })
}

export interface RunGeocodeInput {
  kinds?:     GeoEntityKind[]
  projectId?: string
  limit?:     number
}

/**
 * Admin-triggered geocode sweep.
 *
 * Explicitly a user action with no automatic retry: the provider is capped at
 * 1 request/second, so a run of N entities takes at least N seconds and an
 * automatic retry would quietly double the load on a donated public service.
 */
export function useRunGeocode() {
  const qc = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: (input: RunGeocodeInput) =>
      api.post<GeocodeRunSummary>('/gis/geocode/run', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gisKeys.all() })
    },
  })
}

/** Manual coordinate override — the correction path for a bad provider result. */
export function useSetCoordinates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { kind: GeoEntityKind; id: string; lat: number; lng: number; note?: string }) =>
      api.put(`/gis/coordinates/${input.kind}/${input.id}`, {
        lat: input.lat, lng: input.lng, ...(input.note ? { note: input.note } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gisKeys.all() })
    },
  })
}

/** Clears a coordinate; the entity goes back to being honestly unplaced. */
export function useClearCoordinates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { kind: GeoEntityKind; id: string }) =>
      api.delete(`/gis/coordinates/${input.kind}/${input.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gisKeys.all() })
    },
  })
}
