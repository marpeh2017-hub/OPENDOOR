import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { getProjects, getKnowledgeArticles } from '@/mock'

/**
 * sitemap.xml.
 *
 * ── WHY THIS IS GENERATED, NOT A HARDCODED LIST ────────────────────────────
 *
 * A hand-written sitemap goes stale the first time a route is added or a
 * project is published — nobody remembers to update a file nothing else
 * touches. This one is built from the same navigation model and the same mock
 * repositories every page already uses, so it can only drift from reality if
 * the site itself does.
 *
 * ── LOCALE ALTERNATES, NOT ONE ENTRY PER LANGUAGE ──────────────────────────
 *
 * `localePrefix: 'always'` (see `routing.ts`) means `/he/...` and `/en/...`
 * are the same page in two languages, not two pages. Each URL therefore
 * carries BOTH as `alternates.languages`, which is what tells a search engine
 * they are translations of one another rather than duplicate content — the
 * mistake a flat list of every URL in every locale would make.
 *
 * ── STUB ROUTES ARE DELIBERATELY ABSENT ────────────────────────────────────
 *
 * Every route still rendering a bare `PageShell` (see `STUB_ROBOTS` in
 * `src/lib/seo.ts`) is left out entirely. Listing a page in the sitemap is an
 * invitation to crawl and index it; a page whose own metadata says `noindex`
 * has no business being in that invitation. Add each route here in the same
 * change that removes its `STUB_ROBOTS`.
 */

/**
 * Routes with real content, which are therefore indexable and belong here.
 *
 * A route joins this list in the same change that removes its `STUB_ROBOTS` —
 * the two must move together, or the sitemap invites a crawler to a page whose
 * own metadata tells it to stay away.
 */
const SITE_ROUTES = [
  '/', '/about', '/why-organizer', '/how-we-work', '/trust', '/projects',
] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env['NEXT_PUBLIC_SITE_URL']
  // Relative URLs are invalid in a sitemap; without a configured production
  // domain there is nothing correct to emit yet.
  if (!base) return []

  const alternates = (path: string) =>
    Object.fromEntries(routing.locales.map((locale) => [locale, `${base}/${locale}${path}`]))

  const staticEntries: MetadataRoute.Sitemap = SITE_ROUTES.map((path) => ({
    url: `${base}/${routing.defaultLocale}${path}`,
    alternates: { languages: alternates(path) },
  }))

  // Only PUBLISHED, PUBLIC projects — the same filter every page already
  // applies, so the sitemap cannot leak a draft or internal-only record.
  const projects = await getProjects({ limit: 200 })
  const projectEntries: MetadataRoute.Sitemap = projects.items.map((project) => ({
    url: `${base}/${routing.defaultLocale}/projects/${project.slug}`,
    alternates: { languages: alternates(`/projects/${project.slug}`) },
    // No `lastModified` here: the card projection (`PublicProjectSummary`)
    // deliberately omits `updatedAt` — it is not information a grid needs —
    // so there is nothing honest to report without a second fetch per project.
  }))

  const articles = await getKnowledgeArticles({ limit: 200 })
  const articleEntries: MetadataRoute.Sitemap = articles.items.map((article) => ({
    url: `${base}/${routing.defaultLocale}/knowledge/${article.slug}`,
    alternates: { languages: alternates(`/knowledge/${article.slug}`) },
    lastModified: article.updatedAt,
  }))

  return [...staticEntries, ...projectEntries, ...articleEntries]
}
