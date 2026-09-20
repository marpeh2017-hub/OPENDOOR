'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, Crosshair, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useRunFeasibilityGoalSeek,
  type FeasibilityGoalSeek,
  type FeasibilityGoalSeekMetric,
  type FeasibilityGoalSeekVariable,
} from '@/hooks/use-feasibility'

/**
 * "What does the price have to be for this to clear 25%?"
 *
 * The inverse of the sensitivity grid, and the question anyone actually asks
 * of one. The grid answers it by being read backwards and interpolated by
 * eye; this asks the engine directly.
 *
 * Four things are shown that a bare percentage would hide, because each one
 * changes whether the answer is usable:
 *
 *  - The ABSOLUTE solved input (₪/sqm), not only the percentage move. A price
 *    list takes a number, not a factor.
 *  - `UNREACHABLE_WITHIN_RANGE` is rendered as a failure, not as its closest
 *    value dressed up as an answer. The solver bounds its search precisely so
 *    it can say "not within these bounds" instead of returning +4000%.
 *  - The base value next to the achieved one, so the size of the move is
 *    visible rather than implied.
 *  - Issues the solution CREATES. Hitting a profit target by lifting the
 *    price can breach an LTC covenant; a solver that reported only the price
 *    would be handing over a plan whose cost is recorded elsewhere.
 */
const VARIABLES: Array<[FeasibilityGoalSeekVariable, string]> = [
  ['pricePerSqm', 'מחיר למ״ר (דירות למכירה)'],
  ['salePrice', 'כלל מחירי המכירה'],
  ['constructionCost', 'עלות בנייה'],
  ['landCost', 'עלות קרקע'],
  ['interestRate', 'שיעור ריבית'],
  ['discountRate', 'שיעור היוון'],
]

/** `ratio` metrics are decimal fractions in the engine; the UI says so plainly. */
const METRICS: Array<[FeasibilityGoalSeekMetric, string, 'ratio' | 'currency']> = [
  ['profitOnCost', 'רווח על עלות', 'ratio'],
  ['profitMargin', 'שיעור רווח', 'ratio'],
  ['profit', 'רווח', 'currency'],
  ['projectNpv', 'NPV פרויקטלי', 'currency'],
  ['projectIrrAnnual', 'IRR פרויקטלי שנתי', 'ratio'],
  ['residualLandValue', 'שווי קרקע שיורי', 'currency'],
]

/**
 * Why a solved absolute value may be missing. The engine refuses to invent one
 * rather than returning a number that stands for several different prices.
 */
const BASIS_NOTE: Record<string, string> = {
  MULTIPLE_BASE_PRICES: 'לשורות הדירות למכירה יש יותר ממחיר בסיס אחד למ״ר, ולכן אין מחיר יחיד לדווח — הפירוט לפי שורה מופיע למטה.',
  NO_PRICE_PER_SQM_LINES: 'אין שורות דירות למכירה המתומחרות לפי מחיר למ״ר.',
  SINGLE_BASE_PRICE_WITH_FIXED_PRICED_LINES: 'קיימות גם שורות המתומחרות במחיר קבוע לדירה; הן זזות באותו מקדם אך אינן מחיר למ״ר.',
  NO_SCALABLE_COST_LINES_IN_CATEGORY: 'אין שורות עלות בקטגוריה זו שהמקדם מזיז.',
  RATE_NOT_SET: 'השיעור אינו מוגדר בתרחיש.',
  FACTOR_ONLY: 'המנוף מזיז כמה קלטים יחד, ולכן אין ערך מוחלט יחיד.',
}

const metricMeta = (metric: FeasibilityGoalSeekMetric) => METRICS.find(([key]) => key === metric)!

function formatMetric(value: string | null, kind: 'ratio' | 'currency'): string {
  if (value === null) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return kind === 'ratio'
    ? `${(n * 100).toFixed(2).replace(/\.?0+$/, '')}%`
    : `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`
}

const shekels = (value: string) => `₪${Number(value).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`

/** The solved input carries its own unit (e.g. ₪/מ״ר), so it is not re-prefixed with ₪. */
const withUnit = (value: string, unit: string) =>
  `${Number(value).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ${unit}`

