'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Users, AlertTriangle, RotateCcw, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useImportReview, useResolveImportReview, useClearImportDecision,
  type ImportDecisionAction, type ReviewRow,
} from '@/hooks/use-imports'
import {
  DECISION_LABELS, DECISION_HINTS, MATCH_REASON_LABELS,
} from '@/lib/excel-import'

/**
 * The ambiguous-duplicate resolution queue.
 *
 * WHY THIS SCREEN EXISTS
 * ----------------------
 * When the matcher finds more than one plausible existing record for a sheet
 * row it refuses to guess: the row becomes NEEDS_REVIEW and is left out of the
 * import. Before this screen the only remedy was to add national IDs to the
 * spreadsheet and upload it again. Here the user rules on each row instead.
 *
 * THINGS THIS SCREEN DELIBERATELY DOES NOT DO
 * -------------------------------------------
 *   - There is no "merge" action, and no bulk "accept all matches". Both would
 *     be an automatic merge wearing a different hat, and a wrong merge on an
 *     owner silently moves the pinuy-binuy signature threshold.
 *   - The two bulk buttons that DO exist only apply to rows that are still
 *     undecided, and only for the two actions that cannot pick a wrong target
 *     (create-new and skip). Choosing WHICH existing record to update is always
 *     one row at a time.
 *   - No תעודת זהות is rendered. The API sends `hasNationalId`, never digits.
 *
 * The rulings are advice, not authority: the server re-checks each one against
 * the live candidate list at commit time, so a record deleted or edited in the
 * meantime fails its row rather than being written to.
 */
export function ImportReviewStep({
  jobId,
  onResolvedCountChange,
}: {
  jobId: string
  /** Lets the wizard footer enable "continue" only when nothing is pending. */
  onResolvedCountChange?: (undecided: number) => void
}) {
  const { data, isLoading, error } = useImportReview(jobId)
  const resolve = useResolveImportReview()
  const clear = useClearImportDecision()

  /** Local edits not yet sent. Keyed by row number. */
  const [draft, setDraft] = useState<
    Record<number, { action: ImportDecisionAction; targetEntityId?: string }>
  >({})

  useEffect(() => {
    if (data) onResolvedCountChange?.(data.undecided)
  }, [data, onResolvedCountChange])

  const pendingSave = useMemo(() => Object.keys(draft).length > 0, [draft])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="animate-spin" size={16} />
        טוען כפילויות להכרעה…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        לא ניתן לטעון את רשימת הכפילויות.
      </div>
    )
  }

  if (!data || data.totalAmbiguous === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <CheckCircle2 size={28} className="text-emerald-600" />
        <p className="text-sm">אין כפילויות שדורשות הכרעה.</p>
      </div>
    )
  }

  const setRow = (
    rowNumber: number,
    action: ImportDecisionAction,
    targetEntityId?: string,
  ) => setDraft((d) => ({ ...d, [rowNumber]: { action, targetEntityId } }))

  const save = () => {
    const decisions = Object.entries(draft).map(([rowNumber, v]) => ({
      rowNumber: Number(rowNumber),
      action: v.action,
      ...(v.targetEntityId ? { targetEntityId: v.targetEntityId } : {}),
    }))
    if (!decisions.length) return
    resolve.mutate({ jobId, decisions }, { onSuccess: () => setDraft({}) })
  }

  /**
   * Bulk apply, restricted to rows with NO ruling yet and to the two actions
   * that name no target. It never overwrites a considered decision, and it
   * cannot pick the wrong existing record because it picks none.
   */
  const bulkUndecided = (action: 'CREATE_NEW' | 'SKIP') => {
    const next = { ...draft }
    for (const r of data.rows) {
      if (r.decision || draft[r.rowNumber]) continue
      next[r.rowNumber] = { action }
    }
    setDraft(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              {data.totalAmbiguous} שורות התאימו ליותר מרשומה קיימת אחת
            </p>
            <p className="text-xs">
              המערכת לא מאחדת רשומות באופן אוטומטי. שורה ללא הכרעה לא תיובא.
              נותרו {data.undecided} שורות להכרעה.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => bulkUndecided('CREATE_NEW')}
            disabled={data.undecided === 0}
          >
            סמן את הנותרות כרשומות חדשות
          </Button>
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => bulkUndecided('SKIP')}
            disabled={data.undecided === 0}
          >
            דלג על הנותרות
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {data.rows.map((row) => (
          <ReviewRowCard
            key={row.rowNumber}
            row={row}
            draft={draft[row.rowNumber]}
            onChange={setRow}
            onClear={() => {
              setDraft((d) => {
                const next = { ...d }
                delete next[row.rowNumber]
                return next
              })
              if (row.decision) clear.mutate({ jobId, rowNumber: row.rowNumber })
            }}
          />
        ))}
      </div>

      {resolve.error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(resolve.error as Error).message}
        </p>
      )}

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-background py-3">
        {pendingSave && (
          <span className="text-xs text-muted-foreground">
            {Object.keys(draft).length} הכרעות טרם נשמרו
          </span>
        )}
        <Button type="button" onClick={save} disabled={!pendingSave || resolve.isPending}>
          {resolve.isPending && <Loader2 className="ml-2 animate-spin" size={14} />}
          שמירת ההכרעות
        </Button>
      </div>
    </div>
  )
}

