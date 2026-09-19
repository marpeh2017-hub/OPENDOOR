'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Search, Layers, Info, Building2, FolderKanban, Boxes, Crosshair } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { QueryError, RowsSkeleton } from '@/components/ui/query-states'
import { useGisOverview, type GisCoverage, type GisFeature } from '@/hooks/use-gis'
import { useProjects } from '@/hooks/use-projects'
import { resolveMapProvider, EVALUATED_PROVIDERS, type MapMarker } from '@/lib/gis/map-provider'
import { MapCanvas } from './map-canvas'
import { GeocodePanel } from './geocode-panel'
import { cn } from '@/lib/utils'

const ALL = '__all__'

const KIND_CFG: Record<string, { label: string; icon: typeof MapPin }> = {
  PROJECT:  { label: 'פרויקט', icon: FolderKanban },
  COMPLEX:  { label: 'מתחם',   icon: Boxes },
  BUILDING: { label: 'מבנה',   icon: Building2 },
}

function CoverageCard({
  title,
  coverage,
}: {
  title: string
  coverage: GisCoverage
}) {
  const pct = coverage.total === 0
    ? 0
    : Math.round((coverage.withCoordinates / coverage.total) * 100)

  return (
    <div className="card-surface p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">
        {coverage.withCoordinates}
        <span className="text-sm font-normal text-muted-foreground"> / {coverage.total}</span>
      </p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-teal-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {pct}% עם קואורדינטות
        {coverage.geocodable > 0 && ` · ${coverage.geocodable} עם כתובת בלבד`}
      </p>
    </div>
  )
}

/**
 * Explains why no map is drawn, in terms of what is actually missing.
 *
 * Deliberately does NOT render a decorative or placeholder map: there are no
 * coordinates in the database, and inventing positions for real projects would
 * be worse than showing nothing.
 */
function NoGeoDataState({
  geocodable,
  providerConfigured,
  providerName,
}: {
  geocodable: number
  providerConfigured: boolean
  providerName: string
}) {
  return (
    <div className="card-surface p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
        <MapPin className="text-teal-500" size={26} />
      </div>
      <h2 className="mt-4 text-lg font-bold text-foreground">אין עדיין נתונים גיאוגרפיים</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        שכבת המפה מוכנה, אך אף פרויקט, מתחם או מבנה אינו כולל קואורדינטות
        ({'{ lat, lng }'}). כדי להימנע מהצגת מידע שגוי, המערכת אינה ממקמת ישויות
        על המפה ללא נתוני מיקום אמיתיים.
      </p>

      <div className="mx-auto mt-6 max-w-xl space-y-2 text-right">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          מה נדרש כדי להפעיל את המפה
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-teal-500">1.</span>
            <span>
              מילוי קואורדינטות לישויות. כרגע {geocodable} ישויות כוללות כתובת ללא
              קואורדינטות — ניתן להפיק מהן מיקום באמצעות גיאוקודינג של הכתובת הקיימת.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-teal-500">2.</span>
            <span>
              הגדרת ספק מפות דרך משתני סביבה
              (<code className="text-xs">NEXT_PUBLIC_MAP_PROVIDER</code>,{' '}
              <code className="text-xs">NEXT_PUBLIC_MAP_STYLE_URL</code>).
              מצב נוכחי: {providerConfigured ? `${providerName} — מוגדר` : `${providerName}`}.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-teal-500">3.</span>
            <span>
              בהמשך: שכבות גוש/חלקה ותוכניות בנייה, שיתווספו כשכבות פוליגון נפרדות.
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}

/**
 * Where a marker's position came from.
 *
 * Shown on every row because a coordinate produced by an automated geocoder and
 * one a person verified by hand are not equally trustworthy, and the difference
 * has to be visible at a glance rather than buried in an audit log.
 */
function ProvenanceBadge({ f }: { f: GisFeature }) {
  const p = f.provenance
  const label =
    p.source === 'MANUAL' ? 'מיקום ידני'
    : p.source === 'GEOCODED' ? `גיאוקודינג${p.matchQuality === 'HOUSE_NUMBER' ? ' · מספר בית' : p.matchQuality === 'STREET' ? ' · רחוב' : ''}`
    : 'מקור לא ידוע'
  const tone =
    p.source === 'MANUAL' ? 'border-teal-200 bg-teal-50 text-teal-700'
    : p.source === 'GEOCODED' ? 'border-blue-200 bg-blue-50 text-blue-700'
    : 'border-gray-200 bg-gray-100 text-gray-600'

  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] leading-4', tone)}>
      {label}
    </span>
  )
}

