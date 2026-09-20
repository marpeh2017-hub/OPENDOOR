'use client'

import { useState } from 'react'
import { AlertTriangle, Info, Layers, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFeasibilityWaterfall, type EquityTrancheResult, type FeasibilityWaterfall } from '@/hooks/use-feasibility'

/**
 * Who gets paid, in what order, and what each layer actually earned.
 *
 * The engine has always reported one equity IRR. In a layered deal that
 * number describes no investor: senior money on a preference and sponsor
 * money behind it do not earn the same thing, and a blend of the two is the
 * return of a person who does not exist. This table is the correction, and
 * the blended figure is shown beside it rather than removed — seeing that it
 * matches neither row is the fastest way to understand why the table is here.
 *
 * The tier columns are laid out in payment order, left to right, so the
 * waterfall reads the way it runs: capital back first, then preference, then
 * whatever is left. A shortfall is shown in its own column instead of being
 * folded into a smaller number somewhere else — "the hurdle was not met" and
 * "the hurdle was lower" look identical once they are netted.
 */
const shekels = (value: string | null) =>
  value === null ? '—' : `₪${Number(value).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`

const percent = (value: string | null, digits = 2) =>
  value === null ? '—' : `${(Number(value) * 100).toFixed(digits)}%`

const KIND_LABEL: Record<EquityTrancheResult['kind'], string> = {
  SENIOR: 'בכיר', JUNIOR: 'נדחה', SPONSOR: 'יזם',
}

const TIER_LABEL: Record<string, string> = {
  RETURN_OF_CAPITAL: 'החזר הון',
  PREFERRED_RETURN: 'תשואה מועדפת',
  RESIDUAL_SPLIT: 'חלוקת שארית',
}

export function FeasibilityWaterfallPanel({ projectId, scenarioId }: { projectId: string; scenarioId: string }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, isError, error } = useFeasibilityWaterfall(projectId, scenarioId, open)

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Layers size={16} />
          מפל ההון
        </h4>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          {open ? 'סגירה' : 'הצגת המפל'}
        </Button>
      </div>

      {open && (
        <div className="mt-3">
          {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />מחשב…</p>}
          {isError && <p className="text-sm text-destructive" role="alert">{error instanceof Error ? error.message : 'החישוב נכשל.'}</p>}
          {data && (data.applicable ? <Waterfall data={data} /> : <NoStructure />)}
        </div>
      )}
    </div>
  )
}

function NoStructure() {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      לא הוגדרו שכבות הון לתרחיש, ולכן אין מבנה לחלק לפיו. התשואה להון מוצגת כמספר משוקלל אחד בלבד — מה
      שנכון למשקיע יחיד, ואינו נכון לאף אחד כשההון מרובד. הוספת שכבות הון תייצר כאן פירוט לפי שכבה.
    </p>
  )
}

