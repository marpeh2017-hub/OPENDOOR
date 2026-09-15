'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
} from '@/components/ui/dropdown-menu'
import { NotificationList } from './notification-list'
import { useUnreadNotificationCount } from '@/hooks/use-notifications'

/**
 * The bell in the top bar.
 *
 * Replaces a decorative `<Bell/>` with a hard-coded teal dot that was always
 * lit — it claimed unread notifications regardless of whether any existed, and
 * clicking it did nothing.
 *
 * Refresh model is polling; see the comment on `useUnreadNotificationCount`.
 * The popover list itself refetches on open (React Query treats it as stale
 * after 15s), so opening the bell is the "on-navigation refetch" half of the
 * strategy.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data } = useUnreadNotificationCount()
  const count = data?.count ?? 0

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
          aria-label={count > 0 ? `התראות — ${count} לא נקראו` : 'התראות'}
        >
          <Bell size={18} />
          {count > 0 && (
            <span
              className="absolute -top-0.5 left-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-semibold leading-none text-white"
              // The count is decorative here — the accessible name on the
              // button above already announces it, so this must not be read
              // twice by a screen reader.
              aria-hidden
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold text-foreground">התראות</span>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-teal-600 hover:underline"
          >
            הצגת הכול
          </Link>
        </div>

        {/*
          Mounted only while open, so the popover does not hold a live query
          subscription (and a poll) for every user who never opens the bell.
        */}
        {open && (
          <div className="max-h-96 overflow-y-auto">
            <NotificationList
              compact
              filters={{ limit: 10 }}
              onNavigate={() => setOpen(false)}
            />
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
