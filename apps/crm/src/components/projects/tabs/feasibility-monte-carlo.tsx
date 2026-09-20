'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, Dices, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useRunFeasibilityMonteCarlo,
  type MonteCarloField,
  type MonteCarloMetricKey,
  type MonteCarloResult,
  type MonteCarloStats,
  type MonteCarloVariableInput,
} from '@/hooks/use-feasibility'

/**
 * The distribution behind the single number.
 *
 * A zero report states one profit-on-cost, which is what happens if every
 * assumption lands exactly where it was typed — the one outcome that will not
 * occur. This shows the spread instead, and the thing a lender actually asks
 * for: how often this loses money.
 *
 * Three deliberate choices in what is displayed:
 *
 *  - P10/P50/P90 are shown NEXT TO the base case, because the interesting
 *    fact is usually that the base sits well above the median — an optimism
 *    that is invisible when the base is read alone.
 *  - The probability of loss is given its own cell and coloured only when it
 *    is non-trivial. A 0% that looks like a warning trains people to ignore
 *    the warning.
 *  - The seed is printed. A simulation quoted in a report has to be
 *    re-derivable by whoever reads it, and an unreproducible number in a
 *    professional document is an assertion rather than a finding.
 */
const FIELDS: Array<[MonteCarloField, string, string]> = [
  ['pricePerSqm', 'מחיר למ״ר (דירות למכירה)', '0.10'],
  ['constructionCost', 'עלות בנייה', '0.15'],
  ['landCost', 'עלות קרקע', '0.10'],
  ['interestRate', 'שיעור ריבית', '0.20'],
  ['discountRate', 'שיעור היוון', '0.10'],
  ['salePrice', 'כלל מחירי המכירה', '0.10'],
]

const METRICS: Array<[MonteCarloMetricKey, string, 'ratio' | 'currency']> = [
  ['profitOnCost', 'רווח על עלות', 'ratio'],
  ['profit', 'רווח', 'currency'],
  ['projectNpv', 'NPV פרויקטלי', 'currency'],
  ['projectIrrAnnual', 'IRR פרויקטלי', 'ratio'],
  ['equityIrrAnnual', 'IRR הון עצמי', 'ratio'],
]

const FIELD_LABEL = new Map<string, string>([
  ...FIELDS.map(([key, label]) => [key, label] as [string, string]),
  ['financingMonths', 'משך מימון (חודשים)'],
])

