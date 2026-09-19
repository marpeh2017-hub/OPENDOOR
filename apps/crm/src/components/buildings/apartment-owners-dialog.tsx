'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, Percent, Divide, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { RowsSkeleton, QueryError } from '@/components/ui/query-states'
import { cn } from '@/lib/utils'
import { Frac, parseShare, sumShares, type ShareMode } from '@/lib/fractions'
import {
  useApartmentOwners, useSetApartmentOwners, type OwnershipAssignmentInput,
} from '@/hooks/use-buildings'
import { useOwners } from '@/hooks/use-owners'

/**
 * Ownership editor for one apartment (PUT /apartments/:id/owners).
 *
 * EXACTNESS IS THE WHOLE POINT. Ownership shares drive the pinuy-binuy
 * signature threshold, which is legally consequential, so no value in this
 * component is ever a float:
 *
 *   - What the user types is parsed by `@/lib/fractions` into an exact BigInt
 *     rational. `25%` becomes exactly 1/4; `33.333%` becomes exactly
 *     33333/100000. A percentage is parsed as a decimal STRING and scaled by a
 *     power of ten — it never passes through `Number()` arithmetic.
 *   - The running sum is exact rational addition, so `1/3 + 1/3 + 1/3` shows as
 *     exactly 1 and `999/1000` shows as exactly not 1. There is no epsilon.
 *   - What is submitted is the reduced numerator/denominator pair, never a
 *     rounded decimal.
 *
 * The server is still the authority: `OwnershipService` revalidates the sum
 * with the same rules and its rejection is surfaced verbatim below. The client
 * check only spares the user a round trip.
 */

const NONE = '__none__'

interface Row {
  /** Local key — stable across re-renders, not a server id. */
  key:      string
  ownerId:  string
  /** Raw text exactly as typed; the parse happens on every keystroke. */
  raw:      string
  mode:     ShareMode
  viaInheritance: boolean
}

let rowSeq = 0
function newRow(partial: Partial<Row> = {}): Row {
  rowSeq += 1
  return { key: `row-${rowSeq}`, ownerId: NONE, raw: '', mode: 'FRACTION', viaInheritance: false, ...partial }
}

