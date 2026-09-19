'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, Crosshair, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useRunFeasibilityGoalSeek,
  type FeasibilityGoalSeek,
  type FeasibilityGoalSeekMetric,
  type FeasibilitySensitivityVariable,
} from '@/hooks/use-feasibility'

/**
 * "What does the price have to be for this to clear 25%?"
 *
 * The inverse of the sensitivity grid, and the question anyone actually asks
 * of one. The grid answers it by being read backwards and interpolated by
 * eye; this asks the engine directly.
 *
 * Three things are shown that a bare number would hide, because each one
 * changes whether the answer is usable:
 *
 *  - `UNREACHABLE_WITHIN_RANGE` is rendered as a failure, not as its closest
 *    value dressed up as an answer. The solver bounds its search precisely so
 *    it can say "not within these bounds" instead of returning +4000%.
 *  - The base value next to the achieved one, so the size of the move is
 *    visible rather than implied.
 *  - Issues the solution CREATES. Hitting a profit target by lifting the
 *    price can breach an LTC covenant; a solver that reported only the price
 *    would be handing over a plan whose cost is recorded elsewhere.
 */
const VARIABLES: Array<[FeasibilitySensitivityVariable, string]> = [
  ['SALE_PRICE', 'מחיר מכירה'],
  ['CONSTRUCTION_COST', 'עלות בנייה'],
  ['LAND_COST', 'עלות קרקע'],
  ['INTEREST_RATE', 'שיעור ריבית'],
  ['DISCOUNT_RATE', 'שיעור היוון'],
]

/** `ratio` metrics are decimal fractions in the engine; the UI says so plainly. */
const METRICS: Array<[FeasibilityGoalSeekMetric, string, 'ratio' | 'currency']> = [
  ['PROFIT_ON_COST', 'רווח על עלות', 'ratio'],
  ['PROFIT_MARGIN', 'שיעור רווח', 'ratio'],
  ['PROFIT', 'רווח', 'currency'],
  ['PROJECT_NPV', 'NPV פרויקטלי', 'currency'],
  ['PROJECT_IRR_ANNUAL', 'IRR פרויקטלי שנתי', 'ratio'],
  ['RESIDUAL_LAND_VALUE', 'שווי קרקע שיורי', 'currency'],
]

const metricMeta = (metric: FeasibilityGoalSeekMetric) => METRICS.find(([key]) => key === metric)!

function formatMetric(value: string | null, kind: 'ratio' | 'currency'): string {
  if (value === null) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return kind === 'ratio'
    ? `${(n * 100).toFixed(2).replace(/\.?0+$/, '')}%`
    : `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'החיפוש נכשל. בדקו את הנתונים ונסו שוב.'
}

export function FeasibilityGoalSeekPanel({ projectId, scenarioId }: { projectId: string; scenarioId: string }) {
  const [open, setOpen] = useState(false)
  const [variable, setVariable] = useState<FeasibilitySensitivityVariable>('SALE_PRICE')
  const [metric, setMetric] = useState<FeasibilityGoalSeekMetric>('PROFIT_ON_COST')
  const [target, setTarget] = useState('0.25')
  const [maxChangePercent, setMaxChangePercent] = useState('300')
  const [result, setResult] = useState<FeasibilityGoalSeek | null>(null)
  const goalSeek = useRunFeasibilityGoalSeek(projectId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    goalSeek.mutate(
      { scenarioId, dto: { variable, metric, target, maxChangePercent } },
      { onSuccess: setResult },
    )
  }

  const [, metricLabel, metricKind] = metricMeta(metric)
  const variableLabel = VARIABLES.find(([key]) => key === variable)?.[1] ?? variable

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Crosshair size={16} />
          חתירה ליעד
        </h4>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          {open ? 'סגירה' : 'חישוב נדרש ליעד'}
        </Button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            <span>מה משנים</span>
            <select value={variable} onChange={(e) => setVariable(e.target.value as FeasibilitySensitivityVariable)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {VARIABLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>יעד</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value as FeasibilityGoalSeekMetric)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {METRICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>ערך היעד {metricKind === 'ratio' ? '(שבר עשרוני — 0.25 עבור 25%)' : '(₪)'}</span>
            <Input required value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>טווח חיפוש מרבי (±%)</span>
            <Input required value={maxChangePercent} onChange={(e) => setMaxChangePercent(e.target.value)} inputMode="decimal" />
          </label>
          <div className="flex items-center justify-end sm:col-span-2">
            <Button disabled={goalSeek.isPending}>
              {goalSeek.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              חיפוש
            </Button>
          </div>
          {goalSeek.isError && <p className="text-sm text-destructive sm:col-span-2" role="alert">{message(goalSeek.error)}</p>}
        </form>
      )}

      {result && (
        <div className="mt-4 space-y-3" aria-live="polite">
          {result.status === 'UNREACHABLE_WITHIN_RANGE' ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">היעד אינו בר־השגה בטווח שנבדק ({result.searchedRangePercent}%)</p>
              <p className="mt-1 text-xs">
                הערך הקרוב ביותר שהושג: {formatMetric(result.achievedValue, metricKind)} מול יעד{' '}
                {formatMetric(result.target, metricKind)}. הרחבת הטווח עשויה למצוא פתרון — אך פתרון בקצה
                הטווח הוא לרוב סימן שהיעד אינו ריאלי, ולא שהחיפוש היה צר.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <p className="font-medium">
                {result.status === 'ALREADY_AT_TARGET'
                  ? 'התרחיש כבר עומד ביעד — אין צורך בשינוי'
                  : `נדרש שינוי של ${Number(result.requiredChangePercent).toFixed(2)}% ב${variableLabel}`}
              </p>
              <p className="mt-1 text-xs">
                {metricLabel}: {formatMetric(result.baseValue, metricKind)} ← {formatMetric(result.achievedValue, metricKind)}
                {' '}(מקדם ×{Number(result.requiredFactor).toFixed(4)})
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Cell label="הכנסות" value={`₪${Number(result.resulting.revenue).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} />
            <Cell label="עלויות" value={`₪${Number(result.resulting.costs).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} />
            <Cell label="רווח" value={`₪${Number(result.resulting.profit).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`} />
            <Cell label="רווח על עלות" value={formatMetric(result.resulting.profitOnCost, 'ratio')} />
          </div>

          {result.triggeredIssues.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertTriangle size={14} />
                השינוי הזה יוצר חריגות חדשות
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {result.triggeredIssues.map((issue) => (
                  <li key={issue.code}><span className="font-medium">{issue.code}</span> — {issue.message}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            נבדקו {result.evaluations} הרצות מלאות של המנוע. התוצאה אינה נשמרת ואינה משנה את התרחיש — היא
            אומרת מה היה נדרש, לא מחילה אותו.
          </p>
        </div>
      )}
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  )
}
