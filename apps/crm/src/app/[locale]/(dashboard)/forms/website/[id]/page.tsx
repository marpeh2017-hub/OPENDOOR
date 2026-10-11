'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Copy, Lock, MessageCircle, ShieldAlert, Unlock } from 'lucide-react'
import { protocolPreparedBy } from '@urban-renewal/api-contracts'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { useSetWebsiteFormStatus, useWebsiteForm } from '@/hooks/use-website-forms'
import { ProtocolView } from '@/components/forms/protocol-view'
import { PrintButton } from '@/components/forms/print-button'
import { WebsiteFormStatusBadge } from '@/components/forms/form-status'

/** Lead.status in words, as the leads board shows it. */
const LEAD_STAGES: Record<string, string> = {
  NEW: 'ליד חדש',
  CONTACTED: 'נוצר קשר',
  MEETING_SCHEDULED: 'נקבעה פגישה',
  INTERESTED: 'מתעניין',
  NEGOTIATION: 'משא ומתן',
  SIGNED: 'נחתם',
  LOST: 'אבד',
}

/**
 * A protocol an owner started on the website: who started it (also a lead),
 * the neighbours' link, and the document with every row signed so far. The
 * rows were signed through a shared link with no identity check, so the page
 * says so twice: above the document for staff, and on the document itself,
 * where it prints.
 */
export default function WebsiteFormPage() {
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const { data: form, isLoading, error } = useWebsiteForm(id)
  const setStatus = useSetWebsiteFormStatus(id)
  const [notice, setNotice] = useState<string | null>(null)

  if (isLoading) return <p className="text-sm text-muted-foreground">טוען…</p>
  if (error || !form) {
    const forbidden = error instanceof ApiError && error.status === 403
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-700">
          {forbidden
            ? 'הטופס כולל מספרי זהות, ופתוח רק לתפקידים שמנהלים חתימות.'
            : error instanceof Error
              ? error.message
              : 'הטופס לא נמצא'}
        </p>
        <Link href={`/${locale}/forms`} className="text-sm font-medium text-teal-700 hover:underline">
          חזרה לטפסים
        </Link>
      </div>
    )
  }

  const title = form.meeting.compoundName
  const initiator = form.rows.find((row) => row.isInitiator) ?? null
  const shareText = `שלום, בעלי דירות ב${title} התחילו לבחור נציגות לבניין. לקריאת פרוטוקול מינוי הנציגות ולהוספת החתימה שלכם:`
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${form.shareUrl}`)}`

  async function copyLink() {
    setNotice(null)
    try {
      await navigator.clipboard.writeText(form!.shareUrl)
      setNotice('הקישור לשכנים הועתק.')
    } catch {
      window.prompt('העתיקו את הקישור:', form!.shareUrl)
    }
  }

  async function toggleLink() {
    setNotice(null)
    const next = form!.status === 'OPEN' ? 'CLOSED' : 'OPEN'
    await setStatus.mutateAsync(next)
    setNotice(next === 'CLOSED' ? 'הקישור נסגר. מי שיפתח אותו יראה שהחתימה נסגרה.' : 'הקישור פתוח שוב לחתימה.')
  }

  return (
    <div className="space-y-6">
      <nav aria-label="מסלול ניווט" className="text-sm text-muted-foreground print:hidden">
        <Link href={`/${locale}/forms`} className="font-medium text-teal-700 hover:underline">
          טפסים
        </Link>
        <span aria-hidden="true"> › </span>
        <span>התחילו באתר · {title}</span>
      </nav>

      <div className="page-header print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title} · פרוטוקול מינוי נציגות</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>התחיל באתר ב־{new Date(form.createdAt).toLocaleDateString('he-IL')}</span>
            <span aria-hidden="true">·</span>
            <span>חתמו {form.rows.length}</span>
            <WebsiteFormStatusBadge status={form.status} />
          </p>
        </div>
        <PrintButton />
      </div>

      <div role="note" className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
        <ShieldAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        <p>
          החתימות נאספו באתר בקישור משותף, בלי אימות זהות. לפני שמסתמכים על הפרוטוקול, יש לאמת את הבעלות של כל
          חותם מול נסח הטאבו.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 print:hidden">
        <section aria-labelledby="initiator-heading" className="card-surface space-y-2 p-5 text-sm">
          <h2 id="initiator-heading" className="font-semibold text-foreground">
            מי התחיל
          </h2>
          {initiator && (
            <p className="text-foreground">
              {initiator.fullName} · דירה {initiator.apartmentNumber}
            </p>
          )}
          {initiator?.phone && (
            <p>
              <a href={`tel:${initiator.phone}`} dir="ltr" className="font-medium text-teal-700 hover:underline">
                {initiator.phone}
              </a>
            </p>
          )}
          {initiator?.email && (
            <p>
              <a href={`mailto:${initiator.email}`} dir="ltr" className="font-medium text-teal-700 hover:underline">
                {initiator.email}
              </a>
            </p>
          )}
          {form.lead && (
            <p className="text-muted-foreground">
              בלוח הלידים: {LEAD_STAGES[form.lead.status] ?? form.lead.status} ·{' '}
              <Link href={`/${locale}/leads`} className="font-medium text-teal-700 hover:underline">
                ללוח הלידים
              </Link>
            </p>
          )}
        </section>

        <section aria-labelledby="link-heading" className="card-surface space-y-3 p-5 text-sm">
          <h2 id="link-heading" className="font-semibold text-foreground">
            הקישור לשכנים
          </h2>
          <p dir="ltr" className="break-all rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-800">
            {form.shareUrl}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={copyLink}>
              <Copy size={14} aria-hidden="true" />
              העתקת הקישור
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={14} aria-hidden="true" />
                שליחה בווטסאפ
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={toggleLink}
              disabled={setStatus.isPending}
            >
              {form.status === 'OPEN' ? <Lock size={14} aria-hidden="true" /> : <Unlock size={14} aria-hidden="true" />}
              {form.status === 'OPEN' ? 'סגירת הקישור' : 'פתיחה מחדש'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {form.status === 'OPEN'
              ? 'כל מי שיש לו את הקישור יכול לחתום. סוגרים כשהנציגות התגבשה.'
              : 'הקישור סגור: מי שפותח אותו רואה שהחתימה נסגרה.'}
          </p>
        </section>
      </div>

      {notice && (
        <p role="status" className="rounded-md bg-teal-50 px-4 py-3 text-sm text-teal-900 print:hidden">
          {notice}
        </p>
      )}
      {setStatus.error && (
        <p role="alert" className="text-sm text-red-700 print:hidden">
          {setStatus.error instanceof Error ? setStatus.error.message : 'הפעולה לא הושלמה'}
        </p>
      )}

      <ProtocolView
        titleLevel={2}
        text={form.text}
        meeting={form.meeting}
        members={form.members}
        rows={form.rows}
        preparedBy={protocolPreparedBy(form.text, form.preparerIdNumber ?? undefined)}
        verification={
          <p>
            <strong>אישור מערכת (נוסף לפרוטוקול, אינו חלק מנוסחו): </strong>
            הפרוטוקול התחיל באתר. כל חתימה בטבלה נחתמה בקישור משותף שהועבר בין בעלי הדירות, בלי אימות זהות, ונשמר
            לה מועד החתימה. יש לאמת את הבעלות של החותמים מול נסח הטאבו. חתמו {form.rows.length} בעלי דירות.
          </p>
        }
      />
    </div>
  )
}
