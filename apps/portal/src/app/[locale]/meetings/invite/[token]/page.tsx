'use client'

/**
 * Resident meeting-invitation experience — mobile-first, RTL Hebrew.
 *
 * This is the page an SMS invitation link lands on. Without it the whole
 * notification → RSVP chain dead-ends in a 404, so the states below mirror the
 * API's error vocabulary exactly rather than collapsing everything into
 * "something went wrong".
 *
 * Flow:
 *   1. LOADING    — resolve the token
 *   2. INVITE     — meeting details + Accept / Tentative / Decline
 *   3. ANSWERED   — the answer, with the option to change it while allowed
 *   4. ATTENDANCE — after the meeting has started: "did you attend?"
 *   5. CANCELLED  — meeting called off (with reason, if given)
 *   6. EXPIRED    — link past its expiry; ask for a new one
 *   7. NOT_FOUND  — unknown, revoked or used-up token (API answers all three
 *                   the same way ON PURPOSE — do not try to distinguish them)
 *
 * API (public, token-scoped, tenant derived server-side from the token):
 *   GET  /api/v1/meeting-invitations/:token
 *   POST /api/v1/meeting-invitations/:token/rsvp        { rsvpStatus }
 *   POST /api/v1/meeting-invitations/:token/attendance  { attended }
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, XCircle, HelpCircle, RefreshCw, AlertTriangle,
  Calendar, MapPin, Video, Clock, CalendarX2,
} from 'lucide-react'

type RsvpAnswer = 'accepted' | 'declined' | 'tentative'

interface InvitationView {
  meeting: {
    id: string
    title: string
    description: string | null
    location: string | null
    isVirtual: boolean
    meetingUrl: string | null
    startTime: string
    endTime: string | null
    status: 'scheduled' | 'completed' | 'cancelled' | string
    cancelledAt: string | null
    cancelReason: string | null
    projectName: string | null
  }
  attendee: {
    id: string
    residentName: string
    rsvpStatus: 'pending' | RsvpAnswer | string
    respondedAt: string | null
    attended: boolean | null
  }
  readOnly: boolean
}

type Fatal = { kind: 'expired' | 'not_found' | 'unknown'; message: string }

const RSVP_LABEL_HE: Record<string, string> = {
  pending: 'ממתין לתשובה',
  accepted: 'אישרת הגעה',
  declined: 'ציינת שלא תגיע/י',
  tentative: 'ציינת "אולי"',
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('he-IL', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-teal-50 to-white flex flex-col items-center justify-start pt-10 pb-20 px-4"
    >
      <div className="mb-8 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">OD</span>
        </div>
        <span className="font-bold text-gray-800">OpenDoor</span>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden">
        {children}
      </div>

      <p className="mt-8 text-xs text-gray-400 text-center">
        מאובטח על ידי OpenDoor · הזמנה אישית
      </p>
    </div>
  )
}

function Terminal({
  tone, icon, title, body, hint,
}: {
  tone: 'red' | 'amber' | 'gray'
  icon: React.ReactNode
  title: string
  body: string
  hint?: string
}) {
  const bg = tone === 'red' ? 'bg-red-50' : tone === 'amber' ? 'bg-amber-50' : 'bg-gray-50'
  return (
    <div className="p-8 flex flex-col items-center gap-4 text-center" data-testid="terminal-state">
      <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', bg)}>
        {icon}
      </div>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function MeetingInvitePage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<InvitationView | null>(null)
  const [fatal, setFatal] = useState<Fatal | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)
  const [attendanceDone, setAttendanceDone] = useState(false)

  const call = useCallback(
    async (path: string, method = 'GET', body?: unknown) => {
      // Same-origin, so the session cookie reaches the proxy and an RSVP by a
      // signed-in resident is attributed to them as well as to the token. See
      // the proxy's own comment for why this hop is what makes that real.
      const res = await fetch(`/api/token-flow/invite/${token}${path}`, {
        method,
        // An invitation's state changes underneath the resident (staff cancel
        // the meeting, re-issue the link, revoke it). A cached GET would show
        // them a meeting that is no longer happening, so never cache.
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = await res.json().catch(() => ({} as any))
      if (!res.ok) {
        const err = new Error(payload?.message ?? `שגיאת שרת ${res.status}`) as Error & {
          code?: string; status?: number
        }
        err.code = payload?.code
        err.status = res.status
        throw err
      }
      return payload as InvitationView
    },
    [token],
  )

  /** Only token-level failures are terminal; meeting-state conflicts are not. */
  const classify = useCallback((err: any): Fatal | null => {
    if (err?.code === 'MEETING_INVITE_EXPIRED') {
      return { kind: 'expired', message: err.message }
    }
    if (err?.code === 'MEETING_INVITE_NOT_FOUND' || err?.status === 404) {
      return { kind: 'not_found', message: err.message }
    }
    return null
  }, [])

  useEffect(() => {
    let alive = true
    call('')
      .then(view => { if (alive) setData(view) })
      .catch(err => {
        if (!alive) return
        setFatal(classify(err) ?? { kind: 'unknown', message: err.message })
      })
    return () => { alive = false }
  }, [call, classify])

  async function answer(rsvpStatus: RsvpAnswer) {
    setBusy(true)
    setError(null)
    try {
      const view = await call('/rsvp', 'POST', { rsvpStatus })
      setData(view)
      setChanging(false)
    } catch (err: any) {
      const f = classify(err)
      if (f) setFatal(f)
      else setError(err.message)
      // A cancelled/held meeting conflict means our view is stale — refresh it.
      if (!f && (err.code === 'MEETING_CANCELLED' || err.code === 'MEETING_ALREADY_HELD')) {
        call('').then(setData).catch(() => {})
      }
    } finally {
      setBusy(false)
    }
  }

  async function confirmAttendance(attended: boolean) {
    setBusy(true)
    setError(null)
    try {
      const view = await call('/attendance', 'POST', { attended })
      setData(view)
      setAttendanceDone(true)
    } catch (err: any) {
      const f = classify(err)
      if (f) setFatal(f)
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /* ── Terminal states ────────────────────────────────────────── */

  if (fatal) {
    return (
      <Shell>
        {fatal.kind === 'expired' ? (
          <Terminal
            tone="amber"
            icon={<Clock className="text-amber-500" size={28} />}
            title="תוקף ההזמנה פג"
            body={fatal.message || 'הקישור כבר אינו בתוקף.'}
            hint="פנה/י לחברת הניהול לקבלת קישור חדש."
          />
        ) : (
          <Terminal
            tone="red"
            icon={<AlertTriangle className="text-red-500" size={28} />}
            title="קישור לא תקין"
            body={
              fatal.kind === 'not_found'
                ? 'ההזמנה לא נמצאה, בוטלה, או שהקישור כבר נוצל מספר פעמים רב מדי.'
                : fatal.message || 'אירעה שגיאה בטעינת ההזמנה.'
            }
            hint="פנה/י לחברת הניהול לקבלת קישור חדש."
          />
        )}
      </Shell>
    )
  }

  if (!data) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <RefreshCw className="animate-spin text-teal-500" size={32} />
          <p className="text-sm text-gray-500">טוען הזמנה...</p>
        </div>
      </Shell>
    )
  }

  const { meeting, attendee, readOnly } = data

  if (meeting.status === 'cancelled') {
    return (
      <Shell>
        <Terminal
          tone="gray"
          icon={<CalendarX2 className="text-gray-400" size={28} />}
          title="הפגישה בוטלה"
          body={
            meeting.cancelReason
              ? `"${meeting.title}" בוטלה. סיבה: ${meeting.cancelReason}`
              : `"${meeting.title}" בוטלה.`
          }
          hint={
            meeting.cancelledAt
              ? `בוטלה בתאריך ${new Date(meeting.cancelledAt).toLocaleDateString('he-IL')}`
              : undefined
          }
        />
      </Shell>
    )
  }

  const started = new Date(meeting.startTime).getTime() <= Date.now()
  const answered = attendee.rsvpStatus !== 'pending'
  const canAnswer = !readOnly && meeting.status === 'scheduled'
  const showAttendance = started && meeting.status !== 'cancelled' && !readOnly
  const attendanceAnswered = attendee.attended !== null || attendanceDone

  return (
    <Shell>
      <div className="p-6 sm:p-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-14 w-14 rounded-full bg-teal-50 flex items-center justify-center mb-1">
            <Calendar className="text-teal-500" size={26} />
          </div>
          <h1 className="text-lg font-bold text-gray-900 leading-snug">{meeting.title}</h1>
          {attendee.residentName && (
            <p className="text-sm text-gray-500">שלום {attendee.residentName},</p>
          )}
          {meeting.projectName && (
            <p className="text-xs text-gray-400">{meeting.projectName}</p>
          )}
        </div>

        {/* Details */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <Clock className="text-gray-400 shrink-0 mt-0.5" size={16} />
            <span className="font-medium text-gray-800">{formatDateTime(meeting.startTime)}</span>
          </div>
          {meeting.isVirtual ? (
            <div className="flex items-start gap-2">
              <Video className="text-gray-400 shrink-0 mt-0.5" size={16} />
              {meeting.meetingUrl ? (
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-600 underline break-all"
                >
                  קישור לפגישה מקוונת
                </a>
              ) : (
                <span className="font-medium text-gray-800">פגישה מקוונת</span>
              )}
            </div>
          ) : meeting.location ? (
            <div className="flex items-start gap-2">
              <MapPin className="text-gray-400 shrink-0 mt-0.5" size={16} />
              <span className="font-medium text-gray-800">{meeting.location}</span>
            </div>
          ) : null}
          {meeting.description && (
            <p className="text-gray-600 leading-relaxed pt-1 border-t border-gray-100">
              {meeting.description}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        {/* ── RSVP ── */}
        {answered && !changing ? (
          <div
            className="rounded-xl border-2 border-teal-200 bg-teal-50 p-4 text-center space-y-2"
            data-testid="rsvp-answered"
          >
            <p className="text-sm font-semibold text-teal-800">
              {RSVP_LABEL_HE[attendee.rsvpStatus] ?? attendee.rsvpStatus}
            </p>
            {attendee.respondedAt && (
              <p className="text-xs text-teal-600">
                נרשם ב־{new Date(attendee.respondedAt).toLocaleString('he-IL')}
              </p>
            )}
            {canAnswer ? (
              <button
                onClick={() => setChanging(true)}
                className="text-xs text-teal-700 underline hover:text-teal-900"
              >
                שינוי התשובה
              </button>
            ) : (
              <p className="text-xs text-gray-500">לא ניתן לשנות את התשובה יותר.</p>
            )}
          </div>
        ) : canAnswer ? (
          <div className="flex flex-col gap-3" data-testid="rsvp-buttons">
            <p className="text-sm text-gray-600 text-center">האם תגיע/י לפגישה?</p>
            <button
              onClick={() => answer('accepted')}
              disabled={busy}
              data-testid="rsvp-accept"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60 transition-colors"
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              כן, אגיע
            </button>
            <button
              onClick={() => answer('tentative')}
              disabled={busy}
              data-testid="rsvp-tentative"
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-colors"
            >
              <HelpCircle size={16} />
              עדיין לא בטוח/ה
            </button>
            <button
              onClick={() => answer('declined')}
              disabled={busy}
              data-testid="rsvp-decline"
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              <XCircle size={16} />
              לא אוכל להגיע
            </button>
            {changing && (
              <button
                onClick={() => setChanging(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ביטול
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-center text-sm text-gray-500">
            {meeting.status === 'completed'
              ? 'הפגישה כבר התקיימה — לא ניתן להשיב.'
              : 'לא ניתן להשיב על ההזמנה דרך קישור זה יותר.'}
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {showAttendance && (
          <div className="pt-4 border-t border-gray-100 space-y-3" data-testid="attendance-block">
            {attendanceAnswered ? (
              <p className="text-center text-sm text-gray-600">
                {attendee.attended
                  ? 'תודה — נוכחותך נרשמה.'
                  : 'נרשם שלא נכחת בפגישה.'}
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-600 text-center">האם נכחת בפגישה?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => confirmAttendance(true)}
                    disabled={busy}
                    data-testid="attendance-yes"
                    className="flex-1 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-60 transition-colors"
                  >
                    כן, נכחתי
                  </button>
                  <button
                    onClick={() => confirmAttendance(false)}
                    disabled={busy}
                    data-testid="attendance-no"
                    className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                  >
                    לא נכחתי
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}
