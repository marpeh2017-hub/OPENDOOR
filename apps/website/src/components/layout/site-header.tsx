import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { NAV_ITEMS, PRIMARY_NAV_KEYS, RESIDENT_PORTAL_HREF } from '@/lib/navigation'
import { MobileNav } from './mobile-nav'
import { LanguageSwitcher } from './language-switcher'
import { HeaderShell } from './header-shell'
import { BrandMark } from '@/components/brand/brand-mark'

/**
 * Site header.
 *
 * ── WHAT V2 CHANGED ────────────────────────────────────────────────────────
 *
 * DENSITY. V1 put seven nav items, a language switcher, a portal link and a
 * primary CTA in one bar. At Hebrew label lengths that left no whitespace at
 * 1024px and made the two persistent actions compete with the navigation.
 *
 * The desktop bar now shows five routes. FAQ and contact are not removed — they
 * are still in the mobile menu, the footer, and as in-page links from the FAQ
 * and closing sections. Density went down; reachability did not.
 *
 * SURFACE. The bar is translucent over the hero and turns opaque with a
 * hairline once content passes beneath it. Its height never changes — see
 * `HeaderShell` for why that matters.
 *
 * ── A V1 BUG FIXED HERE ────────────────────────────────────────────────────
 *
 * The narrow-screen CTA label was a hardcoded Hebrew string, so the English
 * page rendered a Hebrew button below `sm`. It now comes from the message
 * catalogue like every other label.
 *
 * ── WHAT IS DELIBERATELY UNCHANGED ─────────────────────────────────────────
 *
 * Two persistent actions, neither rotating — a primary CTA that changes on its
 * own gives a returning visitor no stable target. The wordmark is still text:
 * the logo asset has not been supplied, and a placeholder image would need
 * replacing everywhere and would ship broken in the meantime. `BrandMark`
 * swaps to the SVG with a one-line change and no header redesign.
 */
export async function SiteHeader() {
  const [tNav, tCta, tBrand] = await Promise.all([
    getTranslations('nav'),
    getTranslations('cta'),
    getTranslations('brand'),
  ])

  const allItems = NAV_ITEMS.map((item) => ({ ...item, label: tNav(item.key) }))
  const primaryItems = allItems.filter((item) =>
    (PRIMARY_NAV_KEYS as readonly string[]).includes(item.key),
  )

  return (
    <HeaderShell>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-8">
        <Link
          href="/"
          className="shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          aria-label={tBrand('name')}
        >
          <BrandMark name={tBrand('name')} tagline={tBrand('wordmarkTagline')} />
        </Link>

        {/* `aria-label` distinguishes this from the footer's nav landmark. */}
        <nav
          aria-label={tNav('primaryNavigation')}
          className="hidden flex-1 items-center justify-center gap-0.5 lg:flex"
        >
          {primaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-teal-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1.5 lg:ms-0">
          <LanguageSwitcher />

          <Link
            href={RESIDENT_PORTAL_HREF}
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-teal-800 transition-colors hover:bg-teal-50 sm:inline-flex"
          >
            {tCta('residentPortal')}
          </Link>

          {/* The primary conversion. Visible at every width — on mobile it is
              the single most important control on the page, so it must not be
              buried inside the menu. */}
          <Link
            href="/eligibility"
            className="inline-flex min-h-[44px] items-center rounded-md bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 lg:min-h-0 lg:px-4"
          >
            <span className="hidden sm:inline">{tCta('eligibility')}</span>
            <span className="sm:hidden">{tCta('eligibilityShort')}</span>
          </Link>

          {/* The mobile menu still carries the FULL route list, including the
              two the desktop bar no longer shows. */}
          <MobileNav
            items={allItems}
            openLabel={tNav('openMenu')}
            closeLabel={tNav('closeMenu')}
            navLabel={tNav('primaryNavigation')}
            residentPortalLabel={tCta('residentPortal')}
          />
        </div>
      </div>
    </HeaderShell>
  )
}
