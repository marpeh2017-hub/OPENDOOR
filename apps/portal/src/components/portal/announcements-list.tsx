import { Megaphone, ChevronLeft } from 'lucide-react'
import type { Dashboard } from '@/lib/dashboard'
import { formatDate } from '@/lib/dashboard'

/**
 * What the project has actually sent this resident.
 *
 * The mock implied an announcements feed. There is no announcement model in the
 * schema — `Notification` belongs to staff users — so this shows the real
 * messages sent to this resident, and only those the system confirms were
 * handed over: a queued or failed SMS never reached them, and listing it here
 * would tell them they had been informed of something they never received.
 */
export function AnnouncementsList({ messages }: { messages: Dashboard['messages'] }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">הודעות</h3>
        {messages.length > 0 && (
          <a href="/messages" className="flex items-center gap-1 text-xs text-teal-500 hover:text-teal-600">
            הכל <ChevronLeft size={12} />
          </a>
        )}
      </div>

      {messages.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
          אין הודעות חדשות
        </p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="flex items-start gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5">
              <Megaphone size={15} className="flex-shrink-0 text-teal-400 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gray-700">{m.title}</p>
                <p className="text-xs text-gray-400">{formatDate(m.sentAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
