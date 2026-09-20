'use client'

import { AlertTriangle, CircleHelp, Gavel, MinusCircle, ShieldCheck } from 'lucide-react'
import { QueryError, RowsSkeleton } from '@/components/ui/query-states'
import { useFeasibilityDeviations, type FeasibilityRuleDeviation } from '@/hooks/use-feasibility'

/**
 * Where this study departs from the regulatory rules registry.
 *
 * ── WHY THIS IS READ-ONLY, AND STAYS READ-ONLY ─────────────────────────────
 *
 * The endpoint behind it applies nothing: it resolves each rule as of the
 * study's determining date and compares it to the assumption the project
 * actually recorded. Making the panel able to "fix" a deviation would move
 * numbers in a report on the strength of a registry row, which is a decision
 * for the appraiser signing it — not for a button.
 *
 * ── WHY OVERRIDES COME FIRST ───────────────────────────────────────────────
 *
 * An OVERRIDE is not an error. It is the line an opposing appraiser reads
 * first, and the one the signer has to be able to justify, so it is the line
 * this panel shows first. UNSET is second because it means the engine used its
 * own fallback rather than a cited rule. MATCHES is the quiet majority and
 * sorts last.
 *
 * An empty registry produces an empty list and the panel says so plainly
 * rather than implying compliance nobody checked.
 */
const STATUS_META: Record<
  FeasibilityRuleDeviation['status'],
  { label: string; hint: string; className: string; icon: React.ReactNode }
> = {
  OVERRIDES: {
    label: 'חריגה',
    hint: 'הפרויקט השתמש בערך שונה מהרשום ברגולציה — דורש הסבר בדוח',
    className: 'bg-amber-50 text-amber-900 border-amber-200',
    icon: <AlertTriangle size={14} />,
  },
  UNSET: {
    label: 'לא הוזן',
    hint: 'יש כלל ברישום שלא נרשמה לו הנחה בפרויקט — החישוב השתמש בברירת המחדל של המנוע',
    className: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: <CircleHelp size={14} />,
  },
  MATCHES: {
    label: 'תואם',
    hint: 'ההנחה בפרויקט זהה לכלל שבתוקף במועד הקובע',
    className: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    icon: <ShieldCheck size={14} />,
  },
  NOT_APPLICABLE: {
    label: 'לא רלוונטי',
    hint: 'הכלל חל על סוג פרויקט אחר — מוצג כדי שיהיה ברור שנבדק ונמצא לא רלוונטי, ולא שנשכח',
    className: 'bg-slate-50 text-slate-500 border-slate-200',
    icon: <MinusCircle size={14} />,
  },
  UNMAPPED: {
    label: 'לא ממופה',
    hint: 'לכלל אין הכרעה מה הוא אומר במונחי המנוע — תקלת תצורה, לא ממצא על המחקר',
    className: 'bg-rose-50 text-rose-900 border-rose-200',
    icon: <AlertTriangle size={14} />,
  },
}

/**
 * Rates are STORED as decimal fractions (0.18) and READ as percentages (18%).
 *
 * The registry's own seed comments make the point: a table that mixed the two
 * would produce an error a hundred times the size of the input. Showing the
 * raw `0.18 ratio` is not wrong, but it is the form in which a transposed
 * rate goes unnoticed — so a fraction-unit value is rendered as the percentage
 * an appraiser is actually comparing against.
 */
const FRACTION_UNITS = new Set(['ratio', 'RATE', 'PERCENT', 'fraction'])

function formatValue(value: string | null, unit: string | null): string {
  if (value === null) return '—'
  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) return unit ? `${value} ${unit}` : value
  if (unit && FRACTION_UNITS.has(unit)) {
    const percent = (asNumber * 100).toFixed(2).replace(/\.?0+$/, '')
    return `${percent}%`
  }
  return unit ? `${asNumber.toLocaleString('he-IL')} ${unit}` : asNumber.toLocaleString('he-IL')
}

export function FeasibilityRulesPanel({ profileId }: { profileId: string }) {
  const { data, isLoading, isError, error, refetch } = useFeasibilityDeviations(profileId)

  const counts = (data?.deviations ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <section className="card-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Gavel size={17} />
          סטייה מרישום החוקים
          {data && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {data.deviations.length}
            </span>
          )}
        </h3>
        {data && (
          <p className="text-xs text-muted-foreground">
            נבדק למועד הקובע {new Date(data.valuationDate).toLocaleDateString('he-IL')}
            {data.jurisdiction ? ` · רשות: ${data.jurisdiction}` : ' · כללים ארציים בלבד'}
          </p>
        )}
      </div>

      {isLoading && <div className="mt-3"><RowsSkeleton rows={3} /></div>}
      {isError && (
        <div className="mt-3">
          <QueryError message="שגיאה בטעינת רישום החוקים" error={error} onRetry={() => refetch()} />
        </div>
      )}

      {data && data.deviations.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          רישום החוקים ריק עבור הארגון, ולכן אין מול מה להשוות. זו אינה הצהרה שהדוח תואם רגולציה — פשוט אין כללים רשומים.
        </p>
      )}

      {data && data.deviations.length > 0 && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['OVERRIDES', 'UNMAPPED', 'UNSET', 'MATCHES', 'NOT_APPLICABLE'] as const).map((status) =>
              counts[status] ? (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${STATUS_META[status].className}`}
                >
                  {STATUS_META[status].icon}
                  {STATUS_META[status].label}: {counts[status]}
                </span>
              ) : null,
            )}
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-right text-xs text-muted-foreground">
                  <th className="py-2 font-medium">כלל</th>
                  <th className="py-2 font-medium">ערך ברישום</th>
                  <th className="py-2 font-medium">ערך בפרויקט</th>
                  <th className="py-2 font-medium">מצב</th>
                  <th className="py-2 font-medium">מקור</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.deviations.map((row) => (
                  <tr key={row.ruleId}>
                    <td className="py-2.5 pe-3">
                      <span className="font-medium">{row.ruleName}</span>
                      <span className="block text-xs text-muted-foreground">{row.code}</span>
                    </td>
                    <td className="py-2.5 pe-3 tabular-nums">{formatValue(row.ruleValue, row.ruleUnit)}</td>
                    <td className="py-2.5 pe-3 tabular-nums">{formatValue(row.assumptionValue, row.ruleUnit)}</td>
                    <td className="py-2.5 pe-3">
                      <span
                        title={STATUS_META[row.status].hint}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs ${STATUS_META[row.status].className}`}
                      >
                        {STATUS_META[row.status].icon}
                        {STATUS_META[row.status].label}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{row.sourceReference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            התצוגה מדווחת בלבד ואינה משנה אף חישוב. כלל שנוי דורש עדכון ההנחה בפרויקט, או נימוק מפורש בדוח.
          </p>
        </>
      )}
    </section>
  )
}
