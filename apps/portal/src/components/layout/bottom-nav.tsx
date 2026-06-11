'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, FileText, MessageSquare, HelpCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/he/dashboard',  icon: Home,          label: 'ראשי' },
  { href: '/he/documents',  icon: FileText,       label: 'מסמכים' },
  { href: '/he/messages',   icon: MessageSquare,  label: 'הודעות' },
  { href: '/he/support',    icon: HelpCircle,     label: 'תמיכה' },
  { href: '/he/profile',    icon: User,           label: 'פרופיל' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-border">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors',
                isActive ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