function message(error: unknown) {
  return error instanceof Error ? error.message : 'החיפוש נכשל. בדקו את הנתונים ונסו שוב.'
}

export function FeasibilityGoalSeekPanel({ projectId, scenarioId }: { projectId: string; scenarioId: string }) {
  const [open, setOpen] = useState(false)
  const [solveFor, setSolveFor] = useState<FeasibilityGoalSeekVariable>('pricePerSqm')
  const [targetMetric, setTargetMetric] = useState<FeasibilityGoalSeekMetric>('profitOnCost')
  const [targetValue, setTargetValue] = useState('0.25')
  const [maxChangePercent, setMaxChangePercent] = useState('300')
  const [result, setResult] = useState<FeasibilityGoalSeek | null>(null)
  const goalSeek = useRunFeasibilityGoalSeek(projectId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    goalSeek.mutate(
      { scenarioId, dto: { solveFor, targetMetric, targetValue, maxChangePercent } },
      { onSuccess: setResult },
    )
  }

  const [, metricLabel, metricKind] = metricMeta(targetMetric)
  const variableLabel = VARIABLES.find(([key]) => key === solveFor)?.[1] ?? solveFor
  const solvedInput = result?.solvedInput

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
            <select value={solveFor} onChange={(e) => setSolveFor(e.target.value as FeasibilityGoalSeekVariable)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {VARIABLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>יעד</span>
            <select value={targetMetric} onChange={(e) => setTargetMetric(e.target.value as FeasibilityGoalSeekMetric)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {METRICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>ערך היעד {metricKind === 'ratio' ? '(שבר עשרוני — 0.25 עבור 25%)' : '(₪)'}</span>
            <Input required value={targetValue} onChange={(e) => setTargetValue(e.target.value)} inputMode="decimal" />
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
                {formatMetric(result.targetValue, metricKind)}. הרחבת הטווח עשויה למצוא פתרון — אך פתרון בקצה
                הטווח הוא לרוב סימן שהיעד אינו ריאלי, ולא שהחיפוש היה צר.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {result.status === 'ALREADY_AT_TARGET' ? (
                <p className="font-medium">התרחיש כבר עומד ביעד — אין צורך בשינוי</p>
              ) : solvedInput?.solvedValue ? (
                <p className="font-medium">
                  הערך הנדרש: {withUnit(solvedInput.solvedValue, solvedInput.unit)}
                  <span className="font-normal">
                    {' '}(מ־{withUnit(solvedInput.baseValue!, solvedInput.unit)}, שינוי של {Number(result.requiredChangePercent).toFixed(2)}%)
                  </span>
                </p>
              ) : (
                <p className="font-medium">נדרש שינוי של {Number(result.requiredChangePercent).toFixed(2)}% ב{variableLabel}</p>
              )}
              <p className="mt-1 text-xs">
                {metricLabel}: {formatMetric(result.baseValue, metricKind)} ← {formatMetric(result.achievedValue, metricKind)}
                {' '}(מקדם ×{Number(result.requiredFactor).toFixed(4)})
              </p>
              {solvedInput && !solvedInput.solvedValue && BASIS_NOTE[solvedInput.basis] && (
                <p className="mt-1 text-xs opacity-80">{BASIS_NOTE[solvedInput.basis]}</p>
              )}
            </div>
          )}

          {solvedInput && solvedInput.perLine.length > 1 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start font-medium">שורה</th>
                    <th className="p-2 text-start font-medium">בסיס</th>
                    <th className="p-2 text-start font-medium">נדרש</th>
                  </tr>
                </thead>
                <tbody>
                  {solvedInput.perLine.map((line) => (
                    <tr key={line.lineId} className="border-t">
                      <td className="p-2">{line.label}</td>
                      <td className="p-2 tabular-nums">{withUnit(line.baseValue, solvedInput.unit)}</td>
                      <td className="p-2 font-semibold tabular-nums">{withUnit(line.solvedValue, solvedInput.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Cell label="הכנסות" value={shekels(result.resulting.revenue)} />
            <Cell label="עלויות" value={shekels(result.resulting.costs)} />
            <Cell label="רווח" value={shekels(result.resulting.profit)} />
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