function fmt(value: number | null, kind: 'ratio' | 'currency'): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return kind === 'ratio'
    ? `${(value * 100).toFixed(1)}%`
    : `₪${value.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'הסימולציה נכשלה. בדקו את הנתונים ונסו שוב.'
}

/** Default spreads are the ones the brief names; every one of them is editable. */
const DEFAULTS: Record<string, { on: boolean; stdDevPct: string }> = Object.fromEntries(
  FIELDS.map(([key, , sd]) => [key, { on: key === 'pricePerSqm' || key === 'constructionCost', stdDevPct: sd }]),
)

export function FeasibilityMonteCarloPanel({ projectId, scenarioId }: { projectId: string; scenarioId: string }) {
  const [open, setOpen] = useState(false)
  const [runs, setRuns] = useState('1000')
  const [spread, setSpread] = useState(DEFAULTS)
  const [months, setMonths] = useState({ on: false, min: '18', mostLikely: '24', max: '36' })
  const [metric, setMetric] = useState<MonteCarloMetricKey>('profitOnCost')
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const simulate = useRunFeasibilityMonteCarlo(projectId)

  const variables: MonteCarloVariableInput[] = [
    ...FIELDS.filter(([key]) => spread[key]!.on).map(([key]) => ({
      field: key, distribution: 'normal' as const, stdDevPct: spread[key]!.stdDevPct,
    })),
    ...(months.on ? [{ field: 'financingMonths' as const, distribution: 'triangular' as const, min: months.min, mostLikely: months.mostLikely, max: months.max }] : []),
  ]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    simulate.mutate({ scenarioId, dto: { runs: Number(runs), variables } }, { onSuccess: setResult })
  }

  const [, metricLabel, metricKind] = METRICS.find(([key]) => key === metric)!
  const stats: MonteCarloStats | null = result ? result.metrics[metric] : null
  const baseValue = result ? Number(result.baseCase[metric]) : null

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Dices size={16} />
          סימולציית מונטה קרלו
        </h4>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          {open ? 'סגירה' : 'הגדרת טווחים והרצה'}
        </Button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FIELDS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={spread[key]!.on}
                  onChange={(e) => setSpread({ ...spread, [key]: { ...spread[key]!, on: e.target.checked } })}
                />
                <span className="flex-1">{label}</span>
                <span className="text-xs text-muted-foreground">±</span>
                <Input
                  className="h-8 w-20"
                  inputMode="decimal"
                  aria-label={`סטיית תקן עבור ${label}`}
                  disabled={!spread[key]!.on}
                  value={spread[key]!.stdDevPct}
                  onChange={(e) => setSpread({ ...spread, [key]: { ...spread[key]!, stdDevPct: e.target.value } })}
                />
              </label>
            ))}
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={months.on} onChange={(e) => setMonths({ ...months, on: e.target.checked })} />
              <span className="flex-1">משך מימון — משולשת (חודשים)</span>
              {(['min', 'mostLikely', 'max'] as const).map((key) => (
                <Input
                  key={key} className="h-8 w-16" inputMode="numeric" disabled={!months.on}
                  aria-label={`משך מימון ${key}`}
                  value={months[key]} onChange={(e) => setMonths({ ...months, [key]: e.target.value })}
                />
              ))}
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            הערכים הם סטיית תקן כשבר מערך הבסיס — 0.10 פירושו ±10%. משך המימון נדגם בחודשים, לא כמקדם.
          </p>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              <span>מספר הרצות</span>
              <Input className="w-32" value={runs} onChange={(e) => setRuns(e.target.value)} inputMode="numeric" />
            </label>
            <Button disabled={simulate.isPending || variables.length === 0}>
              {simulate.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              הרצה
            </Button>
          </div>
          {variables.length === 0 && <p className="text-sm text-muted-foreground">יש לבחור לפחות משתנה אחד לדגימה.</p>}
          {simulate.isError && <p className="text-sm text-destructive" role="alert">{message(simulate.error)}</p>}
        </form>
      )}

      {result && stats && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            {METRICS.map(([key, label]) => (
              <Button
                key={key} size="sm" type="button"
                variant={key === metric ? 'default' : 'outline'}
                disabled={!result.metrics[key].available}
                onClick={() => setMetric(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          {!stats.available ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              המדד „{metricLabel}” אינו מוגדר באף אחת מ-{result.runs} ההרצות — לרוב משום שאין בתרחיש תזרים
              מתוארך שממנו אפשר לגזור אותו. מוצג ככזה, ולא כאפס.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                <Cell label="P10" value={fmt(stats.p10, metricKind)} />
                <Cell label="P50 (חציון)" value={fmt(stats.p50, metricKind)} emphasis />
                <Cell label="P90" value={fmt(stats.p90, metricKind)} />
                <Cell label="בסיס התרחיש" value={fmt(baseValue, metricKind)} />
                <Cell
                  label="הסתברות להפסד"
                  value={fmt(stats.probabilityOfLoss, 'ratio')}
                  tone={(stats.probabilityOfLoss ?? 0) >= 0.05 ? 'alert' : undefined}
                />
              </div>

              <Histogram stats={stats} kind={metricKind} baseValue={baseValue} />

              <p className="text-xs text-muted-foreground">
                ממוצע <span dir="ltr">{fmt(stats.mean, metricKind)}</span> · סטיית תקן{' '}
                <span dir="ltr">{fmt(stats.stdDev, metricKind)}</span> · טווח{' '}
                <span dir="ltr">{fmt(stats.min, metricKind)}–{fmt(stats.max, metricKind)}</span> · {stats.samples} דגימות
                {stats.undefinedRuns > 0 && ` (${stats.undefinedRuns} הרצות שבהן המדד לא היה מוגדר, והוצאו מהסטטיסטיקה)`}
              </p>
            </>
          )}

          {result.clampedDraws > 0 && (
            <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {result.clampedDraws} דגימות נחסמו מלרדת מתחת ל-1% מערך הבסיס, כדי שמחיר או עלות לא יתהפכו
              לשלילה. סטיית תקן כה גדולה מרמזת שההתפלגות שנבחרה רחבה מדי לקלט הזה.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            {result.runs.toLocaleString('he-IL')} הרצות מלאות של המנוע ב-{(result.elapsedMs / 1000).toFixed(1)} שניות
            ({result.msPerRun} מ״ש להרצה) · seed {result.seed} · נדגמו:{' '}
            {result.variables.map((variable) => `${FIELD_LABEL.get(variable.field) ?? variable.field} (${variable.distribution})`).join(', ')}.
            ה-seed מוצג כדי שאפשר יהיה לשחזר בדיוק את ההרצה הזו.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * A bar chart in plain divs rather than a charting dependency: twenty buckets
 * with a highlighted base case is not a problem that needs one.
 */
function Histogram({ stats, kind, baseValue }: { stats: MonteCarloStats; kind: 'ratio' | 'currency'; baseValue: number | null }) {
  const peak = Math.max(...stats.histogram.map((bucket) => bucket.count), 1)
  return (
    <div>
      <div className="flex h-32 items-end gap-px" role="img" aria-label={`היסטוגרמה של ${stats.samples} דגימות`}>
        {stats.histogram.map((bucket, index) => {
          const holdsBase = baseValue !== null && bucket.from !== null && bucket.to !== null
            && baseValue >= bucket.from
            && (baseValue < bucket.to || index === stats.histogram.length - 1)
          return (
            <div
              key={index}
              className={`flex-1 rounded-t-sm ${holdsBase ? 'bg-amber-500' : 'bg-primary/70'}`}
              style={{ height: `${Math.max((bucket.count / peak) * 100, bucket.count > 0 ? 2 : 0)}%` }}
              title={`${fmt(bucket.from, kind)}–${fmt(bucket.to, kind)}: ${bucket.count} הרצות`}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span dir="ltr">{fmt(stats.min, kind)}</span>
        {baseValue !== null && <span className="text-amber-600">▲ בסיס <span dir="ltr">{fmt(baseValue, kind)}</span></span>}
        <span dir="ltr">{fmt(stats.max, kind)}</span>
      </div>
    </div>
  )
}

/**
 * `dir="ltr"` on the value, not on the card.
 *
 * A negative percentage in an RTL paragraph renders as `2.8%-`: the minus is
 * a neutral character and the bidi algorithm puts it on the wrong side. That
 * is not a cosmetic complaint — a loss reads as a gain. The label stays RTL
 * and only the number is forced, so the layout is unaffected.
 */
function Cell({ label, value, emphasis, tone }: { label: string; value: string; emphasis?: boolean; tone?: 'alert' }) {
  return (
    <div className={`rounded-md px-3 py-2 ${tone === 'alert' ? 'bg-destructive/10' : 'bg-muted/60'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p dir="ltr" className={`mt-1 text-end font-semibold tabular-nums ${emphasis ? 'text-base' : ''} ${tone === 'alert' ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  )
}