/** One sheet row beside every existing record it might be. */
function ReviewRowCard({
  row,
  draft,
  onChange,
  onClear,
}: {
  row: ReviewRow
  draft?: { action: ImportDecisionAction; targetEntityId?: string }
  onChange: (rowNumber: number, action: ImportDecisionAction, targetEntityId?: string) => void
  onClear: () => void
}) {
  const current = draft ?? (row.decision
    ? { action: row.decision.action, targetEntityId: row.decision.targetEntityId ?? undefined }
    : undefined)

  const decided = Boolean(current)
  const name = `decision-row-${row.rowNumber}`

  return (
    <div
      className={`rounded-md border p-3 ${
        decided ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-background'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
            שורה {row.rowNumber}
          </span>
          <span className="text-muted-foreground">
            התאמה {MATCH_REASON_LABELS[row.matchReason] ?? row.matchReason}
          </span>
          {row.apartmentLabel && (
            <span className="text-muted-foreground">· {row.apartmentLabel}</span>
          )}
        </div>
        {decided && (
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            <RotateCcw size={13} className="ml-1" />
            בטל הכרעה
          </Button>
        )}
      </div>

      {/* The sheet's row, for comparison. */}
      <div className="mb-3 rounded border border-border bg-muted/40 p-2 text-sm">
        <p className="mb-1 text-xs font-medium text-muted-foreground">מהגיליון</p>
        <p className="font-medium">{row.imported.name || '—'}</p>
        <p className="text-xs text-muted-foreground">
          {[
            row.imported.phone,
            row.imported.email,
            row.imported.share ? `חלק ${row.imported.share}` : null,
            // Presence only — the digits never reach the browser.
            row.imported.hasNationalId ? 'כולל ת.ז.' : 'ללא ת.ז.',
          ].filter(Boolean).join(' · ')}
        </p>
      </div>

      <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Users size={13} />
        רשומות קיימות שעשויות להתאים
      </p>

      <div className="space-y-1.5">
        {row.candidates.map((c) => {
          const selected =
            current?.action === 'UPDATE_EXISTING' && current.targetEntityId === c.entityId
          return (
            <label
              key={c.entityId}
              className={`flex cursor-pointer items-start gap-2 rounded border p-2 text-sm ${
                selected ? 'border-sky-400 bg-sky-50' : 'border-border hover:bg-muted/40'
              }`}
            >
              <input
                type="radio"
                name={name}
                className="mt-1"
                checked={selected}
                onChange={() => onChange(row.rowNumber, 'UPDATE_EXISTING', c.entityId)}
              />
              <span>
                <span className="font-medium">{c.name ?? '—'}</span>
                {c.isActive === false && (
                  <span className="mr-1 text-xs text-muted-foreground">(לא פעיל)</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {[c.phone, c.email].filter(Boolean).join(' · ') || 'אין פרטי קשר'}
                </span>
              </span>
            </label>
          )
        })}

        {(['CREATE_NEW', 'SKIP'] as const).map((action) => (
          <label
            key={action}
            className={`flex cursor-pointer items-start gap-2 rounded border p-2 text-sm ${
              current?.action === action
                ? 'border-sky-400 bg-sky-50'
                : 'border-border hover:bg-muted/40'
            }`}
          >
            <input
              type="radio"
              name={name}
              className="mt-1"
              checked={current?.action === action}
              onChange={() => onChange(row.rowNumber, action)}
            />
            <span>
              <span className="font-medium">{DECISION_LABELS[action]}</span>
              <span className="block text-xs text-muted-foreground">
                {DECISION_HINTS[action]}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
