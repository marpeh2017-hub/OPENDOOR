/**
 * SEO helpers shared across route metadata.
 *
 * ── WHY STUB PAGES ARE MARKED noindex ───────────────────────────────────────
 *
 * Every page below the homepage currently renders `PageShell` — a title and a
 * "coming soon" notice, nothing else. Left indexable, a search engine would
 * crawl a dozen near-identical thin pages that all say the same thing, which
 * is a real SEO cost (duplicate/thin content) for zero benefit: nobody should
 * be finding OpenDoor through a search result that reads "content coming
 * soon". `follow: true` keeps the pages crawlable so their outbound links are
 * still discovered — the site's link graph should not go dark just because
 * the pages have no content of their own yet.
 *
 * REMOVE `STUB_ROBOTS` from a page's metadata the same day real content
 * replaces its `PageShell` — leaving it in place after that would hide a
 * finished page from search results, which is the opposite mistake.
 */
export const STUB_ROBOTS = { index: false, follow: true } as const

/**
 * Canonical and hreflang for a page that exists in every locale.
 *
 * Paths are relative and resolve against `metadataBase` (SITE_URL), so the
 * production domain is set once, by env. `x-default` is Hebrew: the site's
 * primary language and the one a visitor with no match should land in.
 *
 * Per page, not in the layout: the layout does not know the path, and a
 * middleware `Link` header loses to the preload header Next sends after it.
 */
export function localeAlternates(locale: string, path: string) {
  return {
    canonical: `/${locale}${path}`,
    languages: { he: `/he${path}`, en: `/en${path}`, 'x-default': `/he${path}` },
  }
}
