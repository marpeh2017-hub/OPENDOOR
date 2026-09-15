'use client'

import { useState } from 'react'
import {
  CalendarDays, MapPin, Video, Pencil, Ban, CheckCircle2, UserPlus, X,
  Check, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, RowsSkeleton } from '@/components/ui/query-states'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useCurrentUser, useCanWriteMeetings } from '@/hooks/use-auth'
import { useUsers } from '@/hooks/use-users'
import { MeetingDialog } from './meeting-dialog'
import {
  useMeeting, useCancelMeeting, useCompleteMeeting, useRsvp,
  useAddAttendees, useRemoveAttendee, useSetAttendance,
  MEETING_STATUS_LABELS, RSVP_STATUSES, RSVP_STATUS_LABELS,
  type MeetingAttendee, type RsvpStatus,
} from '@/hooks/use-meetings'

const RSVP_STYLE: Record<RsvpStatus, string> = {
  pending:   'bg-gray-100 text-gray-700',
  accepted:  'bg-green-50 text-green-700',
  declined:  'bg-red-50 text-red-700',
  tentative: 'bg-amber-50 text-amber-700',
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'full', timeStyle: 'short',
  }).format(new Date(iso))
}

function attendeeName(a: MeetingAttendee): string {
  if (a.user) return `${a.user.firstName} ${a.user.lastName}`
  if (a.resident) return `${a.resident.firstName} ${a.resident.lastName}`
  return 'משתתף'
}

