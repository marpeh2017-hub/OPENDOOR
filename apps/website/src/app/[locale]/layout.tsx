import type { Metadata, Viewport } from 'next'
import { SITE_URL } from '@/lib/site-config'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { Heebo } from 'next/font/google'
import { routing, LOCALE_DIRECTION, type AppLocale } from '@/i18n/routing'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { SkipLink } from '@/components/layout/skip-link'
import { SiteChatWidget } from '@/components/faq/site-chat-widget'
import '@urban-renewal/design-system/src/globals.css'
// Imported after the shared sheet so its corrections win. See the file.
import '../globals.css'

/**
 * Heebo, loaded through `next/font` so it is self-hosted and preloaded rather
 * than fetched from Google at runtime — one less third-party request on first
 * paint, which matters for the Core Web Vitals target (§44).
 *
 * Loaded here rather than imported from the design system because `next/font`
 * must be called in the app that renders it; the package exports the CSS
 * variable NAME so both stay in agreement.
 */
const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
})

/**
 * Root layout for the OpenDoor Group public website.
 *
 * ── DIRECTION IS STRUCTURAL ────────────────────────────────────────────────
 *
 * `dir` is set ONCE here from the locale. No component below reads the locale
 * to decide its own direction, and none should: every layout uses logical CSS
 * (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start`) which follows the
 * ancestor `dir` automatically. That is what makes adding English a
 * configuration change rather than a sweep through every file.
 *
 * ── LANDMARKS ──────────────────────────────────────────────────────────────
 *
 * header / main / footer are real elements, not divs with roles, and `main`
 * carries the id the skip link targets. A screen-reader user can jump between
 * regions, and a keyboard user can bypass the navigation on every page.
 */
// Read the current publication on every request, including withdrawals.
export const dynamic = 'force-dynamic'

/**
 * `viewport-fit=cover` is what makes `env(safe-area-inset-*)` mean anything.
 *
 * Without it the browser keeps the page inside the safe area itself and every
 * inset resolves to 0 — so safe-area CSS written without this line is not
 * "defensive", it is dead code that reads as though the case were handled.
 *
 * Turning it on is a real change, not a formality: the page now extends UNDER
 * the notch, the Dynamic Island and the home indicator, so anything pinned to a
 * screen edge has to opt back out using the insets. The elements that do are
 * the sticky header, the mobile navigation drawer and the chat button; each
 * carries the reason at its own call site.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'brand' })

  /**
   * Open Graph / Twitter: the STRUCTURE only, no image.
   *
   * `og:image` needs a real 1200×630 asset, and none exists — see
   * `ODG_IMAGE_REQUIREMENTS.md`. Shipping the surrounding fields now means
   * that asset is a one-line addition later rather than a second metadata
   * pass; a share card with no image today is a worse but honest fallback,
   * where a placeholder image would be a small lie about the brand shipped to
   * every social preview.
   */
  return {
    // `%s` is filled by each page's own title; the brand suffix is defined once.
    title: { default: t('name'), template: `%s | ${t('name')}` },
    description: t('tagline'),
    // No hardcoded production URL — set via env when the domain is live.
    metadataBase: new URL(SITE_URL),
    openGraph: {
      type: 'website',
      siteName: t('name'),
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      title: t('name'),
      description: t('tagline'),
    },
    twitter: {
      card: 'summary',
      title: t('name'),
      description: t('tagline'),
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as AppLocale)) notFound()

  // Enables static rendering for this locale segment.
  setRequestLocale(locale)
  const { projectPreview: _previewMessages, ...messages } = await getMessages()
  const dir = LOCALE_DIRECTION[locale as AppLocale]

  return (
    <html lang={locale} dir={dir} className={heebo.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-surface-page font-sans text-gray-800 antialiased">
        <NextIntlClientProvider messages={messages}>
          <SkipLink />
          <SiteHeader />
          {/* tabIndex -1 so the skip link can move focus here, not just scroll. */}
          <main id="main-content" tabIndex={-1} className="focus:outline-none">
            {children}
          </main>
          <SiteFooter />
          <SiteChatWidget />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
