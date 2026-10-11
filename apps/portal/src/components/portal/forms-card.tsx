import Link from 'next/link'
import { CalendarDays, CheckCircle2, FileSignature } from 'lucide-react'
import type { PortalFormItem } from '@/lib/forms'
import { formatDate } from '@/lib/dashboard'

/**
 * The resident's forms on the home screen. A form waiting for their
 * signature leads the card ("ממתין לחתימה שלך") with the way to sign; a
 * notice of an assembly has its own card, to read (through the personal
 * link, so the company sees it arrived); a signed one links to their copy.
 * Nothing shows when there are no forms.
 */
export function FormsCard({ forms, locale }: { forms: PortalFormItem[]; locale: string }) {
  if (forms.length === 0) return null
  const pending = forms.filter((f) => f.status === 'PENDING' && f.signPath)
  const notices = forms.filter((f) => f.status === 'NOTICE' && f.signPath)
  const done = forms.filter((f) => f.status === 'SIGNED' || f.status === 'CLOSED')

  return (
    <div className="space-y-3">
      {pending.map((form) => (
        <section
          key={form.packageId}
          aria-labelledby={`form-${form.packageId}`}
          className="card-surface border-2 border-teal-200 p-5"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <FileSignature size={22} />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold text-teal-800">ממתין לחתימה שלך</p>
              <h2 id={`form-${form.packageId}`} className="text-sm font-bold leading-snug text-gray-800">
                {form.title}
              </h2>
              <p className="text-xs text-gray-600">
                {form.sentAt ? `נשלח אליכם ב-${formatDate(form.sentAt)}. ` : ''}
                קריאה, מילוי הפרטים וחתימה, בכמה דקות.
              </p>
            </div>
          </div>
          <Link
            href={`/${locale}${form.signPath}`}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 hover:text-white"
          >
            לקריאה וחתימה
          </Link>
        </section>
      ))}

      {notices.map((form) => (
        <section
          key={form.packageId}
          aria-labelledby={`notice-${form.packageId}`}
          className="card-surface border-2 border-teal-200 p-5"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <CalendarDays size={22} />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold text-teal-800">הודעה לבעלי הדירות</p>
              <h2 id={`notice-${form.packageId}`} className="text-sm font-bold leading-snug text-gray-800">
                {form.title}
              </h2>
              {form.sentAt && <p className="text-xs text-gray-600">נשלחה אליכם ב-{formatDate(form.sentAt)}.</p>}
            </div>
          </div>
          <Link
            href={`/${locale}${form.signPath}`}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 hover:text-white"
          >
            לקריאת ההודעה
          </Link>
        </section>
      ))}

      {done.length > 0 && (
        <section aria-labelledby="signed-forms" className="card-surface p-5">
          <h2 id="signed-forms" className="text-sm font-semibold text-gray-700">
            הטפסים שלי
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {done.map((form) => (
              <li key={form.packageId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <CheckCircle2 size={17} className="shrink-0 text-success-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-800">{form.title}</span>
                    <span className="block text-xs text-gray-500">
                      {form.status === 'SIGNED' && form.signedAt ? `חתמתם ב-${formatDate(form.signedAt)}` : 'הטופס נסגר'}
                    </span>
                  </span>
                </span>
                {form.status === 'SIGNED' && (
                  <Link
                    href={`/${locale}/forms/${form.packageId}`}
                    className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-teal-700 hover:underline"
                  >
                    {form.isRepresentative ? 'המסמך המאוחד' : 'העותק שלי'}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
