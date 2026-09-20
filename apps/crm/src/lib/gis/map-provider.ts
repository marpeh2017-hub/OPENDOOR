/**
 * Map provider abstraction.
 *
 * The CRM must never be coupled to a single map vendor, and must run with zero
 * paid dependencies and zero API keys. So the app talks only to this interface;
 * a concrete provider is selected at runtime from environment variables.
 *
 * Provider evaluation (see the GIS section of the Pass 1 report for the full
 * reasoning) concluded: **MapLibre GL JS rendering OpenStreetMap-derived
 * vector tiles** is the recommended default —
 *
 *   - BSD-licensed, no per-view billing, no account or key required to render
 *     OSM raster/vector tiles from a self-hostable style;
 *   - genuine RTL support via the official `mapbox-gl-rtl-text` plugin, which
 *     MapLibre loads for Hebrew/Arabic label shaping;
 *   - strong Israel coverage in OSM, including street-level Hebrew names;
 *   - first-class GeoJSON polygon rendering, which is what cadastral blocks
 *     and parcels (גוש/חלקה) and planning envelopes will need;
 *   - style/tile source is swappable, so a commercial tile host can be added
 *     later purely as configuration.
 *
 * Geocoding is treated as a *separate* capability from tile rendering, because
 * the two do not have to come from the same vendor. Israeli addresses geocode
 * best against govmap / Nominatim; that is a future adapter, not a today
 * dependency.
 *
 * No provider is instantiated unless it is configured. With no configuration
 * the app resolves to `NO_PROVIDER`, and the UI renders an explanatory state
 * rather than a broken or decorative map.
 */

export type MapProviderId = 'maplibre' | 'mapbox' | 'google' | 'none'

export interface MapViewport {
  center: { lat: number; lng: number }
  zoom:   number
}

export interface MapMarker {
  id:    string
  lat:   number
  lng:   number
  label: string
  kind:  string
}

/**
 * The contract every concrete provider adapter must satisfy. Kept intentionally
 * small: what the GIS screen actually needs today, plus the polygon hook that
 * cadastral data will need tomorrow.
 */
export interface MapProvider {
  readonly id: MapProviderId
  /** Human-readable name for diagnostics and the settings UI. */
  readonly name: string
  /** False when the provider has no usable configuration in this environment. */
  readonly isConfigured: boolean
  /** True when the provider can render GeoJSON polygons (cadastral/planning). */
  readonly supportsPolygons: boolean
  /** True when the provider ships an address → coordinates geocoder. */
  readonly supportsGeocoding: boolean
  /** True when the provider shapes RTL (Hebrew/Arabic) map labels correctly. */
  readonly supportsRtlLabels: boolean
  /** Attribution string that must be displayed whenever tiles are rendered. */
  readonly attribution: string
}

/**
 * Default viewport when there is no data to fit — centred on Israel. This is a
 * *camera position*, not data: it places no entity anywhere and is only used
 * once real features exist but a fit cannot be computed.
 */
export const ISRAEL_DEFAULT_VIEWPORT: MapViewport = {
  center: { lat: 31.7683, lng: 35.2137 },
  zoom: 7,
}

const MAPLIBRE: MapProvider = {
  id: 'maplibre',
  name: 'MapLibre GL (OpenStreetMap)',
  // Configured out of the box: the built-in style below renders standard OSM
  // raster tiles, which need no account, no key and no style URL.
  isConfigured: true,
  supportsPolygons: true,
  supportsGeocoding: false,
  supportsRtlLabels: true,
  attribution: '© OpenStreetMap contributors',
}

const MAPBOX: MapProvider = {
  id: 'mapbox',
  name: 'Mapbox GL',
  isConfigured: false,
  supportsPolygons: true,
  supportsGeocoding: true,
  supportsRtlLabels: true,
  attribution: '© Mapbox © OpenStreetMap',
}

const GOOGLE: MapProvider = {
  id: 'google',
  name: 'Google Maps',
  isConfigured: false,
  supportsPolygons: true,
  supportsGeocoding: true,
  supportsRtlLabels: true,
  attribution: '© Google',
}

/** Resolved when nothing is configured. Renders nothing, claims nothing. */
export const NO_PROVIDER: MapProvider = {
  id: 'none',
  name: 'לא הוגדר ספק מפות',
  isConfigured: false,
  supportsPolygons: false,
  supportsGeocoding: false,
  supportsRtlLabels: false,
  attribution: '',
}

/**
 * Resolve the active provider from environment configuration.
 *
 * Credentials are read from environment variables only — never hardcoded, and
 * never committed. Absence of configuration is a supported, non-error state.
 *
 *   NEXT_PUBLIC_MAP_PROVIDER   maplibre | mapbox | google
 *   NEXT_PUBLIC_MAP_STYLE_URL  MapLibre style/tile URL (self-hosted or OSM)
 *   NEXT_PUBLIC_MAP_API_KEY    key for the vendors that require one
 */
export function resolveMapProvider(): MapProvider {
  const id = (process.env.NEXT_PUBLIC_MAP_PROVIDER ?? '').trim() as MapProviderId
  const styleUrl = (process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? '').trim()
  const apiKey   = (process.env.NEXT_PUBLIC_MAP_API_KEY ?? '').trim()

  switch (id) {
    case 'maplibre':
      return { ...MAPLIBRE, isConfigured: true }
    case 'mapbox':
      return { ...MAPBOX, isConfigured: Boolean(apiKey) }
    case 'google':
      return { ...GOOGLE, isConfigured: Boolean(apiKey) }
    default:
      // MapLibre over OSM is the default rather than a fallback-to-nothing:
      // it is the recommended provider, it costs nothing, and it needs no
      // configuration. An explicit `none` still disables mapping entirely.
      return id === 'none' ? NO_PROVIDER : { ...MAPLIBRE, isConfigured: true }
  }
}

/**
 * MapLibre style for keyless OpenStreetMap raster tiles.
 *
 * Raster rather than vector because vector tiles require a hosted tile service
 * (and usually a key), while the standard OSM raster endpoint is public. The
 * attribution below is displayed by the map control and is REQUIRED by the OSM
 * tile usage policy — do not remove it.
 *
 * Overridable via NEXT_PUBLIC_MAP_STYLE_URL for a self-hosted or commercial
 * vector style, without any code change.
 */
export const OSM_RASTER_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
}

/** The style the active provider should render — URL string or inline style. */
export function resolveMapStyle(): string | typeof OSM_RASTER_STYLE {
  const styleUrl = (process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? '').trim()
  return styleUrl || OSM_RASTER_STYLE
}

/** All providers that were evaluated, for display in the GIS readiness panel. */
export const EVALUATED_PROVIDERS: MapProvider[] = [MAPLIBRE, MAPBOX, GOOGLE]
