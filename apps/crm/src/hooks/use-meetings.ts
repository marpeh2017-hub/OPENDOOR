import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { notificationKeys } from '@/hooks/use-notifications'

/** Mirrors MeetingsController. Kept in sync with `meeting-constants.ts`. */

export const MEETING_STATUSES = ['scheduled', 'completed', 'cancelled'] as const
export type MeetingStatus = (typeof MEETING_STATUSES)[number]

export const RSVP_STATUSES = ['pending', 'accepted', 'declined', 'tentative'] as const
export type RsvpStatus = (typeof RSVP_STATUSES)[number]

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'מתוכננת',
  completed: 'התקיימה',
  cancelled: 'בוטלה',
}

export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  pending:   'ממתין לתשובה',
  accepted:  'אישר הגעה',
  declined:  'לא יגיע',
  tentative: 'אולי',
}

export interface MeetingAttendee {
  id:          string
  userId:      string | null
  residentId:  string | null
  role:        string | null
  rsvpStatus:  RsvpStatus
  respondedAt: string | null
  invitedAt:   string
  /** null = attendance not yet recorded. Distinct from rsvpStatus. */
  attended:    boolean | null
  user?:     { id: string; firstName: string; lastName: string; email: string; role: string } | null
  resident?: { id: string; firstName: string; lastName: string; phone: string | null } | null
}

export interface Meeting {
  id:           string
  tenantId:     string
  projectId:    string | null
  createdById:  string | null
  title:        string
  description:  string | null
  location:     string | null
  isVirtual:    boolean
  meetingUrl:   string | null
  startTime:    string
  endTime:      string | null
  notes:        string | null
  status:       MeetingStatus
  cancelledAt:  string | null
  cancelReason: string | null
  createdAt:    string
  updatedAt:    string
  attendees:    MeetingAttendee[]
  project?:   { id: string; name: string; code: string } | null
  createdBy?: { id: string; firstName: string; lastName: string } | null
}

export interface MeetingPage {
  items:  Meeting[]
  total:  number
  limit:  number
  offset: number
}

export const meetingKeys = {
  all:    ()          => ['meetings'] as const,
  lists:  ()          => [...meetingKeys.all(), 'list'] as const,
  list:   (f: object) => [...meetingKeys.lists(), f] as const,
  detail: (id: string) => [...meetingKeys.all(), 'detail', id] as const,
}

export interface MeetingFilters {
  projectId?: string
  status?:    MeetingStatus
  from?:      string
  to?:        string
  mineOnly?:  boolean
  limit?:     number
  offset?:    number
}

export function useMeetings(filters: MeetingFilters = {}) {
  const q = new URLSearchParams()
  if (filters.projectId) q.set('projectId', filters.projectId)
  if (filters.status)    q.set('status',    filters.status)
  if (filters.from)      q.set('from',      filters.from)
  if (filters.to)        q.set('to',        filters.to)
  // `false` is meaningful ("all"), so test for undefined, not truthiness.
  if (filters.mineOnly !== undefined) q.set('mineOnly', String(filters.mineOnly))
  if (filters.limit)     q.set('limit',     String(filters.limit))
  if (filters.offset)    q.set('offset',    String(filters.offset))

  return useQuery({
    queryKey: meetingKeys.list(filters),
    queryFn:  () => api.get<MeetingPage>(`/meetings?${q.toString()}`),
    staleTime: 30_000,
  })
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: meetingKeys.detail(id ?? ''),
    queryFn:  () => api.get<Meeting>(`/meetings/${id}`),
    enabled:  Boolean(id),
  })
}

export interface AttendeeInput {
  userId?:     string
  residentId?: string
  role?:       string
}

export interface CreateMeetingDto {
  title:        string
  description?: string
  location?:    string
  isVirtual?:   boolean
  meetingUrl?:  string
  startTime:    string
  endTime?:     string
  projectId?:   string
  notes?:       string
  attendees?:   AttendeeInput[]
}

/**
 * Every mutation invalidates the notification keys as well as the meeting keys.
 *
 * Scheduling, rescheduling and cancelling all EMIT notifications server-side,
 * so the bell badge is stale the moment one of these succeeds. Without this the
 * user would wait up to a poll interval to see the count they just caused.
 */
function useMeetingMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.all() })
      qc.invalidateQueries({ queryKey: notificationKeys.all() })
    },
  })
}

export function useCreateMeeting() {
  return useMeetingMutation((dto: CreateMeetingDto) => api.post<Meeting>('/meetings', dto))
}

export function useUpdateMeeting() {
  return useMeetingMutation(({ id, ...patch }: { id: string } & Partial<CreateMeetingDto>) =>
    api.patch<Meeting>(`/meetings/${id}`, patch),
  )
}

export function useCancelMeeting() {
  return useMeetingMutation(({ id, reason }: { id: string; reason?: string }) =>
    api.patch<Meeting>(`/meetings/${id}/cancel`, { reason }),
  )
}

export function useCompleteMeeting() {
  return useMeetingMutation(({ id, notes }: { id: string; notes?: string }) =>
    api.patch<Meeting>(`/meetings/${id}/complete`, { notes }),
  )
}

/** Refused with 409 once anyone has been invited — cancel instead. */
export function useDeleteMeeting() {
  return useMeetingMutation((id: string) => api.delete<{ id: string }>(`/meetings/${id}`))
}

export function useAddAttendees() {
  return useMeetingMutation(({ id, attendees }: { id: string; attendees: AttendeeInput[] }) =>
    api.post<Meeting>(`/meetings/${id}/attendees`, { attendees }),
  )
}

export function useRemoveAttendee() {
  return useMeetingMutation(({ id, attendeeId }: { id: string; attendeeId: string }) =>
    api.delete<Meeting>(`/meetings/${id}/attendees/${attendeeId}`),
  )
}

/** First-person: the server answers 404 if the caller is not an invitee. */
export function useRsvp() {
  return useMeetingMutation(({ id, rsvpStatus }: { id: string; rsvpStatus: RsvpStatus }) =>
    api.patch<Meeting>(`/meetings/${id}/rsvp`, { rsvpStatus }),
  )
}

export function useSetAttendance() {
  return useMeetingMutation(
    ({ id, attendeeId, attended }: { id: string; attendeeId: string; attended: boolean | null }) =>
      api.patch<Meeting>(`/meetings/${id}/attendees/${attendeeId}/attendance`, { attended }),
  )
}
