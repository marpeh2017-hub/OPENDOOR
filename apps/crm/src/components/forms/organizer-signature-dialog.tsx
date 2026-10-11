'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useOrganizerSignature } from '@/hooks/use-forms'
import { SignaturePad } from './signature-pad'

/**
 * The company signs the organizing agreement on the organiser's line: once,
 * drawn by a staff member who manages forms. It appears in the combined
 * document beside today's date, and cannot be redrawn.
 */
export function OrganizerSignatureDialog({ formId, onClose }: { formId: string; onClose: () => void }) {
  const sign = useOrganizerSignature(formId)
  const [signature, setSignature] = useState<string | null>(null)

  async function submit() {
    if (!signature) return
    await sign.mutateAsync(signature)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !sign.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">חתימת המארגן על ההסכם</DialogTitle>
          <DialogDescription className="text-right">
            החתימה נכנסת לשורת ״המארגן״ במסמך המאוחד, עם התאריך של היום. חותמים פעם אחת, ואי אפשר לשנות אחר כך.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="organizer-signature" className="block text-sm font-semibold text-foreground">
            חתימה
          </label>
          <SignaturePad id="organizer-signature" describedBy="organizer-signature-help" onChange={setSignature} />
          <p id="organizer-signature-help" className="text-xs text-muted-foreground">
            חותמים כאן בעכבר, באצבע או בעט.
          </p>
        </div>
        {sign.error && (
          <p role="alert" className="text-sm text-red-700">
            {sign.error instanceof Error ? sign.error.message : 'החתימה לא נשמרה'}
          </p>
        )}
        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" onClick={submit} disabled={!signature || sign.isPending}>
            {sign.isPending ? 'שומר…' : 'חתימה'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={sign.isPending}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
