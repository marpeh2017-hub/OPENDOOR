'use client'

import Link from 'next/link'
import {
  Bell, CheckCheck, ClipboardList, FileSignature, MessageSquare,
  FolderKanban, CalendarDays, FileText, Settings2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, EmptyState, RowsSkeleton } from '@/components/ui/query-states'
import {
  useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead,
  useDismissNotification, NOTIFICATION_KIND_LABELS,
  type AppNotification, type NotificationFilters, type NotificationKind,
} from '@/hooks/use-notifications'

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  TASK:      ClipboardList,
  SIGNATURE: FileSignature,
  MESSAGE:   MessageSquare,
  PROJECT:   FolderKanban,
  MEETING:   CalendarDays,
  DOCUMENT:  FileText,
  SYSTEM:    Settings2,
}

/** Hebrew relative time. Intl.RelativeTimeFormat handles the plural forms. */
function relativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat('he', { numeric: 'auto' })
  const diffMs = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diffMs)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 3600e3], ['month', 30 * 24 * 3600e3], ['day', 24 * 3600e3],
    ['hour', 3600e3], ['minute', 60e3],
  ]
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diffMs / ms), unit)
  }
  return 'עכשיו'
}

function NotificationRow({
  notification, onNavigate, compact,
}: {
  notification: AppNotification
  onNavigate?: () => void
  compact?: boolean
}) {
  const markRead = useMarkNotificationRead()
  const dismiss = useDismissNotification()
  const Icon = KIND_ICON[notification.type] ?? Bell

  /*
   * Opening a notification marks it read. Fired without awaiting and without
   * blocking navigation: if the PATCH fails the user still gets where they were
   * going, and the badge corrects itself on the next poll. A failed mark-read
   * is not worth an error dialog on top of a successful navigation.
   */
  const handleOpen = () => {
    if (!notification.isRead) markRead.mutate({ id: notification.id })
    onNavigate?.()
  }

  const body = (
    <div className="flex gap-3 w-full text-right">
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          // Read rows are de-emphasised, but the icon still has to be legible:
          // gray-500 on gray-100 clears AA for a non-text glyph, gray-400 does not.
          notification.isRead ? 'bg-gray-100 text-gray-500' : 'bg-teal-50 text-teal-600',
        )}
        aria-hidden
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className={cn(
            'truncate text-sm',
            notification.isRead ? 'text-muted-foreground' : 'font-semibold text-foreground',
          )}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" aria-label="לא נקרא" />
          )}
        </div>
        <p className={cn(
          'text-xs text-muted-foreground',
          compact ? 'line-clamp-2' : '',
        )}>
          {notification.body}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {NOTIFICATION_KIND_LABELS[notification.type] ?? notification.type}
          {' · '}
          <time dateTime={notification.createdAt}>{relativeTime(notification.createdAt)}</time>
        </p>
      </div>
    </div>
  )

  return (
    <li className={cn(
      'group relative flex items-start gap-1 border-b border-border px-3 py-3 last:border-0',
      !notification.isRead && 'bg-teal-50/30',
    )}>
      {/*
        `link` is guaranteed relative by the server (NotificationsService.safeLink
        refuses absolute and protocol-relative URLs), which is what makes it safe
        to hand straight to next/link. Do not relax that check on the server
        without adding one here.
      */}
      {notification.link ? (
        <Link href={notification.link} onClick={handleOpen} className="flex-1 min-w-0">
          {body}
        </Link>
      ) : (
        <button type="button" onClick={handleOpen} className="flex-1 min-w-0 text-right">
          {body}
        </button>
      )}

      <button
        type="button"
        onClick={() => dismiss.mutate(notification.id)}
        disabled={dismiss.isPending}
        aria-label="הסרת ההתראה"
        className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-300 opacity-0 transition hover:bg-gray-100 hover:text-gray-600 focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
      >
        <X size={14} />
      </button>
    </li>
  )
}

/**
 * The notification list. Rendered both inside the bell popover (`compact`) and
 * on the full /notifications page, so the two can never drift apart in
 * behaviour — only in chrome.
 */
export function NotificationList({
  filters, compact, onNavigate, emptyHint,
}: {
  filters?: NotificationFilters
  compact?: boolean
  onNavigate?: () => void
  emptyHint?: string
}) {
  const query = useNotifications(filters ?? {})
  const markAll = useMarkAllNotificationsRead()

  if (query.isPending) return <RowsSkeleton rows={compact ? 3 : 6} />
  if (query.isError) {
    return (
      <QueryError
        message="טעינת ההתראות נכשלה"
        error={query.error}
        onRetry={() => query.refetch()}
      />
    )
  }

  const page = query.data
  if (!page || page.items.length === 0) {
    return (
      <EmptyState
        message={filters?.unreadOnly ? 'אין התראות שלא נקראו' : 'אין התראות'}
        hint={emptyHint ?? 'התראות על פגישות, משימות וחתימות יופיעו כאן'}
      />
    )
  }

  return (
    <div>
      {page.unreadCount > 0 && (
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {page.unreadCount} לא נקראו
          </span>
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-1 text-xs text-teal-600 hover:underline disabled:opacity-50"
          >
            <CheckCheck size={13} />
            סימון הכול כנקרא
          </button>
        </div>
      )}

      <ul className="divide-y divide-border">
        {page.items.map((n) => (
          <NotificationRow
            key={n.id}
            notification={n}
            onNavigate={onNavigate}
            compact={compact}
          />
        ))}
      </ul>
    </div>
  )
}
