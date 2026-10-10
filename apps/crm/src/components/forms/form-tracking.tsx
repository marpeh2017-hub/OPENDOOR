'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BellRing, FileText, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  useCancelForm,
  useRemind,
  useRemindAll,
  type FormDetail,
  type FormRecordRow,
} from '@/hooks/use-forms'
import { FormStatusBadge } from './form-status'
import { PaperSignatureDialog } from './paper-signature-dialog'

type Filter = 'all' | 'signed' | 'unsigned'

const DELIVERED: Record<string, string> = {
  SMS: 'SMS',
  EMAIL: 'אימייל',
  NONE: 'אין טלפון ואימייל',
  FAILED: 'השליחה נכשלה',
}

/** A reminder goes to each owner at most once in this window (the gateway's rule too). */
const REMINDER_GAP_MS = 20 * 60 * 60 * 1000

/**
 * A sent form, tracked to the last signature: progress by apartments and by
 * ownership share, the representation table, and a row per owner with how
 * their link went, whether they opened it, and when they signed. From here
 * staff remind, record a signature made on paper, and open the combined
 * document.
 */
export function FormTracking({ form, locale }: { form: FormDetail; locale: string }) {
  const router = useRouter()
  const remind = useRemind(form.id)
  const remindAll = useRemindAll(form.id)
  const cancel = useCancelForm(form.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [paperFor, setPaperFor] = useState<FormRecordRow | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const open = form.status === 'SENT' || form.status === 'PARTIALLY_SIGNED'
  const signed = form.records.filter((r) => r.status === 'SIGNED')
  const unsigned = form.records.filter((r) => r.status !== 'SIGNED')
  const rows = filter === 'signed' ? signed : filter === 'unsigned' ? unsigned : form.records
  const membersSigned = form.representatives.filter((m) => m.signed).length
  const { apartments, apartmentsSigned, sharePercent } = form.progress

  async function remindEveryone() {
    setNotice(null)
    const result = await remindAll.mutateAsync()
    const parts = [`נשלחו ${result.sent} תזכורות`]
    if (result.skippedRecent) parts.push(`${result.skippedRecent} קיבלו תזכורת ב-24 השעות האחרונות`)
    if (result.noChannel) parts.push(`${result.noChannel} בלי טלפון ואימייל`)
    if (result.failed) parts.push(`${result.failed} נכשלו`)
    setNotice(parts.join(' · '))
  }

  async function remindOne(row: FormRecordRow) {
    setNotice(null)
    const result = await remind.mutateAsync(row.recordId)
    setNotice(`נשלחה תזכורת ל${row.ownerName} ב-${DELIVERED[result.channel] ?? result.channel}`)
  }

  async function cancelForm() {
    await cancel.mutateAsync()
    router.push(`/${locale}/forms`)
  }

  return (
    <div className="space-y-6">
      <nav aria-label="מסלול ניווט" className="text-sm text-muted-foreground">
        <Link href={`/${locale}/forms`} className="font-medium text-teal-700 hover:underline">
          טפסים
        </Link>
        <span aria-hidden="true"> › </span>
        <span>
          פרוטוקול מינוי נציגות · {form.meeting.compoundName}
        </span>
      </nav>

      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {form.meeting.compoundName} · פרוטוקול מינוי נציגות
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {form.sentAt && <span>נשלח ב-{new Date(form.sentAt).toLocaleDateString('he-IL')}</span>}
            <FormStatusBadge status={form.status} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {open && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={remindEveryone}
              disabled={remindAll.isPending || unsigned.length === 0}
            >
              <BellRing size={16} aria-hidden="true" />
              תזכורת לכל מי שלא חתם
            </Button>
          )}
          <Button className="gap-2" asChild>
            <Link href={`/${locale}/forms/${form.id}/document`}>
              <FileText size={16} aria-hidden="true" />
              המסמך המאוחד (PDF)
            </Link>
          </Button>
        </div>
      </div>

      {(notice || remind.error || remindAll.error) && (
        <p
          role="status"
          className={`rounded-md px-3 py-2 text-sm ${remind.error || remindAll.error ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-teal-900'}`}
        >
          {remind.error instanceof Error
            ? remind.error.message
            : remindAll.error instanceof Error
              ? remindAll.error.message
              : notice}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-surface space-y-2 p-5">
          <p className="text-sm text-muted-foreground">חתמו</p>
          <p className="text-2xl font-bold text-foreground">
            {apartmentsSigned} <span className="text-base font-medium text-muted-foreground">מתוך {apartments} דירות</span>
          </p>
          <Progress
            value={apartments ? (apartmentsSigned / apartments) * 100 : 0}
            aria-label={`${apartmentsSigned} מתוך ${apartments} דירות חתמו`}
          />
        </div>
        <div className="card-surface space-y-2 p-5">
          <p className="text-sm text-muted-foreground">לפי חלקי הבעלות</p>
          <p className="text-2xl font-bold text-foreground">{sharePercent}%</p>
          <p className="text-xs text-muted-foreground">מחושב מהבעלות הרשומה בכל דירה</p>
        </div>
        <div className="card-surface space-y-2 p-5">
          <p className="text-sm text-muted-foreground">חברי הנציגות</p>
          <p className="text-2xl font-bold text-foreground">
            {membersSigned}{' '}
            <span className="text-base font-medium text-muted-foreground">
              מתוך {form.representatives.length} חתמו
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {form.representatives.map((m) => `${m.fullName} (${m.apartmentNumber})`).join(' · ')}
          </p>
        </div>
      </div>

      <section aria-labelledby="owners-heading" className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id="owners-heading" className="text-base font-bold text-foreground">
            בעלי הדירות
          </h2>
          <div role="tablist" aria-label="סינון" className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
            {(
              [
                ['all', `הכל · ${form.records.length}`],
                ['signed', `חתמו · ${signed.length}`],
                ['unsigned', `טרם חתמו · ${unsigned.length}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-9 rounded-md px-3 font-medium ${filter === value ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold">דירה</th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold">בעל/ת הדירה</th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold">נשלח ב</th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold">סטטוס</th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold">נחתם</th>
                <th scope="col" className="px-4 py-2.5 text-start font-semibold">
                  <span className="sr-only">פעולות</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.recordId}>
                  <td className="px-4 py-3 font-medium">{row.apartmentNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{row.ownerName}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {[row.phone, row.email].filter(Boolean).join(' · ')}
                    </p>
                  </td>
                  <td className="px-4 py-3">{row.deliveredVia ? DELIVERED[row.deliveredVia] : '—'}</td>
                  <td className="px-4 py-3">
                    {statusOf(row)}
                    {row.idMismatch && (
                      <span className="ms-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        ת.ז שונה מהתיק
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.signedAt ? new Date(row.signedAt).toLocaleDateString('he-IL') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      row={row}
                      open={open}
                      reminding={remind.isPending && remind.variables === row.recordId}
                      onRemind={() => remindOne(row)}
                      onPaper={() => setPaperFor(row)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          כל דייר רואה באזור האישי רק את השורה שלו. ת.ז, טלפון ואימייל של כולם מופיעים רק כאן ובמסמך המאוחד,
          שנמסר גם לחברי הנציגות.
        </p>
      </section>

      {open && (
        <div>
          <Button
            variant="ghost"
            className="gap-2 text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={() => setConfirmCancel(true)}
          >
            <XCircle size={15} aria-hidden="true" />
            ביטול הטופס
          </Button>
        </div>
      )}

      {paperFor && (
        <PaperSignatureDialog
          formId={form.id}
          projectId={form.project?.id ?? ''}
          row={paperFor}
          onClose={() => setPaperFor(null)}
        />
      )}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="לבטל את הטופס?"
        description="הקישורים שנשלחו יפסיקו לעבוד, והחתימות שכבר נאספו יישמרו בתיעוד בלבד. אי אפשר לבטל את הביטול."
        confirmLabel="ביטול הטופס"
        cancelLabel="חזרה"
        destructive
        pending={cancel.isPending}
        error={cancel.error}
        onConfirm={cancelForm}
      />
    </div>
  )
}

function statusOf(row: FormRecordRow): string {
  if (row.status === 'SIGNED') {
    const how = row.method === 'WET' ? 'נחתם ידנית' : 'חתם/ה'
    return row.isRepresentative ? `${how} · גם כנציגות` : how
  }
  if (row.deliveredVia === 'NONE') return 'להחתמה ידנית'
  if (row.openedAt) return 'פתח/ה, טרם חתם/ה'
  return 'נשלח'
}

function RowActions({
  row,
  open,
  reminding,
  onRemind,
  onPaper,
}: {
  row: FormRecordRow
  open: boolean
  reminding: boolean
  onRemind: () => void
  onPaper: () => void
}) {
  if (row.status === 'SIGNED' || !open) return null
  const remindedRecently = row.lastReminderAt && Date.now() - new Date(row.lastReminderAt).getTime() < REMINDER_GAP_MS
  const canRemind = row.deliveredVia !== 'NONE' && (row.phone || row.email)
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canRemind && (
        <Button variant="outline" size="sm" onClick={onRemind} disabled={Boolean(remindedRecently) || reminding}>
          {remindedRecently ? 'נשלחה תזכורת היום' : reminding ? 'שולח…' : 'תזכורת'}
        </Button>
      )}
      <Button variant={canRemind ? 'ghost' : 'outline'} size="sm" className="gap-1.5" onClick={onPaper}>
        <Upload size={14} aria-hidden="true" />
        העלאת טופס חתום
      </Button>
    </div>
  )
}