export function MeetingDetail({ meetingId }: { meetingId: string }) {
  const query = useMeeting(meetingId)
  const me = useCurrentUser()
  const canWrite = useCanWriteMeetings()
  const users = useUsers()

  const cancel = useCancelMeeting()
  const complete = useCompleteMeeting()
  const rsvp = useRsvp()
  const addAttendees = useAddAttendees()
  const removeAttendee = useRemoveAttendee()
  const setAttendance = useSetAttendance()

  const [editOpen, setEditOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [inviteId, setInviteId] = useState('')

  if (query.isPending) return <RowsSkeleton rows={6} />
  if (query.isError) {
    return (
      <QueryError
        message="טעינת הפגישה נכשלה"
        error={query.error}
        onRetry={() => query.refetch()}
      />
    )
  }

  const meeting = query.data!
  const isCancelled = meeting.status === 'cancelled'
  const isPast = meeting.status === 'completed'

  /*
   * The caller's own attendee row, if they were invited. This is what gates the
   * RSVP panel — and it is the same rule the server enforces, which answers 404
   * to anyone who is not an invitee. Rendering the panel for a non-invitee
   * would just produce a button that always fails.
   */
  const myAttendance = meeting.attendees.find((a) => a.userId === me.data?.userId)

  /** Users not already on the roster — inviting an existing one is a no-op anyway. */
  const invitedUserIds = new Set(meeting.attendees.map((a) => a.userId).filter(Boolean))
  const invitable = (users.data ?? []).filter((u: any) => !invitedUserIds.has(u.id))

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground">{meeting.title}</h2>
            {meeting.project && (
              <p className="mt-0.5 text-sm text-muted-foreground">{meeting.project.name}</p>
            )}
          </div>

          {canWrite && !isCancelled && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                <Pencil size={14} /> עריכה
              </button>
              {!isPast && (
                <button
                  type="button"
                  onClick={() => complete.mutate({ id: meeting.id })}
                  disabled={complete.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  <CheckCircle2 size={14} /> סימון כהתקיימה
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700"
              >
                <Ban size={14} /> ביטול פגישה
              </button>
            </div>
          )}
        </div>

        {isCancelled && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="status">
            הפגישה בוטלה
            {meeting.cancelReason ? ` — ${meeting.cancelReason}` : ''}
          </div>
        )}

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-muted-foreground" aria-hidden />
            <dt className="sr-only">מועד</dt>
            <dd>
              <time dateTime={meeting.startTime}>{formatWhen(meeting.startTime)}</time>
              {meeting.endTime && (
                <>
                  {' – '}
                  <time dateTime={meeting.endTime}>
                    {new Intl.DateTimeFormat('he-IL', { timeStyle: 'short' })
                      .format(new Date(meeting.endTime))}
                  </time>
                </>
              )}
            </dd>
          </div>

          {meeting.isVirtual ? (
            <div className="flex items-center gap-2">
              <Video size={15} className="text-muted-foreground" aria-hidden />
              <dt className="sr-only">קישור</dt>
              <dd>
                {meeting.meetingUrl ? (
                  // Server-validated as http/https only. rel=noopener because it
                  // is an external destination opened in a new tab.
                  <a
                    href={meeting.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="text-teal-600 hover:underline"
                  >
                    {meeting.meetingUrl}
                  </a>
                ) : 'פגישה מקוונת'}
              </dd>
            </div>
          ) : meeting.location ? (
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-muted-foreground" aria-hidden />
              <dt className="sr-only">מיקום</dt>
              <dd>{meeting.location}</dd>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <dt className="text-muted-foreground">סטטוס:</dt>
            <dd>{MEETING_STATUS_LABELS[meeting.status]}</dd>
          </div>
        </dl>

        {meeting.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
            {meeting.description}
          </p>
        )}
        {meeting.notes && (
          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">סיכום</p>
            <p className="whitespace-pre-wrap text-sm">{meeting.notes}</p>
          </div>
        )}
      </div>

      {/* ── My RSVP ────────────────────────────────────────────── */}
      {myAttendance && !isCancelled && (
        <div className="card-surface p-5">
          <h3 className="mb-1 font-semibold text-foreground">התשובה שלכם</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            ניתן לענות רק על ההזמנה שלכם — לא בשם משתתף אחר.
          </p>
          <div className="flex flex-wrap gap-2">
            {RSVP_STATUSES.filter((s) => s !== 'pending').map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => rsvp.mutate({ id: meeting.id, rsvpStatus: s })}
                disabled={rsvp.isPending}
                aria-pressed={myAttendance.rsvpStatus === s}
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm transition-colors disabled:opacity-50',
                  myAttendance.rsvpStatus === s
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-border hover:bg-gray-50',
                )}
              >
                {RSVP_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {rsvp.isError && (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {rsvp.error instanceof Error ? rsvp.error.message : 'שמירת התשובה נכשלה'}
            </p>
          )}
        </div>
      )}

      {/* ── Attendees ──────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            משתתפים ({meeting.attendees.length})
          </h3>
        </div>

        {canWrite && !isCancelled && (
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div className="min-w-52 flex-1">
              <label htmlFor="invite-user" className="mb-1 block text-xs text-muted-foreground">
                הזמנת משתתף
              </label>
              <select
                id="invite-user"
                value={inviteId}
                onChange={(e) => setInviteId(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="">בחרו משתמש…</option>
                {invitable.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} — {u.email}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!inviteId || addAttendees.isPending}
              onClick={() => {
                addAttendees.mutate(
                  { id: meeting.id, attendees: [{ userId: inviteId, role: 'attendee' }] },
                  { onSuccess: () => setInviteId('') },
                )
              }}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              <UserPlus size={15} /> הזמנה
            </button>
          </div>
        )}

        {meeting.attendees.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            טרם הוזמנו משתתפים
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {meeting.attendees.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{attendeeName(a)}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.user?.email ?? a.resident?.phone ?? ''}
                    {a.residentId && ' · דייר'}
                  </p>
                </div>

                <span className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  RSVP_STYLE[a.rsvpStatus],
                )}>
                  {RSVP_STATUS_LABELS[a.rsvpStatus]}
                </span>

                {/*
                  Attendance is separate from RSVP on purpose: someone can accept
                  and not turn up, and that gap is the number worth having.
                  Recorded only once the meeting has happened.
                */}
                {canWrite && isPast && (
                  <div className="flex items-center gap-1" role="group" aria-label="נוכחות">
                    {([
                      [true, Check, 'נכח'],
                      [false, X, 'לא נכח'],
                      [null, Minus, 'לא נרשם'],
                    ] as const).map(([value, Icon, label]) => (
                      <button
                        key={String(value)}
                        type="button"
                        title={label}
                        aria-label={label}
                        aria-pressed={a.attended === value}
                        onClick={() => setAttendance.mutate({
                          id: meeting.id, attendeeId: a.id, attended: value,
                        })}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded border',
                          a.attended === value
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-border text-gray-500 hover:bg-gray-50',
                        )}
                      >
                        <Icon size={13} />
                      </button>
                    ))}
                  </div>
                )}

                {canWrite && !isCancelled && (
                  <button
                    type="button"
                    onClick={() => removeAttendee.mutate({ id: meeting.id, attendeeId: a.id })}
                    disabled={removeAttendee.isPending}
                    aria-label={`הסרת ${attendeeName(a)} מהפגישה`}
                    className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {meeting.attendees.some((a) => a.residentId) && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            דיירים רשומים כמשתתפים אך אינם מקבלים הזמנה אוטומטית — יש ליצור איתם קשר ישירות.
          </p>
        )}
      </div>

      <MeetingDialog open={editOpen} onOpenChange={setEditOpen} meeting={meeting} />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        destructive
        pending={cancel.isPending}
        error={cancel.error}
        title="ביטול הפגישה"
        confirmLabel="ביטול הפגישה"
        cancelLabel="חזרה"
        description={
          <div className="space-y-3 text-right">
            <p className="text-sm">
              כל המשתתפים יקבלו התראה על הביטול. הפגישה תישאר ברשימה עם סטטוס ׳בוטלה׳
              ולא תימחק.
            </p>
            <div>
              <label htmlFor="cancel-reason" className="mb-1 block text-sm">
                סיבת הביטול (תיכלל בהתראה)
              </label>
              <input
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                maxLength={500}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>
        }
        onConfirm={() => {
          cancel.mutate(
            { id: meeting.id, reason: cancelReason.trim() || undefined },
            { onSuccess: () => { setCancelReason(''); setConfirmCancel(false) } },
          )
        }}
      />
    </div>
  )
}
