/**
 * Legal pages (terms, privacy) live on the marketing site, not in the Portal.
 * The Portal has no legal-content editor and no CMS-backed page for them —
 * duplicating the text here would just create a second copy to keep in sync
 * with `apps/website`'s, which is the one actually reviewed by counsel.
 *
 * `WEBSITE_URL` is the same server-only var the gateway's CORS allowlist and
 * CMS preview links already use (see `.env.example`). It has no NEXT_PUBLIC_
 * prefix, which is fine here: both call sites are Server Components that
 * redirect before anything reaches the browser.
 */
const WEBSITE_URL = (process.env['WEBSITE_URL'] ?? 'https://odg.co.il').replace(/\/+$/, '')

/** The website only ships he/en; ru and ar residents get the Hebrew page
 *  rather than a 404 or an unreviewed machine translation. */
function websiteLocale(portalLocale: string): 'he' | 'en' {
  return portalLocale === 'en' ? 'en' : 'he'
}

export function websiteTermsUrl(portalLocale: string): string {
  return `${WEBSITE_URL}/${websiteLocale(portalLocale)}/terms`
}

export function websitePrivacyUrl(portalLocale: string): string {
  return `${WEBSITE_URL}/${websiteLocale(portalLocale)}/privacy`
}
