'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { NotificationList } from './notification-list'
import {
  NOTIFICATION_KINDS, NOTIFICATION_KIND_LABELS, type NotificationKind,
} from '@/hooks/use-notifications'

type ReadFilter = 'all' | 'unread' | 'read'

const READ_TABS: { value: ReadFilter; label: string }[] = [
  { value: 'all',    label: 'הכול' },
  { value: 'unread', label: 'לא נקראו' },
  { value: 'read',   label: 'נקראו' },
]

/**
 * The full notifications screen — the bell popover shows the latest ten, this
 * adds filtering by read-state and kind. Both render the same
 * `NotificationList`, so mark-read, dismiss and mark-all behave identically in
 * either place.
 */
export function NotificationsPageContent() {
  const [read, setRead] = useState<ReadFilter>('all')
  const [kind, setKind] = useState<NotificationKind | 'ALL'>('ALL')

  // `unreadOnly` is tri-state on the server: omitted means both. Sending
  // `false` genuinely means "read only" — do not collapse this to a boolean.
  const unreadOnly = read === 'all' ? undefined : read === 'unread'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5" role="tablist">
          {READ_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={read === tab.value}
              onClick={() => setRead(tab.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                read === tab.value
                  ? 'bg-teal-600 text-white'
                  : 'text-muted-foreground hover:bg-gray-100',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setKind('ALL')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              kind === 'ALL'
                ? 'border-teal-600 bg-teal-50 text-teal-700'
                : 'border-border text-muted-foreground hover:bg-gray-50',
            )}
          >
            כל הסוגים
          </button>
          {NOTIFICATION_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                kind === k
                  ? 'border-teal-600 bg-teal-50 text-teal-700'
                  : 'border-border text-muted-foreground hover:bg-gray-50',
              )}
            >
              {NOTIFICATION_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <NotificationList
          filters={{
            ...(unreadOnly === undefined ? {} : { unreadOnly }),
            ...(kind === 'ALL' ? {} : { type: kind }),
            limit: 50,
          }}
        />
      </div>
    </div>
  )
}
