'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Crosshair, Loader2, MapPinOff, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useGeocodePending,
  useRunGeocode,
  useSetCoordinates,
  type GeocodeCandidate,
  type GeocodeRunSummary,
  type GeoEntityKind,
} from '@/hooks/use-gis'
import { useIsManager } from '@/hooks/use-auth'

/**
 * Admin surface for the geocoding foundation.
 *
 * Deliberately a MANUAL control, not a status readout for a background job.
 * The provider is a donated public service capped at one request per second;
 * an automatic sweep would breach its usage policy, so resolving coordinates
 * is always something a person chose to do.
 *
 * The panel is honest in both directions: it shows what could not be resolved
 * and WHY, and it offers the manual override as a first-class path rather than
 * an afterthought — for Hebrew street names, OSM coverage is uneven enough
 * that hand-correction is a routine operation, not an edge case.
 */

const KIND_LABEL: Record<GeoEntityKind, string> = {
  PROJECT: 'פרויקט',
  COMPLEX: 'מתחם',
  BUILDING: 'מבנה',
}

/** Failure reasons in the operator's language — each implies a different fix. */
const REASON_LABEL: Record<string, string> = {
  NO_ADDRESS: 'אין כתובת',
  NO_MATCH: 'לא נמצאה התאמה',
  CITY_MISMATCH: 'התוצאה בעיר אחרת — נדחתה',
  TOO_COARSE: 'ההתאמה כללית מדי (מרכז עיר)',
  AMBIGUOUS: 'כמה תוצאות אפשריות — לא נבחרה אחת',
  PROVIDER_UNAVAILABLE: 'שירות הגיאוקודינג אינו זמין',
  RATE_LIMITED: 'השירות ביקש להאט — נעצר',
}

const QUALITY_LABEL: Record<string, string> = {
  HOUSE_NUMBER: 'מספר בית',
  STREET: 'רחוב',
  LOCALITY: 'יישוב',
  AREA: 'אזור',
}

function RunSummary({ summary }: { summary: GeocodeRunSummary }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-green-700">
          <CheckCircle2 size={15} /> {summary.matched} מוקמו
        </span>
        <span className="flex items-center gap-1.5 text-amber-700">
          <MapPinOff size={15} /> {summary.failed} לא נפתרו
        </span>
        <span className="text-muted-foreground">מתוך {summary.pending} ממתינים</span>
      </div>

      {summary.stoppedEarly && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          הריצה נעצרה באמצע — שירות הגיאוקודינג לא היה זמין. לא נכתבו קואורדינטות
          עבור שאר הישויות. אפשר לנסות שוב מאוחר יותר.
        </p>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {summary.results.map((r) => (
          <li key={`${r.kind}-${r.id}`} className="flex items-start gap-3 px-3 py-2 text-sm">
            {r.status === 'MATCHED' ? (
              <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-green-600" />
            ) : (
              <MapPinOff size={15} className="mt-0.5 flex-shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {KIND_LABEL[r.kind]} · {r.address}
                {r.city ? `, ${r.city}` : ''}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {r.status === 'MATCHED'
                  ? `${QUALITY_LABEL[r.matchQuality ?? ''] ?? r.matchQuality} · ${r.displayName}`
                  : REASON_LABEL[r.reason ?? ''] ?? r.reason}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Inline lat/lng entry for one unplaced entity. */
function ManualRow({ candidate }: { candidate: GeocodeCandidate }) {
  const [open, setOpen] = useState(false)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const setCoords = useSetCoordinates()

  const submit = () => {
    const latNum = Number(lat)
    const lngNum = Number(lng)
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      setError('קו רוחב חייב להיות בין 90- ל-90')
      return
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      setError('קו אורך חייב להיות בין 180- ל-180')
      return
    }
    setError(null)
    setCoords.mutate(
      { kind: candidate.kind, id: candidate.id, lat: latNum, lng: lngNum, note: note.trim() || undefined },
      {
        onSuccess: () => setOpen(false),
        onError: (e) => setError(e instanceof Error ? e.message : 'השמירה נכשלה'),
      },
    )
  }

  return (
    <li className="px-3 py-2.5 text-sm">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{candidate.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {KIND_LABEL[candidate.kind]} · {candidate.address}
            {candidate.city ? `, ${candidate.city}` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Crosshair size={14} className="ml-1" />
          מיקום ידני
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            הזינו קואורדינטות WGS84 (עשרוניות). ניתן להעתיק מ-Google Maps או מ-govmap.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={lat} onChange={(e) => setLat(e.target.value)}
              placeholder="קו רוחב · 32.05916" className="w-40" inputMode="decimal"
              aria-label="קו רוחב"
            />
            <Input
              value={lng} onChange={(e) => setLng(e.target.value)}
              placeholder="קו אורך · 34.77083" className="w-40" inputMode="decimal"
              aria-label="קו אורך"
            />
            <Input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="הערה — מקור המיקום" className="min-w-[180px] flex-1"
              aria-label="הערה"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={setCoords.isPending}>
              {setCoords.isPending && <Loader2 size={14} className="ml-1 animate-spin" />}
              שמירה
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </div>
      )}
    </li>
  )
}

export function GeocodePanel({ projectId }: { projectId?: string }) {
  const isManager = useIsManager()
  const pending = useGeocodePending(projectId)
  const runGeocode = useRunGeocode()
  const [summary, setSummary] = useState<GeocodeRunSummary | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const candidates = pending.data?.candidates ?? []
  const total = pending.data?.total ?? 0

  const run = () => {
    setRunError(null)
    runGeocode.mutate(
      { projectId, limit: Math.min(total, 25) },
      {
        onSuccess: (s) => setSummary(s),
        onError: (e) => setRunError(e instanceof Error ? e.message : 'הריצה נכשלה'),
      },
    )
  }

  if (pending.isLoading) {
    return (
      <div className="card-surface p-4">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (total === 0 && !summary) {
    return (
      <div className="card-surface p-4">
        <p className="text-sm font-semibold text-foreground">גיאוקודינג</p>
        <p className="mt-1 text-xs text-muted-foreground">
          לכל הישויות שיש להן כתובת כבר יש קואורדינטות. אין מה לפתור.
        </p>
      </div>
    )
  }

  return (
    <div className="card-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">גיאוקודינג</p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            {total} ישויות כוללות כתובת ללא קואורדינטות. הפתרון מתבצע מול OpenStreetMap
            (Nominatim) בקצב מרבי של בקשה אחת לשנייה — ריצה של {total} ישויות תימשך
            לפחות {total} שניות. תוצאה שאינה מאומתת מול העיר הנכונה נדחית ואינה נשמרת.
          </p>
        </div>
        {isManager && (
          <Button onClick={run} disabled={runGeocode.isPending || total === 0}>
            {runGeocode.isPending
              ? <Loader2 size={15} className="ml-1.5 animate-spin" />
              : <Play size={15} className="ml-1.5" />}
            {runGeocode.isPending ? 'מריץ…' : 'הרץ גיאוקודינג'}
          </Button>
        )}
      </div>

      {runError && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {runError}
        </p>
      )}

      {summary && <RunSummary summary={summary} />}

      {candidates.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            ממתינות למיקום
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {candidates.map((c) => (
              <ManualRow key={`${c.kind}-${c.id}`} candidate={c} />
            ))}
          </ul>
          {!isManager && (
            <p className="mt-2 text-xs text-muted-foreground">
              הרצת גיאוקודינג ועדכון מיקום ידני מוגבלים למנהלים.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
