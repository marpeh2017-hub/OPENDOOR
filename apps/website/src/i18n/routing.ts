import { defineRouting } from 'next-intl/routing'

/**
 * Locale routing.
 *
 * Only `he` and `en` here, unlike the Portal's four. The Portal serves
 * residents, who genuinely include Russian and Arabic speakers; the public
 * marketing site has no such obligation yet, and shipping empty `ru`/`ar`
 * message files would produce routes that resolve to untranslated Hebrew.
 * Adding a locale later is one entry plus a message file.
 *
 * `localePrefix: 'always'` matches the rest of the monorepo — every URL carries
 * its locale, so there is no unprefixed route whose language depends on a
 * header. That matters for SEO (§38 canonical URLs) and for sharing links.
 */
export const routing = defineRouting({
  locales: ['he', 'en'],
  defaultLocale: 'he',
  localePrefix: 'always',
})

export type AppLocale = (typeof routing.locales)[number]

/**
 * Text direction per locale.
 *
 * Structural, per the requirement that RTL/LTR must not be handled per
 * component: this drives `<html dir>` once, and every component below uses
 * logical CSS properties (`ms-`/`me-`, `start`/`end`) which follow it
 * automatically. No component reads the locale to decide its own direction.
 */
export const LOCALE_DIRECTION: Record<AppLocale, 'rtl' | 'ltr'> = {
  he: 'rtl',
  en: 'ltr',
}
