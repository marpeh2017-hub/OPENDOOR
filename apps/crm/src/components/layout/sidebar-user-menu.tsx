'use client'

import { ChevronDown, LogOut, Settings as SettingsIcon, Loader2 } from 'lucide-react'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser, useLogout } from '@/hooks/use-auth'

/** Hebrew labels for UserRole — mirrors the enum in schema.postgres.prisma. */
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:                'מנהל־על',
  COMPANY_ADMIN:              'מנהל מערכת',
  PROJECT_MANAGER:            'מנהל פרויקט',
  RESIDENT_RELATIONS_MANAGER: 'מנהל קשרי דיירים',
  FIELD_AGENT:                'נציג שטח',
  LAWYER:                     'עורך דין',
  ARCHITECT:                  'אדריכל',
  ENGINEER:                   'מהנדס',
  DEVELOPER_REP:              'נציג יזם',
  MUNICIPALITY_USER:          'משתמש עירייה',
  EXTERNAL_CONSULTANT:        'יועץ חיצוני',
  RESIDENT:                   'דייר',
}

export function SidebarUserMenu() {
  const { data: user, isLoading } = useCurrentUser()
  const logout = useLogout()

  const email = user?.email ?? ''
  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : ''
  const initials = email ? email.slice(0, 2).toUpperCase() : '—'

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-gray-50"
          aria-label="תפריט משתמש"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-600 font-semibold text-xs">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-sm font-medium text-gray-700">
              {isLoading ? '...' : roleLabel || 'משתמש'}
            </p>
            <p className="truncate text-xs text-gray-400">{isLoading ? '' : email}</p>
          </div>
          <ChevronDown size={14} className="flex-shrink-0 text-gray-400" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2">
            <SettingsIcon size={14} />
            הגדרות
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            if (!logout.isPending) logout.mutate()
          }}
          className="flex items-center gap-2 text-red-600 focus:text-red-600"
        >
          {logout.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          התנתקות
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
