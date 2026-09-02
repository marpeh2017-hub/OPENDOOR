'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Building2,
  Map,
  FileSignature,
  MessageSquare,
  ClipboardList,
  BarChart3,
  Settings,
  Zap,
  UserCircle,
  ShieldCheck,
  Globe,
  KeyRound,
  Bell,
  CalendarDays,
  Menu,
  X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SidebarUserMenu } from './sidebar-user-menu'

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
      { href: '/owners',    icon: KeyRound,       label: 'בעלים' },
      { href: '/gis',       icon: Map,            label: 'מפה' },
    ],
  },
  {
    group: 'תפעול',
    items: [
      { href: '/signatures',    icon: FileSignature, label: 'חתימות' },
      { href: '/documents',     icon: ClipboardList, label: 'מסמכים' },
      { href: '/communications',icon: MessageSquare, label: 'תקשורת' },
      { href: '/tasks',         icon: ClipboardList, label: 'משימות' },
      { href: '/meetings',      icon: CalendarDays,  label: 'פגישות' },
      { href: '/notifications', icon: Bell,          label: 'התראות' },
    ],
  },
  {
    group: 'כלים',
    items: [
      { href: '/data-quality', icon: ShieldCheck, label: 'איכות נתונים' },
      { href: '/automations', icon: Zap,       label: 'אוטומציות' },
      { href: '/templates',   icon: FileText,  label: 'תבניות הודעה' },
      { href: '/reports',     icon: BarChart3,  label: 'דוחות' },
    ],
  },
  {
    group: 'מערכת',
    items: [
      // The Site Manager. ONE entry, because everything under `/site` has its
      // own rail: adding nine more destinations here would bury both sets and
      // blur the distinction between managing a renewal process and managing
      // what the public can read.
      { href: '/site', icon: Globe, label: 'מנהל האתר' },
      { href: '/settings', icon: Settings, label: 'הגדרות' },
    ],
  },
]

/**
 * The navigation rail itself. Identical markup on every breakpoint — only the
 * shell around it (`Sidebar`) decides whether it is a static column or an
 * off-canvas drawer.
 */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-l border-border bg-white shadow-sm">
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
                      onClick={onNavigate}
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
        <SidebarUserMenu />
      </div>
    </div>
  )
}

/**
 * Responsive shell.
 *
 * The rail is a hard 16rem column. Below `lg` that left only ~119px of usable
 * width on a 375px phone, which made every table and form unreadable, so on
 * small screens it becomes an off-canvas drawer behind a toggle instead.
 */
export function Sidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close the drawer whenever the route changes, so tapping a link does not
  // leave the overlay covering the page it just navigated to.
  useEffect(() => { setOpen(false) }, [pathname])

  // While the drawer is open it owns the scroll; the page behind must not move.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  return (
    <>
      {/* Desktop: static column. */}
      <aside className="hidden lg:flex h-full flex-shrink-0">
        <SidebarNav />
      </aside>

      {/* Mobile: toggle button. `end-4` keeps it in the inline-end corner under RTL. */}
      <button
        type="button"
        aria-label="פתיחת תפריט ניווט"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 end-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white shadow-sm"
      >
        <Menu size={20} className="text-gray-600" />
      </button>

      {/* Mobile: off-canvas drawer. */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* `me-auto` pins the drawer to the inline-START edge — the right-hand
              side under RTL, which is where the desktop rail lives. */}
          <aside className="relative h-full me-auto">
            <button
              type="button"
              aria-label="סגירת תפריט ניווט"
              onClick={() => setOpen(false)}
              className="absolute top-3 start-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
            >
              <X size={18} />
            </button>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
