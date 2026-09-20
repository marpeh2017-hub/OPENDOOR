import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * Mirrors CommunicationsController, which reads the `messages` table.
 *
 * NOTE: the Message model has no `projectId` column — messages are addressed to
 * a resident, not to a project — so there is deliberately no project filter
 * here. Filtering by project would require a schema change (see report).
 */
export interface Communication {
  id:            string
  residentId:    string | null
  channel:       string
  direction:     string
  status:        string
  subject:       string | null
  body:          string
  toPhone:       string | null
  toEmail:       string | null
  sentAt:        string | null
  deliveredAt:   string | null
  readAt:        string | null
  failureReason: string | null
  createdAt:     string

  // ── Dispatch state (Phases 1–2) ──────────────────────────────────────
  /** TRUE when the dev/no-op provider handled it — NOTHING was transmitted. */
  isSimulated:       boolean
  /** Which transport handled it, e.g. `sms:twilio`, `dev-noop`, `portal-inbox`. */
  providerName:      string | null
  providerMessageId: string | null
  attemptCount:      number
  maxAttempts:       number
  lastAttemptAt:     string | null
  /** When the dispatcher will next try. Non-null means a retry is pending. */
  nextAttemptAt:     string | null
  failedAt:          string | null
  cancelledAt:       string | null
}

export const communicationKeys = {
  all:   ()          => ['communications'] as const,
  lists: ()          => [...communicationKeys.all(), 'list'] as const,
  list:  (f: object) => [...communicationKeys.lists(), f] as const,
}

export function useCommunications(params?: { residentId?: string; channel?: string }) {
  const q = new URLSearchParams()
  if (params?.residentId) q.set('residentId', params.residentId)
  if (params?.channel)    q.set('channel',    params.channel)

  return useQuery({
    queryKey: communicationKeys.list(params ?? {}),
    queryFn:  () => api.get<Communication[]>(`/communications?${q.toString()}`),
    staleTime: 30_000,
  })
}

/** Mirrors the body accepted by POST /communications. */
export interface SendCommunicationDto {
  channel:     string
  body:        string
  subject?:    string
  residentId?: string
  toPhone?:    string
  toEmail?:    string
}

/**
 * POST /communications ENQUEUES an OUTBOUND message with status QUEUED. A
 * dispatcher then claims it and calls a provider; the row only reaches SENT if
 * that call actually succeeded. In development no external message is
 * transmitted and the row comes back `isSimulated: true`.
 *
 * The `channel` sent here is a REQUEST, not a guarantee: for a resident
 * recipient the server re-routes to a channel the resident consented to, and
 * refuses entirely (400) if they have opted out of contact.
 *
 * Restricted to COMMS_SEND_ROLES on the API — other roles get a 403.
 */
export function useSendCommunication() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: SendCommunicationDto) => api.post<Communication>('/communications', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: communicationKeys.lists() }),
  })
}