function Waterfall({ data }: { data: FeasibilityWaterfall }) {
  const critical = data.issues.filter((issue) => issue.severity === 'CRITICAL')
  const warnings = data.issues.filter((issue) => issue.severity !== 'CRITICAL')

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="p-2 text-start font-medium">שכבה</th>
              <th className="p-2 text-start font-medium">רף</th>
              <th className="p-2 text-start font-medium">הוזרם</th>
              <th className="p-2 text-start font-medium">החזר הון</th>
              <th className="p-2 text-start font-medium">תשואה מועדפת</th>
              <th className="p-2 text-start font-medium">שארית</th>
              <th className="p-2 text-start font-medium">סה״כ חזר</th>
              <th className="p-2 text-start font-medium">מכפיל</th>
              <th className="p-2 text-start font-medium">IRR</th>
            </tr>
          </thead>
          <tbody>
            {data.tranches.map((tranche) => (
              <tr key={tranche.id} className="border-t">
                <td className="p-2">
                  <span className="font-medium">{tranche.name}</span>
                  <span className="mr-1.5 text-xs text-muted-foreground">
                    {KIND_LABEL[tranche.kind]} · עדיפות {tranche.priority}
                  </span>
                </td>
                <td className="p-2 tabular-nums" dir="ltr">
                  {tranche.preferredReturnRate === null
                    ? <span className="text-muted-foreground">ללא</span>
                    : percent(tranche.preferredReturnRate)}
                </td>
                <td className="p-2 tabular-nums" dir="ltr">{shekels(tranche.equityInvested)}</td>
                <td className="p-2 tabular-nums" dir="ltr">
                  {shekels(tranche.returnOfCapital)}
                  {Number(tranche.capitalNotReturned) > 0 && (
                    <span className="block text-xs text-destructive">חסר {shekels(tranche.capitalNotReturned)}</span>
                  )}
                </td>
                <td className="p-2 tabular-nums" dir="ltr">
                  {shekels(tranche.preferredReturnPaid)}
                  {Number(tranche.preferredReturnUnpaid) > 0 && (
                    <span className="block text-xs text-amber-700">לא שולם {shekels(tranche.preferredReturnUnpaid)}</span>
                  )}
                </td>
                <td className="p-2 tabular-nums" dir="ltr">{shekels(tranche.residualProfit)}</td>
                <td className="p-2 font-semibold tabular-nums" dir="ltr">{shekels(tranche.equityDistributed)}</td>
                <td className="p-2 tabular-nums" dir="ltr">{tranche.equityMultiple === null ? '—' : `×${Number(tranche.equityMultiple).toFixed(2)}`}</td>
                <td className={`p-2 font-semibold tabular-nums ${Number(tranche.equityIrrAnnual) < 0 ? 'text-destructive' : ''}`} dir="ltr">
                  {percent(tranche.equityIrrAnnual)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/40 text-xs">
            <tr>
              <td className="p-2 font-medium" colSpan={2}>סה״כ</td>
              <td className="p-2 tabular-nums" dir="ltr">{shekels(data.totals.contributed)}</td>
              <td className="p-2" colSpan={3} />
              <td className="p-2 font-semibold tabular-nums" dir="ltr">{shekels(data.totals.distributed)}</td>
              <td className="p-2" colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/*
        The blended figure, kept visible on purpose. It is what the engine
        reported before the waterfall existed, and in a layered deal it is
        nobody's return — which is far more convincing shown than argued.
      */}
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium">לשם השוואה — החישוב המשוקלל על כלל ההון:</span>{' '}
        הוזרם <span dir="ltr">{shekels(data.blended.equityInvested)}</span>, חזר{' '}
        <span dir="ltr">{shekels(data.blended.equityDistributed)}</span>, מכפיל{' '}
        <span dir="ltr">×{data.blended.equityMultiple === null ? '—' : Number(data.blended.equityMultiple).toFixed(2)}</span>,
        IRR <span dir="ltr">{percent(data.blended.equityIrrAnnual)}</span>.
        {data.tranches.length > 1 && ' המספר הזה אינו התשואה של אף אחת מהשכבות שלמעלה.'}
      </div>

      {(critical.length > 0 || warnings.length > 0) && (
        <div className="space-y-1.5">
          {critical.map((issue) => (
            <p key={`${issue.code}:${issue.entityId ?? ''}`} className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span><span className="font-medium">{issue.code}</span> — {issue.message}</span>
            </p>
          ))}
          {warnings.map((issue) => (
            <p key={`${issue.code}:${issue.entityId ?? ''}`} className="flex items-start gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span><span className="font-medium">{issue.code}</span> — {issue.message}</span>
            </p>
          ))}
        </div>
      )}

      <details className="rounded-md border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">פירוט התשלומים לפי תאריך</summary>
        <div className="mt-2 space-y-2">
          {data.events.filter((event) => event.kind === 'DISTRIBUTION').map((event) => (
            <div key={event.date} className="text-xs">
              <p className="font-medium">
                {event.date} — לחלוקה <span dir="ltr">{shekels(event.available)}</span>
                {Number(event.unallocated) > 0 && <span className="text-destructive"> (ללא נמען: <span dir="ltr">{shekels(event.unallocated)}</span>)</span>}
              </p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {event.tiers.map((tier, index) => (
                  <li key={index}>
                    {TIER_LABEL[tier.tier] ?? tier.tier} → {tier.trancheName}:{' '}
                    <span className="tabular-nums" dir="ltr">{shekels(tier.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {data.events.every((event) => event.kind !== 'DISTRIBUTION') && (
            <p className="text-xs text-muted-foreground">אין עדיין חלוקות הון בתזרים התרחיש.</p>
          )}
        </div>
      </details>

      <p className="text-xs text-muted-foreground">
        מבנה: החזר הון → תשואה מועדפת → חלוקת שארית. שלב catch-up אינו נתמך ואינו מקורב — מבנה שדורש
        אותו אינו ניתן להגדרה כאן כלל, כדי שלא יתקבלו מספרים לעסקה שאיש לא הסכים לה.
      </p>
    </div>
  )
}
