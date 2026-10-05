import type { Metadata, Viewport } from 'next'
import { COMPANY, CONTACT, SITE_URL } from '@/lib/site-config'
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
   * Open Graph / Twitter.
   *
   * The image is a BRAND CARD, not a photograph: the door and the skyline in
   * the site's own lines on its dark surface (public/og/odg-share.png). The
   * reason this file once shipped no image still holds, since a placeholder
   * photograph would be a small lie about the brand in every preview. A card
   * drawn from the brand's own vocabulary claims nothing it is not, and a link
   * shared in WhatsApp no longer arrives as a bare line of text. Replace it with
   * a real photograph per `ODG_IMAGE_REQUIREMENTS.md` when one exists.
   *
   * The share title carries the tagline. The name alone told a recipient
   * nothing about what the link was.
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
      title: `${t('name')}: ${t('tagline')}`,
      description: t('tagline'),
      images: [{ url: '/og/odg-share.png', width: 1200, height: 630, alt: t('name') }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t('name')}: ${t('tagline')}`,
      description: t('tagline'),
      images: ['/og/odg-share.png'],
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

  // Who the site belongs to, in the form search engines read. Every value is
  // one the site already states on its own pages: the registered name and
  // number, the phone and email, and where the company works.
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'OpenDoor Group',
    legalName: locale === 'he' ? COMPANY.legalName : COMPANY.legalNameEn,
    url: `${SITE_URL}/${locale}`,
    logo: `${SITE_URL}/apple-icon.png`,
    telephone: CONTACT.phoneHref.replace('tel:', ''),
    email: CONTACT.email,
    areaServed: locale === 'he' ? 'ירושלים והסביבה' : 'Jerusalem and its surroundings',
    identifier: {
      '@type': 'PropertyValue',
      propertyID: locale === 'he' ? 'ח.פ.' : 'Israeli company number',
      value: COMPANY.registrationNumber,
    },
  }

  return (
    <html lang={locale} dir={dir} className={heebo.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-surface-page font-sans text-gray-800 antialiased">
        <script
          type="application/ld+json"
          // Static values from site-config, serialised by JSON.stringify: no
          // visitor input reaches this string. `<` is escaped regardless.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organization).replace(/</g, '\\u003c'),
          }}
        />
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
