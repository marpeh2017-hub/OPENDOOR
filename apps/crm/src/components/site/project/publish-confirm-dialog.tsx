'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Globe, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

/**
 * The confirmation that stands between a click and a live website.
 *
 * ── WHY A SEPARATE DIALOG, NOT A SECOND SERVER STEP ────────────────────────
 *
 * Publication Check is the real safety mechanism — it already blocks on a
 * verification problem or a data-quality flag, and the server enforces it
 * regardless of what this dialog does. This component is a UX layer only,
 * for the failure that check cannot catch: a correct, unblocked publish that
 * nobody meant to click yet. A second server round-trip would duplicate
 * Publication Check without adding safety a client-side pause does not
 * already give.
 *
 * ── WHY CANCEL GETS THE INITIAL FOCUS ───────────────────────────────────────
 *
 * The key press that opened this dialog (Enter or Space on the trigger) is
 * finished by the time the dialog mounts — a new element, a new focus target,
 * a separate event. But the NEXT accidental key press must land somewhere
 * safe, and only intent should reach the confirm button. Radix's
 * `onOpenAutoFocus` normally focuses the dialog's first focusable descendant,
 * which would be the confirm button here; overriding it to focus Cancel is
 * the one line that makes "safer action is the default" literally true.
 *
 * ── WHY FOCUS-RETURN IS HANDLED HERE, NOT LEFT TO RADIX ────────────────────
 *
 * Radix restores focus to the trigger automatically only when that trigger is
 * a `Dialog.Trigger`. These dialogs are CONTROLLED — the surrounding toolbar
 * needs the trigger's own `disabled`/busy state, which `Dialog.Trigger`
 * cannot express — so no such trigger is registered, and without one the
 * close-focus target is unreliable in practice. The element with focus when
 * `open` turns true is captured directly and restored on close instead;
 * `onCloseAutoFocus` cancels Radix's own attempt so the two never race.
 */
export function PublishConfirmDialog({
  open, onOpenChange, onConfirm, targetName, busy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** The project or page name, so nobody confirms the wrong item. */
  targetName: string
  busy: boolean
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) returnFocusRef.current = document.activeElement as HTMLElement | null
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        aria-modal="true"
        onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus() }}
        onCloseAutoFocus={(e) => { e.preventDefault(); returnFocusRef.current?.focus() }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe size={18} className="text-teal-700" aria-hidden="true" />
            פרסום "{targetName}" לאתר
          </DialogTitle>
          <DialogDescription className="pt-1 text-[13.5px] leading-relaxed">
            הפעולה תעלה את ההקרנה הציבורית הנוכחית לאתר החי. מרגע זה, מי שיגיע
            לעמוד יראה את התוכן הזה. הפעולה הפוכה זמינה תמיד דרך הסרה מהאתר.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            פרסום באתר
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The withdrawal side. Reversible, and says so plainly. */
export function UnpublishConfirmDialog({
  open, onOpenChange, onConfirm, targetName, busy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  targetName: string
  busy: boolean
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) returnFocusRef.current = document.activeElement as HTMLElement | null
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        aria-modal="true"
        onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus() }}
        onCloseAutoFocus={(e) => { e.preventDefault(); returnFocusRef.current?.focus() }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-gray-700" aria-hidden="true" />
            הסרת "{targetName}" מהאתר
          </DialogTitle>
          <DialogDescription className="pt-1 text-[13.5px] leading-relaxed">
            התוכן יפסיק להופיע באתר הציבורי. הטיוטה, ההיסטוריה ורשומות
            הפרסום נשארות במערכת במלואן ואינן נמחקות. אפשר לפרסם שוב בכל עת.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            הסרה מהאתר
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
