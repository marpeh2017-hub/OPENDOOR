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
