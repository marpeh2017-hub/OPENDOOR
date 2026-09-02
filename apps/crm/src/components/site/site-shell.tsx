'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SITE_NAV } from './site-nav'
import { cn } from '@/lib/utils'

/**
 * The Site Manager's own second-level navigation.
 *
 * ── WHY A SECOND RAIL AND NOT MORE ENTRIES IN THE MAIN SIDEBAR ─────────────
 *
 * The CRM sidebar already carries sixteen destinations across four groups.
 * Adding nine more would bury both sets, and it would blur a distinction that
 * has to stay sharp: the CRM manages a renewal process, the Site Manager
 * manages what the public can read. One entry in the main sidebar leads here;
 * everything below is this rail.
 *
 * The chrome is deliberately the CRM's — same 8px radii, same `teal-50` active
 * state, same 18px icons, same type scale — because this is one product with
 * two areas, not two products.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Locale-prefixed routes (`/he/site/...`), so match on the suffix.
  const isActive = (href: string) => {
    if (href === '/site') return /\/site\/?$/.test(pathname)
    return pathname.includes(href)
  }

  return (
    <div className="flex gap-6">
      <nav
        aria-label="ניהול האתר"
        className="w-56 flex-shrink-0"
      >
        <div className="rounded-xl border border-border bg-white p-2">
          {SITE_NAV.map((group) => (
            <div key={group.group} className="mb-3 last:mb-0">
              {/* gray-400 is 2.80:1 on white and fails AA at this size. The CRM
                  sidebar uses it for its own group labels and carries the same
                  defect; fixing that one is a separate, deliberate change. */}
              <p className="px-3 pb-1 pt-2 text-xs font-semibold tracking-wider text-gray-600">
                {group.group}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href)
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        {...(active ? { 'aria-current': 'page' as const } : {})}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-teal-50 text-teal-600'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                        )}
                      >
                        <Icon
                          size={18}
                          className={cn('flex-shrink-0', active ? 'text-teal-500' : 'text-gray-400')}
                          aria-hidden="true"
                        />
                        {label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