/**
 * Result list — the same filtered feature set as the map, in text.
 *
 * Kept alongside the map rather than replaced by it: it is searchable, it is
 * readable by a screen reader, and it is what remains usable if the tile layer
 * fails to load.
 */
function FeatureList({
  features,
  selectedId,
  onSelect,
}: {
  features: GisFeature[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="card-surface divide-y divide-border">
      {features.map((f) => {
        const cfg = KIND_CFG[f.kind] ?? { label: f.kind, icon: MapPin }
        const Icon = cfg.icon
        return (
          <div
            key={`${f.kind}-${f.id}`}
            className={cn(
              'flex items-center gap-3 px-4 py-3 transition-colors',
              selectedId === f.id ? 'bg-teal-50/70' : 'hover:bg-muted/40',
            )}
          >
            <Icon size={18} className="flex-shrink-0 text-teal-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{f.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {cfg.label} · {f.projectName} ({f.projectCode})
                {f.address ? ` · ${f.address}` : ''}
              </p>
            </div>
            <ProvenanceBadge f={f} />
            <span className="hidden flex-shrink-0 font-mono text-xs text-muted-foreground sm:inline">
              {f.coordinates.lat.toFixed(5)}, {f.coordinates.lng.toFixed(5)}
            </span>
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-teal-600"
              aria-label={`הצג את ${f.name} על המפה`}
              title="הצג על המפה"
            >
              <Crosshair size={15} />
            </button>
            <Link
              href={`/projects/${f.projectId}`}
              className="flex-shrink-0 text-xs font-medium text-teal-600 hover:underline"
            >
              לפרויקט
            </Link>
          </div>
        )
      })}
    </div>
  )
}

export function GisMapPanel() {
  const router = useRouter()
  const [search, setSearch]       = useState('')
  const [projectId, setProjectId] = useState<string>(ALL)
  const [city, setCity]           = useState<string>(ALL)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const provider = useMemo(() => resolveMapProvider(), [])

  const projectsQuery = useProjects({ limit: 100 })
  const { data, isLoading, isError, error, refetch } = useGisOverview({
    search:    search.trim() || undefined,
    projectId: projectId === ALL ? undefined : projectId,
    city:      city === ALL ? undefined : city,
  })

  const projectOptions = projectsQuery.data?.data ?? []

  if (isLoading) {
    return (
      <div className="card-surface">
        <RowsSkeleton rows={6} />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <QueryError
        message="שגיאה בטעינת נתוני המפה"
        error={error}
        onRetry={() => refetch()}
      />
    )
  }

  const totalGeocodable =
    data.coverage.projects.geocodable +
    data.coverage.complexes.geocodable +
    data.coverage.buildings.geocodable

  // The panel speaks only in generic markers — MapCanvas is the sole module
  // that knows which rendering library is in use.
  const markers: MapMarker[] = data.features.map((f) => ({
    id:    f.id,
    lat:   f.coordinates.lat,
    lng:   f.coordinates.lng,
    label: f.name,
    kind:  f.kind,
  }))

  return (
    <div className="space-y-6">
      {/* Coverage */}
      <div className="grid gap-4 sm:grid-cols-3">
        <CoverageCard title="פרויקטים" coverage={data.coverage.projects} />
        <CoverageCard title="מתחמים"   coverage={data.coverage.complexes} />
        <CoverageCard title="מבנים"    coverage={data.coverage.buildings} />
      </div>

      {/* Filters — in place now so the map is searchable the moment data exists */}
      <div className="card-surface flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או כתובת"
            className="pr-9"
            aria-label="חיפוש במפה"
          />
        </div>

        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-[200px]" aria-label="סינון לפי פרויקט">
            <SelectValue placeholder="כל הפרויקטים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>כל הפרויקטים</SelectItem>
            {projectOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="w-[160px]" aria-label="סינון לפי עיר">
            <SelectValue placeholder="כל הערים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>כל הערים</SelectItem>
            {data.cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Map surface, or an honest explanation of its absence */}
      {data.hasAnyGeoData ? (
        <div className="space-y-4">
          {provider.isConfigured ? (
            <MapCanvas
              markers={markers}
              selectedId={selectedId}
              // Clicking a marker goes to the project it belongs to — the map
              // is a way into the portfolio, not a terminus.
              onMarkerClick={(m) => {
                const feature = data.features.find((f) => f.id === m.id)
                if (feature) router.push(`/projects/${feature.projectId}`)
              }}
            />
          ) : (
            <div className="card-surface p-6 text-center text-sm text-muted-foreground">
              ספק המפות אינו מוגדר ({provider.name}). הישויות שלהלן כוללות
              קואורדינטות אמיתיות וניתן לצפות בהן כרשימה.
            </div>
          )}
          <FeatureList
            features={data.features}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      ) : (
        <NoGeoDataState
          geocodable={totalGeocodable}
          providerConfigured={provider.isConfigured}
          providerName={provider.name}
        />
      )}

      {/* Geocoding — the admin path from an address to a real coordinate */}
      <GeocodePanel projectId={projectId === ALL ? undefined : projectId} />

      {/* Provider readiness */}
      <div className="card-surface p-4">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-teal-500" />
          <p className="text-sm font-semibold text-foreground">ספק המפות</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          המערכת אינה קשורה לספק מפות יחיד. הספק נבחר דרך משתני סביבה בלבד, ללא
          מפתחות בקוד. ברירת המחדל המומלצת: MapLibre GL מעל OpenStreetMap — קוד
          פתוח, ללא עלות לצפייה, תמיכה בעברית ובכיווניות RTL, וכיסוי טוב בישראל.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="pb-2 text-right font-semibold">ספק</th>
                <th className="pb-2 text-right font-semibold">פוליגונים</th>
                <th className="pb-2 text-right font-semibold">גיאוקודינג</th>
                <th className="pb-2 text-right font-semibold">תוויות RTL</th>
                <th className="pb-2 text-right font-semibold">סטטוס</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {EVALUATED_PROVIDERS.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 font-medium text-foreground">{p.name}</td>
                  <td className="py-2 text-muted-foreground">{p.supportsPolygons ? 'כן' : 'לא'}</td>
                  <td className="py-2 text-muted-foreground">{p.supportsGeocoding ? 'כן' : 'לא'}</td>
                  <td className="py-2 text-muted-foreground">{p.supportsRtlLabels ? 'כן' : 'לא'}</td>
                  <td className="py-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs',
                        provider.id === p.id && provider.isConfigured
                          ? 'border-green-200 bg-green-100 text-green-700'
                          : 'border-gray-200 bg-gray-100 text-gray-500',
                      )}
                    >
                      {provider.id === p.id && provider.isConfigured ? 'פעיל' : 'לא מוגדר'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          שכבות עתידיות — ציון בריאות פרויקט, אחוז חתימות, ציון איכות נתונים
          ופעולה מומלצת — ייטענו לכל ישות על המפה. מבנה הנתונים כבר מוכן לכך.
        </p>
      </div>
    </div>
  )
}
