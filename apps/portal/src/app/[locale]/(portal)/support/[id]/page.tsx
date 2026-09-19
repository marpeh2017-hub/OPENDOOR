import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { apiGet, NotAuthenticated, NotFound } from '@/lib/api'
import { formatDateTime } from '@/lib/dashboard'
import { TicketReplyForm } from '@/components/portal/ticket-reply-form'
import {
  TICKET_CATEGORIES, TICKET_STATUS_CLASSES, TICKET_STATUS_LABELS,
  type SupportTicketDetail,
} from '@/lib/support'

/**
 * One support conversation.
 *
 * The id in the path is checked at the gateway INSIDE a query already scoped to
 * the session, so a ticket belonging to a co-resident — the sibling who shares
 * this apartment — is a 404 rather than a permission decision. Nothing on this
 * page re-derives that.
 *
 * Internal staff replies are filtered server-side and never arrive here.
 */
export const dynamic = 'force-dynamic'

export default async function TicketPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params

  let ticket: SupportTicketDetail
  try {
    ticket = await apiGet<SupportTicketDetail>(`portal/support/${encodeURIComponent(id)}`)
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      redirect(`/${locale}/login${err.code ? `?reason=${err.code}` : ''}`)
    }
    // A ticket that is not theirs and a ticket that does not exist are the same
    // answer here, as they are at the gateway.
    if (err instanceof NotFound) notFound()
    throw err
  }

  return (
    <div className="space-y-4 pb-10">
      <Link
        href={`/${locale}/support`}
        className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700"
      >
        <ArrowRight size={14} />
        חזרה לפניות
      </Link>

      <div className="card-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-base font-bold text-gray-800">{ticket.subject}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            TICKET_STATUS_CLASSES[ticket.status] ?? 'bg-gray-100 text-gray-600'
          }`}>
            {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {ticket.category && `${TICKET_CATEGORIES[ticket.category] ?? ticket.category} · `}
          נפתחה {formatDateTime(ticket.createdAt)}
        </p>
        <p className="mt-3 whitespace-pre-wrap break-words border-t border-border pt-3 text-sm leading-relaxed text-gray-700">
          {ticket.description}
        </p>
      </div>

      {ticket.replies.length > 0 && (
        <ul className="space-y-3">
          {ticket.replies.map((r) => (
            <li
              key={r.id}
              className={`card-surface p-4 ${r.fromResident ? '' : 'border-r-2 border-r-teal-400'}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-gray-800">
                  {r.fromResident ? 'את/ה' : r.authorName}
                </p>
                <p className="text-xs text-gray-400">{formatDateTime(r.createdAt)}</p>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
                {r.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {ticket.canReply ? (
        <TicketReplyForm ticketId={ticket.id} />
      ) : (
        <div className="card-surface flex items-start gap-3 p-4">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">הפנייה נסגרה</p>
            <p className="mt-0.5 text-xs text-gray-500">
              אם העניין עדיין לא נפתר, אפשר לפתוח פנייה חדשה.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
