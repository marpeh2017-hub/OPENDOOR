'use client'

import { Search, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { NotificationBell } from '@/components/notifications/notification-bell'

export function TopBar() {
  const { theme, setTheme } = useTheme()

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-6">
      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-gray-50 px-3 py-2 w-80">
        <Search size={16} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="חיפוש גלובלי – פרויקטים, דיירים, מסמכים..."
          className="flex-1 bg-transparent text-sm text-gray-600 placeholder:text-gray-400 outline-none text-right"
          dir="rtl"
        />
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-white px-1.5 text-xs text-gray-400">
          ⌘K
        </kbd>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/*
          Notifications. This was previously a decorative bell with a hard-coded
          teal dot that was ALWAYS lit — it announced unread notifications
          whether or not any existed, and clicking it did nothing. It is now
          backed by GET /notifications/unread-count.
        */}
        <NotificationBell />
      </div>
    </header>
  )
}
