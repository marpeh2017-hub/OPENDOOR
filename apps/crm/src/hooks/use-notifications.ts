import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * Mirrors NotificationsController. Every route here is FIRST-PERSON — there is
 * no parameter for "whose notifications", because the server derives that from
 * the JWT. Nothing in this file should ever grow a `userId` argument on a read.
 */

/** Kept in sync with NOTIFICATION_KINDS on the API. */
export const NOTIFICATION_KINDS = [
  'TASK', 'SIGNATURE', 'MESSAGE', 'PROJECT', 'MEETING', 'DOCUMENT', 'SYSTEM',
] as const

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  TASK:      'משימה',
  SIGNATURE: 'חתימה',
  MESSAGE:   'הודעה',
  PROJECT:   'פרויקט',
  MEETING:   'פגישה',
  DOCUMENT:  'מסמך',
  SYSTEM:    'מערכת',
}

export interface AppNotification {
  id:         string
  userId:     string
  type:       NotificationKind
  title:      string
  body:       string
  /** Always a RELATIVE in-app path — the server refuses to store anything else. */
  link:       string | null
  entityType: string | null
  entityId:   string | null
  isRead:     boolean
  readAt:     string | null
  metadata:   Record<string, unknown> | null
  createdAt:  string
}

export interface NotificationPage {
  items:       AppNotification[]
  total:       number
  unreadCount: number
  limit:       number
  offset:      number
}

export const notificationKeys = {
  all:    ()          => ['notifications'] as const,
  lists:  ()          => [...notificationKeys.all(), 'list'] as const,
  list:   (f: object) => [...notificationKeys.lists(), f] as const,
  unread: ()          => [...notificationKeys.all(), 'unread-count'] as const,
}

export interface NotificationFilters {
  unreadOnly?: boolean
  type?:       NotificationKind
  limit?:      number
  offset?:     number
}

export function useNotifications(filters: NotificationFilters = {}) {
  const q = new URLSearchParams()
  // `false` is meaningful (read-only), so test for undefined rather than
  // truthiness — the server distinguishes the three states.
  if (filters.unreadOnly !== undefined) q.set('unreadOnly', String(filters.unreadOnly))
  if (filters.type)   q.set('type',   filters.type)
  if (filters.limit)  q.set('limit',  String(filters.limit))
  if (filters.offset) q.set('offset', String(filters.offset))

  return useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn:  () => api.get<NotificationPage>(`/notifications?${q.toString()}`),
    staleTime: 15_000,
  })
}

/**
 * Unread badge count.
 *
 * DELIVERY MODEL — POLLING, chosen deliberately over websockets.
 *
 * There is no push channel in this stack: no socket gateway on the API, no
 * service worker in the CRM, and no shared broker to fan out across API
 * instances. Adding one for a bell badge would be the single largest piece of
 * infrastructure in the notification feature, and it would have to be built
 * before Meetings could use it.
 *
 * So: a 60-second poll, plus `refetchOnWindowFocus`, plus explicit invalidation
 * whenever this app performs an action that creates or reads a notification.
 * In practice a user sees a new badge within a minute, or instantly when they
 * return to the tab. The cost is one indexed COUNT query per user per minute,
 * which is why the server keeps `unread-count` separate from the list.
 *
 * If real-time delivery becomes a requirement (it is not one today), the
 * replacement is a socket gateway feeding the same query keys — no component
 * below needs to change.
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn:  () => api.get<{ count: number }>('/notifications/unread-count'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isRead = true }: { id: string; isRead?: boolean }) =>
      api.patch<AppNotification>(`/notifications/${id}/read`, { isRead }),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all() }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch<{ updated: number }>('/notifications/read-all', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all() }),
  })
}

export function useDismissNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all() }),
  })
}
