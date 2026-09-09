import { CalendarDays, MapPin, Video } from 'lucide-react'
import type { Dashboard } from '@/lib/dashboard'
import { formatDateTime } from '@/lib/dashboard'

/**
 * Meetings this resident is invited to, still ahead of them.
 *
 * New to the dashboard. Meetings were already in the database, already had
 * resident attendees, and already sent invitations by SMS — the one place the
 * resident could not see them was the resident portal.
 *
 * RSVP is deliberately display-only here: answering an invitation currently
 * happens through a tokenised link, and whether that moves into the
 * authenticated session is a decision still to be taken.
 */
export function MeetingsCard({ meetings }: { meetings: Dashboard['meetings'] }) {
  if (meetings.length === 0) return null

  return (
    <div className="card-surface p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">פגישות קרובות</h3>
      <ul className="space-y-2">
        {meetings.map((m) => (
          <li key={m.id} className="flex items-start gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5">
            <CalendarDays size={15} className="flex-shrink-0 text-teal-400 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-700">{m.title}</p>
              <p className="flex items-center gap-1 text-xs text-gray-400">
                {formatDateTime(m.startTime)}
                {m.isVirtual
                  ? <><Video size={11} className="ms-1" /> מקוון</>
                  : m.location && <><MapPin size={11} className="ms-1" /> {m.location}</>}
              </p>
            </div>
            {m.rsvpStatus === 'accepted' && (
              <span className="flex-shrink-0 text-xs font-medium text-success-600">אישרת</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