export function ApartmentOwnersDialog({
  open,
  onOpenChange,
  apartmentId,
  apartmentLabel,
  buildingId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  apartmentId: string
  apartmentLabel: string
  buildingId?: string
}) {
  const current = useApartmentOwners(open ? apartmentId : '')
  const { data: owners, isLoading: ownersLoading } = useOwners({ isActive: true })
  const save = useSetApartmentOwners()

  const [rows, setRows] = useState<Row[]>([])
  const [requireComplete, setRequireComplete] = useState(false)
  const [seededFor, setSeededFor] = useState<string | null>(null)

  // Seed the editor from the server's current holdings once per open. The
  // stored numerator/denominator is shown verbatim — an apartment recorded as
  // 2/6 is not silently rewritten to 1/3 just by opening this dialog.
  useEffect(() => {
    if (!open) { setSeededFor(null); return }
    if (seededFor === apartmentId || !current.data) return
    setRows(
      current.data.owners.length > 0
        ? current.data.owners.map(o => newRow({
            ownerId: o.ownerId,
            raw:     `${o.shareNumerator}/${o.shareDenominator}`,
            mode:    'FRACTION',
            viaInheritance: o.viaInheritance,
          }))
        : [newRow()],
    )
    setRequireComplete(false)
    save.reset()
    setSeededFor(apartmentId)
    // `save` is a stable mutation object; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, apartmentId, current.data, seededFor])

  const parsed = useMemo(() => rows.map(r => ({ row: r, result: parseShare(r.raw, r.mode) })), [rows])

  const allValid = parsed.every(p => p.result.ok) && rows.every(r => r.ownerId !== NONE)
  const duplicateOwner = useMemo(() => {
    const seen = new Set<string>()
    for (const r of rows) {
      if (r.ownerId === NONE) continue
      if (seen.has(r.ownerId)) return true
      seen.add(r.ownerId)
    }
    return false
  }, [rows])

  const sum = useMemo(
    () => sumShares(parsed.filter(p => p.result.ok).map(p => p.result.value as Frac)),
    [parsed],
  )
  const sumIsOne  = sum.equals(Frac.ONE)
  const sumOverOne = sum.cmp(Frac.ONE) > 0

  const ownerName = useMemo(
    () => new Map((owners ?? []).map(o => [o.id, o.fullName])),
    [owners],
  )

  function update(key: string, patch: Partial<Row>) {
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!allValid || duplicateOwner || sumOverOne) return

    let payload: OwnershipAssignmentInput[]
    try {
      payload = parsed.map(({ row, result }) => {
        const parts = (result.value as Frac).toParts()
        return {
          ownerId: row.ownerId,
          shareNumerator:   parts.shareNumerator,
          shareDenominator: parts.shareDenominator,
          viaInheritance:   row.viaInheritance,
        }
      })
    } catch {
      // toParts() throws only when a reduced part exceeds the safe-integer
      // range, which `@IsInt()` would reject upstream anyway.
      return
    }

    save.mutate(
      { id: apartmentId, owners: payload, requireCompleteShares: requireComplete, buildingId },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(n) => { if (!save.isPending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">רישום בעלויות — דירה {apartmentLabel}</DialogTitle>
          <DialogDescription className="text-right">
            החלקים נשמרים כשברים מדויקים. ניתן להזין שבר (1/3) או אחוז (25%) —
            ההמרה מדויקת ואינה מעוגלת.
          </DialogDescription>
        </DialogHeader>

        {current.isLoading ? (
          <RowsSkeleton rows={3} />
        ) : current.isError ? (
          <QueryError
            message="שגיאה בטעינת רישום הבעלויות"
            error={current.error}
            onRetry={() => current.refetch()}
          />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pl-1">
              {parsed.map(({ row, result }) => (
                <div key={row.key} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Label className="text-xs">בעלים</Label>
                      <Select
                        value={row.ownerId}
                        onValueChange={(v) => update(row.key, { ownerId: v })}
                        dir="rtl"
                      >
                        <SelectTrigger><SelectValue placeholder="בחרו בעלים" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE} disabled>בחרו בעלים</SelectItem>
                          {(owners ?? []).map(o => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.fullName}{o.isEstate ? ' · עיזבון' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-40 space-y-1.5">
                      <Label className="text-xs">
                        {row.mode === 'PERCENT' ? 'אחוז' : 'חלק'}
                      </Label>
                      <Input
                        value={row.raw}
                        onChange={(e) => update(row.key, { raw: e.target.value })}
                        placeholder={row.mode === 'PERCENT' ? '25' : '1/3'}
                        inputMode="decimal"
                        dir="ltr"
                        className="text-left"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">&nbsp;</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title={row.mode === 'PERCENT' ? 'מעבר לשבר' : 'מעבר לאחוז'}
                        onClick={() => update(row.key, {
                          mode: row.mode === 'PERCENT' ? 'FRACTION' : 'PERCENT',
                          // The raw text is NOT converted between modes: silently
                          // rewriting '1/3' as '33.33' would lose exactness.
                          raw: '',
                        })}
                      >
                        {row.mode === 'PERCENT' ? <Percent size={15} /> : <Divide size={15} />}
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">&nbsp;</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="הסרת שורה"
                        onClick={() => setRows(rs => rs.filter(r => r.key !== row.key))}
                      >
                        <Trash2 size={15} className="text-red-600" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={row.viaInheritance}
                        onChange={(e) => update(row.key, { viaInheritance: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-input"
                      />
                      התקבל בירושה
                    </label>

                    {row.raw.trim() !== '' && (
                      result.ok ? (
                        <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                          {(result.value as Frac).toFractionString()}
                          {' = '}
                          {(result.value as Frac).toPercentString()}
                        </span>
                      ) : (
                        <span className="text-xs text-red-600" role="alert">{result.error}</span>
                      )
                    )}
                  </div>
                </div>
              ))}

              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  אין בעלים רשומים. שמירה כעת תסיר את כל רישומי הבעלות מהדירה.
                </p>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setRows(rs => [...rs, newRow()])}
              disabled={ownersLoading}
            >
              <Plus size={14} />
              הוספת בעלים
            </Button>

            {/* Exact running sum — rational addition, never a float. */}
            <div className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              sumIsOne
                ? 'border-green-200 bg-green-50 text-green-700'
                : sumOverOne
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-amber-200 bg-amber-50 text-amber-700',
            )}>
              {sumIsOne ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span>
                סך החלקים:{' '}
                <span className="font-semibold tabular-nums" dir="ltr">
                  {sum.toFractionString()} ({sum.toPercentString()})
                </span>
              </span>
              <span className="text-xs">
                {sumIsOne
                  ? '— בעלות מלאה'
                  : sumOverOne
                  ? '— חריגה מעל 100%, לא ניתן לשמור'
                  : '— בעלות חלקית'}
              </span>
            </div>

            {duplicateOwner && (
              <p className="text-sm text-red-600" role="alert">
                אותו בעלים מופיע יותר מפעם אחת. איחדו את השורות לחלק אחד.
              </p>
            )}

            {!sumIsOne && !sumOverOne && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={requireComplete}
                  onChange={(e) => setRequireComplete(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-input"
                />
                <span>
                  דרשו בעלות מלאה (100%) ודחו שמירה חלקית.
                  כברירת מחדל שמירה חלקית מותרת ומסומנת באיכות הנתונים — נסחי טאבו
                  מגיעים לעיתים קרובות עם יורשים חסרים, ודירה חלקית לעולם לא תיספר
                  כחתומה במלואה.
                </span>
              </label>
            )}

            {save.isError && (
              <p className="text-sm text-red-600" role="alert">
                {save.error instanceof Error ? save.error.message : 'שמירת הבעלויות נכשלה'}
              </p>
            )}

            <DialogFooter className="gap-2 sm:justify-start">
              <Button
                type="submit"
                disabled={save.isPending || !allValid || duplicateOwner || sumOverOne}
              >
                {save.isPending && <Loader2 size={15} className="animate-spin ml-1.5" />}
                שמירת בעלויות
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => onOpenChange(false)}
              >
                ביטול
              </Button>
              {ownerName.size === 0 && !ownersLoading && (
                <span className="self-center text-xs text-muted-foreground">
                  לא נמצאו בעלים פעילים — צרו בעלים במסך ״בעלים״ תחילה.
                </span>
              )}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
