import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { NAV_ITEMS } from '@/lib/navigation'
import { MobileNav } from './mobile-nav'
import { LanguageSwitcher } from './language-switcher'

/**
 * Site header.
 *
 * ── WHAT IS AND IS NOT HERE ────────────────────────────────────────────────
 *
 * Two persistent actions, per the specification: the eligibility CTA (primary)
 * and the resident portal (secondary). Neither rotates — a primary CTA that
 * changes on its own gives a returning visitor no stable target.
 *
 * The wordmark is text, not an image. The logo asset has not been supplied to
 * this app, and a placeholder image would be worse than honest type: it would
 * need replacing everywhere and would ship a broken asset in the meantime.
 *
 * ── RESIDENT PORTAL LINK ───────────────────────────────────────────────────
 *
 * Points at `/resident`, which does not exist yet — the Portal runs on :3002
 * and its basePath cutover is deliberately deferred. Centralised in
 * `lib/navigation` as `RESIDENT_PORTAL_HREF` so the cutover is one edit rather
 * than a search across components.
 */
export async function SiteHeader() {
  const [tNav, tCta, tBrand] = await Promise.all([
    getTranslations('nav'),
    getTranslations('cta'),
    getTranslations('brand'),
  ])

  const items = NAV_ITEMS.map((item) => ({ ...item, label: tNav(item.key) }))

  return (
    <header className="sticky top-0 z-header border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-8">
        <Link
          href="/"
          className="shrink-0 text-lg font-bold text-teal-700"
          aria-label={tBrand('name')}
        >
          {tBrand('name')}
        </Link>

        {/* `aria-label` distinguishes this from the footer's nav landmark. */}
        <nav
          aria-label={tNav('primaryNavigation')}
          className="hidden flex-1 items-center gap-1 lg:flex"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-teal-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <LanguageSwitcher />

          <Link
            href="/resident-portal"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 sm:inline-flex"
          >
            {tCta('residentPortal')}
          </Link>

          {/* The primary conversion. Kept visible at every width — on mobile it
              is the single most important control on the page, so it must not
              be buried inside the menu. */}
          <Link
            href="/eligibility"
            className="inline-flex items-center rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 lg:px-4"
          >
            <span className="hidden sm:inline">{tCta('eligibility')}</span>
            <span className="sm:hidden">בדיקת התאמה</span>
          </Link>

          <MobileNav
            items={items}
            openLabel={tNav('openMenu')}
            closeLabel={tNav('closeMenu')}
            navLabel={tNav('primaryNavigation')}
            residentPortalLabel={tCta('residentPortal')}
          />
        </div>
      </div>
    </header>
  )
}
