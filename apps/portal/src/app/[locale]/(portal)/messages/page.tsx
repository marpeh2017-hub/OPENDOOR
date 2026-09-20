import { redirect } from 'next/navigation'
import { MessageSquare, Bot, MessageCircle, Mail, Smartphone } from 'lucide-react'
import { apiGet, NotAuthenticated } from '@/lib/api'
import { formatDateTime } from '@/lib/dashboard'
import { CHANNEL_LABELS, type PortalMessages } from '@/lib/messages'

/**
 * Everything the project has actually said to this resident.
 *
 * ── THREE THINGS THE MOCK PROMISED THAT DO NOT EXIST ────────────────────────
 *
 *   1. A REPLY BOX. Nothing in the system writes an inbound message; a resident
 *      has no way to send one and nobody would receive it. A box that silently
 *      discards what somebody types is worse than no box.
 *   2. READ / UNREAD. `Message.readAt` is never written, and
 *      `MessageStatus.READ` is a carrier's read receipt, not "opened it in the
 *      portal". Inventing it here would create a record that the resident had
 *      seen something — and "the resident was informed" is a claim that gets
 *      made in front of a lawyer in a pinuy-binuy dispute. Not a flag to
 *      fabricate for a nicer-looking list.
 *   3. ANNOUNCEMENT / PERSONAL / SYSTEM types. `Message` has no such
 *      classification, and grouping by an invented taxonomy would put messages
 *      in categories the people who sent them never chose.
 *
 * What the page does say is what the system genuinely knows: what was sent,
 * when it left, how it was delivered, and whether a person or a rule sent it.
 */
export const dynamic = 'force-dynamic'

const CHANNEL_ICONS: Record<string, typeof MessageSquare> = {
  SMS: Smartphone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  PORTAL: MessageSquare,
}

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  let data: PortalMessages
  try {
    data = await apiGet<PortalMessages>('portal/messages')
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      redirect(`/${locale}/login${err.code ? `?reason=${err.code}` : ''}`)
    }
    throw err
  }

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-800">הודעות</h1>
        <p className="text-sm text-gray-500">
          {data.total > 0
            ? `${data.total} הודעות מ${data.from}`
            : 'הודעות שנשלחו אליך מצוות הפרויקט'}
        </p>
      </div>

      {data.messages.length === 0 ? (
        <div className="card-surface p-8 text-center">
          <MessageSquare size={28} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">אין עדיין הודעות</p>
          <p className="mt-1 text-xs text-gray-500">
            כשצוות הפרויקט ישלח לך הודעה, היא תופיע כאן.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.messages.map((m) => {
            const Icon = CHANNEL_ICONS[m.channel] ?? MessageSquare
            return (
              <li key={m.id} className="card-surface p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-teal-50">
                    <Icon size={16} className="text-teal-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {m.subject && (
                      <p className="text-sm font-semibold text-gray-800">{m.subject}</p>
                    )}
                    {/* The full body, not a preview. This page IS the resident's
                        record of what they were told — truncating it would make
                        them go looking for the original somewhere else.

                        `break-words` is load-bearing: real messages carry
                        meeting invitation links, and a 64-character token has no
                        break opportunity in it. Without this the URL pushes the
                        whole page sideways on a phone. */}
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
                      {m.body}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span>{formatDateTime(m.sentAt)}</span>
                      <span aria-hidden>·</span>
                      <span>{CHANNEL_LABELS[m.channel] ?? m.channel}</span>
                      {m.automated && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="flex items-center gap-1" title="נשלח אוטומטית">
                            <Bot size={11} />
                            אוטומטי
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {data.nextCursor && (
        // Deliberately plain: the endpoint pages, and wiring a "load more"
        // button needs a client component. Saying the list is truncated is
        // honest; silently showing 30 of 200 is not.
        <p className="text-center text-xs text-gray-400">
          מוצגות {data.messages.length} ההודעות האחרונות מתוך {data.total}
        </p>
      )}
    </div>
  )
}
