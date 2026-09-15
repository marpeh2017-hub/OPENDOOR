'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useUsers } from '@/hooks/use-users'
import { useProjects } from '@/hooks/use-projects'
import {
  useCreateMeeting, useUpdateMeeting, type Meeting, type AttendeeInput,
} from '@/hooks/use-meetings'

/**
 * Create / edit dialog.
 *
 * ATTENDEES ARE ONLY EDITABLE ON CREATE. That mirrors the API, where
 * `UpdateMeetingDto` deliberately has no `attendees` field: adding one person
 * should not mean resubmitting the whole roster, and two editors doing so
 * concurrently would silently drop invitees. On an existing meeting the roster
 * is managed from the detail screen, one person at a time.
 */

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in LOCAL time, not an ISO UTC string. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Back to a real ISO instant. The server stores UTC. */
function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

export function MeetingDialog({
  open, onOpenChange, meeting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present = edit mode. */
  meeting?: Meeting | null
}) {
  const isEdit = Boolean(meeting)
  const create = useCreateMeeting()
  const update = useUpdateMeeting()
  const users = useUsers()
  const projects = useProjects()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [isVirtual, setIsVirtual] = useState(false)
  const [meetingUrl, setMeetingUrl] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [projectId, setProjectId] = useState('')
  const [attendeeIds, setAttendeeIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Re-seed whenever the dialog opens, so a cancelled edit does not leak into
  // the next one.
  useEffect(() => {
    if (!open) return
    setError(null)
    setTitle(meeting?.title ?? '')
    setDescription(meeting?.description ?? '')
    setLocation(meeting?.location ?? '')
    setIsVirtual(meeting?.isVirtual ?? false)
    setMeetingUrl(meeting?.meetingUrl ?? '')
    setStartTime(toLocalInput(meeting?.startTime))
    setEndTime(toLocalInput(meeting?.endTime))
    setProjectId(meeting?.projectId ?? '')
    setAttendeeIds([])
  }, [open, meeting])

  const pending = create.isPending || update.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const start = fromLocalInput(startTime)
    if (!title.trim()) return setError('יש להזין כותרת לפגישה')
    if (!start) return setError('יש להזין מועד לפגישה')

    const end = fromLocalInput(endTime)
    // Checked here as well as on the server so the user gets an instant answer.
    // The server is still the enforcement point and answers 400 regardless.
    if (end && new Date(end) <= new Date(start)) {
      return setError('שעת הסיום חייבת להיות אחרי שעת ההתחלה')
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      isVirtual,
      meetingUrl: isVirtual && meetingUrl.trim() ? meetingUrl.trim() : undefined,
      startTime: start,
      endTime: end,
      projectId: projectId || undefined,
    }

    try {
      if (isEdit && meeting) {
        await update.mutateAsync({ id: meeting.id, ...payload })
      } else {
        const attendees: AttendeeInput[] = attendeeIds.map((userId) => ({
          userId, role: 'attendee',
        }))
        await create.mutateAsync({ ...payload, attendees })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'השמירה נכשלה')
    }
  }

  const toggleAttendee = (id: string) =>
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'עריכת פגישה' : 'פגישה חדשה'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="meeting-title" className="mb-1 block text-sm font-medium">
              כותרת <span className="text-red-600">*</span>
            </label>
            <input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="meeting-description" className="mb-1 block text-sm font-medium">
              תיאור
            </label>
            <textarea
              id="meeting-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="meeting-start" className="mb-1 block text-sm font-medium">
                התחלה <span className="text-red-600">*</span>
              </label>
              <input
                id="meeting-start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="meeting-end" className="mb-1 block text-sm font-medium">
                סיום
              </label>
              <input
                id="meeting-end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="meeting-project" className="mb-1 block text-sm font-medium">
                פרויקט
              </label>
              <select
                id="meeting-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="">ללא שיוך</option>
                {(projects.data?.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="meeting-location" className="mb-1 block text-sm font-medium">
                מיקום
              </label>
              <input
                id="meeting-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={300}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isVirtual}
                onChange={(e) => setIsVirtual(e.target.checked)}
                className="h-4 w-4"
              />
              פגישה מקוונת
            </label>
            {isVirtual && (
              <div>
                <label htmlFor="meeting-url" className="mb-1 block text-sm font-medium">
                  קישור לפגישה
                </label>
                <input
                  id="meeting-url"
                  type="url"
                  dir="ltr"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  כתובת http או https בלבד — הקישור נפתח מתוך המערכת
                </p>
              </div>
            )}
          </div>

          {/*
            Create-only, mirroring UpdateMeetingDto. On an existing meeting the
            roster is managed from the detail screen.
          */}
          {!isEdit && (
            <div>
              <p className="mb-1 block text-sm font-medium">משתתפים</p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                {users.isPending && (
                  <p className="p-2 text-xs text-muted-foreground">טוען משתמשים…</p>
                )}
                {users.isError && (
                  <p className="p-2 text-xs text-muted-foreground">
                    לא ניתן לטעון את רשימת המשתמשים — ניתן להוסיף משתתפים לאחר היצירה
                  </p>
                )}
                {(users.data ?? []).map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={attendeeIds.includes(u.id)}
                      onChange={() => toggleAttendee(u.id)}
                      className="h-4 w-4"
                    />
                    <span>{u.firstName} {u.lastName}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                כל משתתף יקבל התראה במערכת. הזמנות לדיירים אינן נשלחות בשלב זה.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {pending ? 'שומר…' : isEdit ? 'שמירה' : 'יצירת פגישה'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
