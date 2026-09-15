import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Phone, MessageCircle, Mail, LifeBuoy, ChevronLeft, MessageSquare } from 'lucide-react'
import { apiGet, NotAuthenticated } from '@/lib/api'
import { formatDate } from '@/lib/dashboard'
import { NewTicketForm } from '@/components/portal/new-ticket-form'
import {
  TICKET_CATEGORIES, TICKET_STATUS_CLASSES, TICKET_STATUS_LABELS,
  type SupportOverview,
} from '@/lib/support'

/**
 * Support.
 *
 * ── THE FAQ THIS REPLACES ───────────────────────────────────────────────────
 *
 * The page shipped with five hard-coded answers, four of which made claims the
 * company would be held to: that the court threshold is 80% (the system's own
 * `signatureGoal` defaults to 67), that delivery is end-2027, that the new
 * apartment is at least 25% larger, and that the developer bears every
 * evacuation cost.
 *
 * A resident can rely on those. What is left comes from this project's own row,
 * per resident, and the contractual questions are gone rather than guessed at —
 * there is no CMS for portal content to hold a correct per-project answer. See
 * docs/PORTAL_SUPPORT_VISIBILITY.md.
 *
 * The phone number is also real now. The mock's 03-600-1234 was not a number
 * this company answers.
 */
export const dynamic = 'force-dynamic'

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  let data: SupportOverview
  try {
    data = await apiGet<SupportOverview>('portal/support')
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      redirect(`/${locale}/login${err.code ? `?reason=${err.code}` : ''}`)
    }
    throw err
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-800">תמיכה ועזרה</h1>
        <p className="text-sm text-gray-500">פנו אלינו בכל שאלה</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ContactTile
          href="tel:03-5098264"
          icon={Phone} label="התקשרו" sub="03-5098264"
          cls="text-teal-600" bg="bg-teal-50"
        />
        <ContactTile
          href="https://wa.me/9720548018613"
          icon={MessageCircle} label="WhatsApp" sub="054-8018613"
          cls="text-green-600" bg="bg-green-50" external
        />
        <ContactTile
          href="mailto:info@odg.co.il"
          icon={Mail} label="אימייל" sub="info@odg.co.il"
          cls="text-blue-600" bg="bg-blue-50"
        />
      </div>

      <NewTicketForm />

      <div className="card-surface overflow-hidden">
        <div className="border-b border-border bg-gray-50/50 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">הפניות שלי</h2>
        </div>
        {data.tickets.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <LifeBuoy size={26} className="mx-auto text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-700">אין פניות פתוחות</p>
            <p className="mt-1 text-xs text-gray-500">
              נשמח לעזור — פתחו פנייה ונחזור אליכם.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/${locale}/support/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{t.subject}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${
                        TICKET_STATUS_CLASSES[t.status] ?? 'bg-gray-100 text-gray-600'
                      }`}>
                        {TICKET_STATUS_LABELS[t.status] ?? t.status}
                      </span>
                      {t.category && <span>{TICKET_CATEGORIES[t.category] ?? t.category}</span>}
                      <span>{formatDate(t.updatedAt)}</span>
                      {t.replyCount > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare size={11} />
                          {t.replyCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronLeft size={15} className="flex-shrink-0 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.faq.length > 0 && (
        <div className="card-surface overflow-hidden">
          <div className="border-b border-border bg-gray-50/50 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">שאלות נפוצות</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              על פי הנתונים הרשומים בפרויקט שלך
            </p>
          </div>
          <div className="divide-y divide-border">
            {data.faq.map((item) => (
              <div key={item.source} className="px-4 py-4">
                <p className="text-sm font-medium text-gray-800">{item.question}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ContactTile({
  href, icon: Icon, label, sub, cls, bg, external,
}: {
  href: string
  icon: typeof Phone
  label: string
  sub: string
  cls: string
  bg: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="card-surface flex flex-col items-center gap-2 p-4 transition-colors hover:border-teal-200"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
        <Icon size={20} className={cls} />
      </div>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      <p className="text-xs text-gray-400" dir="ltr">{sub}</p>
    </a>
  )
}
