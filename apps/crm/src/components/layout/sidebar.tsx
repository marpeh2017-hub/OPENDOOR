'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Building2,
  FileSignature,
  MessageSquare,
  ClipboardList,
  BarChart3,
  Settings,
  Map,
  Zap,
  UserCircle,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    group: 'ראשי',
    items: [
      { href: '/', icon: LayoutDashboard, label: 'לוח בקרה' },
    ],
  },
  {
    group: 'ניהול',
    items: [
      { href: '/leads',     icon: UserCircle,    label: 'לידים' },
      { href: '/projects',  icon: FolderKanban,  label: 'פרויקטים' },
      { href: '/residents', icon: Users,          label: 'דיירים' },
      { href: '/buildings', icon: Building2,      label: 'מבנים' },
    ],
  },
  {
    group: 'תפעול',
    items: [
      { href: '/signatures',    icon: FileSignature, label: 'חתימות' },
      { href: '/documents',     icon: ClipboardList, label: 'מסמכים' },
      { href: '/communications',icon: MessageSquare, label: 'תקשורת' },
      { href: '/tasks',         icon: ClipboardList, label: 'משימות' },
    ],
  },
  {
    group: 'כלים',
    items: [
      { href: '/automations', icon: Zap,       label: 'אוטומציות' },
      { href: '/gis',         icon: Map,        label: 'מפות GIS' },
      { href: '/reports',     icon: BarChart3,  label: 'דוחות' },
    ],
  },
  {
    group: 'מערכת',
    items: [
      { href: '/settings', icon: Settings, label: 'הגדרות' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-64 flex-col border-l border-border bg-white shadow-sm">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500">
          <span className="text-lg font-bold text-white">OD</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-800">OpenDoor</p>
          <p className="truncate text-xs text-gray-500">התחדשות עירונית</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navItems.map((group) => (
          <div key={group.group} className="mb-4">
            <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {group.group}
            </p>
            <ul className="space-y-0.5 px-2">
              {group.items.map(({ href, icon: Icon, label }) => {
                const isActive = pathname.includes(href) && href !== '/'
                  || (href === '/' && (pathname.endsWith('/') || pathname.match(/\/[a-z]{2}$/)))
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-teal-50 text-teal-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      )}
                    >
                      <Icon
                        size={18}
                        className={cn(
                          'flex-shrink-0',
                          isActive ? 'text-teal-500' : 'text-gray-400',
                        )}
                      />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-gray-50">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-600 font-semibold text-xs">
            מנ
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-sm font-medium text-gray-700">מנהל מערכת</p>
            <p className="truncate text-xs text-gray-400">admin@odg.co.il</p>
          </div>
          <ChevronDown size={14} className="flex-shrink-0 text-gray-400" />
        </button>
      </div>
    </aside>
  )
}
