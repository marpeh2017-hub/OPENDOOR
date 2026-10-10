'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useUploadDocument } from '@/hooks/use-documents'
import { usePaperSignature, type FormRecordRow } from '@/hooks/use-forms'

/**
 * Records an owner who signed the printed form. Staff copy the row as it was
 * written on paper and attach the scan; the scan is filed in the project's
 * documents, and the row joins the combined document as "נחתם ידנית".
 */
export function PaperSignatureDialog({
  formId,
  projectId,
  row,
  onClose,
}: {
  formId: string
  projectId: string
  row: FormRecordRow
  onClose: () => void
}) {
  const upload = useUploadDocument()
  const paper = usePaperSignature(formId)
  const [fullName, setFullName] = useState(row.ownerName)
  const [idNumber, setIdNumber] = useState('')
  const [signedDate, setSignedDate] = useState(new Date().toISOString().slice(0, 10))
  const [file, setFile] = useState<File | null>(null)

  const pending = upload.isPending || paper.isPending
  const error = upload.error ?? paper.error

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    const document = await upload.mutateAsync({
      file,
      title: `פרוטוקול מינוי נציגות, חתום ידנית: ${row.ownerName}, דירה ${row.apartmentNumber}`,
      category: 'MEETING_MINUTES',
      projectId,
    })
    await paper.mutateAsync({
      recordId: row.recordId,
      fullName,
      idNumber: idNumber || undefined,
      signedDate,
      documentId: document.id,
    })
    onClose()
  }

  const inputClass =
    'w-full min-h-11 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose() }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">חתימה ידנית · דירה {row.apartmentNumber}</DialogTitle>
          <DialogDescription className="text-right">
            רושמים את השורה כפי שנכתבה בטופס המודפס ומצרפים את הסריקה.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="paper-name" className="text-sm font-semibold">שם מלא</label>
            <input id="paper-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} required maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="paper-id" className="text-sm font-semibold">מספר תעודת זהות</label>
            <input
              id="paper-id"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              inputMode="numeric"
              dir="ltr"
              className={inputClass}
              maxLength={12}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="paper-date" className="text-sm font-semibold">תאריך החתימה</label>
            <input id="paper-date" type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className={inputClass} required />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="paper-file" className="text-sm font-semibold">הטופס החתום (סריקה או צילום)</label>
            <input
              id="paper-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:me-3 file:min-h-11 file:rounded-md file:border-0 file:bg-teal-50 file:px-4 file:text-sm file:font-semibold file:text-teal-800"
              required
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error instanceof Error ? error.message : 'הפעולה נכשלה'}
            </p>
          )}
          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="submit" disabled={!file || pending}>
              {pending ? 'שומר…' : 'שמירה'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
