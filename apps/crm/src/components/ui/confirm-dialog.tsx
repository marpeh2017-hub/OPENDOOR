'use client'

import { Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

/**
 * Shared confirmation step for destructive or sensitive actions — archiving,
 * deactivating, role changes and every bulk write.
 *
 * This is a UX guard, not a security control. Each of these actions is also
 * RBAC-gated on the endpoint, which answers 403 whether or not this dialog was
 * shown.
 *
 * `error` is rendered inline rather than thrown away, so a rejected action
 * never fails silently: the dialog stays open with the server's message.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'אישור',
  cancelLabel  = 'ביטול',
  destructive  = false,
  pending      = false,
  error,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  pending?: boolean
  error?: unknown
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(n) => { if (!pending) onOpenChange(n) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            {destructive && <AlertTriangle size={17} className="text-red-600" />}
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-right">{description}</DialogDescription>
          )}
        </DialogHeader>

        {error != null && (
          <p className="text-sm text-red-600" role="alert">
            {error instanceof Error ? error.message : 'הפעולה נכשלה'}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending && <Loader2 size={15} className="animate-spin ml-1.5" />}
            {confirmLabel}
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
