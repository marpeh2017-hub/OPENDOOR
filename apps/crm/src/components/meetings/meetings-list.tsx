'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, MapPin, Video, Users, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import { useCanWriteMeetings } from '@/hooks/use-auth'
import { MeetingDialog } from './meeting-dialog'
import {
  useMeetings, MEETING_STATUSES, MEETING_STATUS_LABELS,
  type MeetingStatus, type Meeting,
} from '@/hooks/use-meetings'

const STATUS_STYLE: Record<MeetingStatus, string> = {
  scheduled: 'bg-teal-50 text-teal-700 border-teal-200',
  completed: 'bg-gray-100 text-gray-700 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'full', timeStyle: 'short',
  }).format(new Date(iso))
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const attendeeCount = meeting.attendees.length
  const accepted = meeting.attendees.filter((a) => a.rsvpStatus === 'accepted').length

  return (
    <li>
      <Link
        href={`/meetings/${meeting.id}`}
        className="block rounded-lg border border-border p-4 transition-colors hover:border-teal-300 hover:bg-teal-50/20"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={cn(
              'truncate font-semibold text-foreground',
              meeting.status === 'cancelled' && 'line-through decoration-red-400',
            )}>
              {meeting.title}
            </h3>
            {meeting.project && (
              <p className="text-xs text-muted-foreground">{meeting.project.name}</p>
            )}
          </div>
          <span className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-xs',
            STATUS_STYLE[meeting.status],
          )}>
            {MEETING_STATUS_LABELS[meeting.status]}
          </span>
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={13} aria-hidden />
            <dt className="sr-only">מועד</dt>
            <dd>
              <time dateTime={meeting.startTime}>{formatWhen(meeting.startTime)}</time>
            </dd>
          </div>
          {meeting.isVirtual ? (
            <div className="flex items-center gap-1.5">
              <Video size={13} aria-hidden />
              <dt className="sr-only">סוג</dt>
              <dd>פגישה מקוונת</dd>
            </div>
          ) : meeting.location ? (
            <div className="flex items-center gap-1.5">
              <MapPin size={13} aria-hidden />
              <dt className="sr-only">מיקום</dt>
              <dd>{meeting.location}</dd>
            </div>
          ) : null}
          {attendeeCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Users size={13} aria-hidden />
              <dt className="sr-only">משתתפים</dt>
              {/* accepted-of-total, because "5 invited" says nothing about turnout */}
              <dd>{accepted} מתוך {attendeeCount} אישרו</dd>
            </div>
          )}
        </dl>
      </Link>
    </li>
  )
}

export function MeetingsList({ projectId }: { projectId?: string }) {
  const [status, setStatus] = useState<MeetingStatus | 'ALL'>('ALL')
  const [mineOnly, setMineOnly] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const canWrite = useCanWriteMeetings()

  const query = useMeetings({
    ...(projectId ? { projectId } : {}),
    ...(status === 'ALL' ? {} : { status }),
    ...(mineOnly ? { mineOnly: true } : {}),
    limit: 50,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5" role="tablist">
            {(['ALL', ...MEETING_STATUSES] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={status === s}
                onClick={() => setStatus(s as MeetingStatus | 'ALL')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  status === s
                    ? 'bg-teal-600 text-white'
                    : 'text-muted-foreground hover:bg-gray-100',
                )}
              >
                {s === 'ALL' ? 'הכול' : MEETING_STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              className="h-4 w-4"
            />
            רק פגישות שהוזמנתי אליהן
          </label>
        </div>

        {/*
          Hidden for read-only observers. The endpoint refuses them with 403
          regardless — this only removes a control that would always fail.
        */}
        {canWrite && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm text-white"
          >
            <Plus size={15} />
            פגישה חדשה
          </button>
        )}
      </div>

      {query.isPending && <RowsSkeleton rows={4} />}

      {query.isError && (
        <QueryError
          message="טעינת הפגישות נכשלה"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      )}

      {query.data && query.data.items.length === 0 && (
        <div className="card-surface">
          <EmptyState
            message={mineOnly ? 'לא הוזמנתם לפגישות' : 'אין פגישות'}
            hint={canWrite ? 'ניתן לקבוע פגישה חדשה בלחצן שלמעלה' : undefined}
          />
        </div>
      )}

      {query.data && query.data.items.length > 0 && (
        <ul className="space-y-3">
          {query.data.items.map((m) => <MeetingCard key={m.id} meeting={m} />)}
        </ul>
      )}

      <MeetingDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
