import type { Locale, SearchResult, SearchResults } from '@urban-renewal/api-contracts'
import { resolveContent } from '@urban-renewal/api-contracts'
import { MOCK_ARTICLES, MOCK_FAQ } from '../fixtures/knowledge'
import { getProjects } from './projects.repository'

/**
 * Site-wide search.
 *
 * ── SUBSTRING MATCHING, DELIBERATELY ───────────────────────────────────────
 *
 * A naive `includes` over titles and summaries. It is honest about what it is:
 * with six articles and a handful of projects, an index would be more machinery
 * than content. Hebrew search done properly needs stemming and niqqud handling
 * that a client-side matcher cannot provide, and pretending otherwise would
 * produce a search box that quietly fails on real queries.
 *
 * Phase 2 replaces this with a server endpoint. The CONTRACT (`SearchResults`)
 * is what the UI is built against, so that swap needs no component change.
 *
 * ── WHY THIS TAKES A LOCALE ────────────────────────────────────────────────
 *
 * A result carries plain strings, because a result list is rendered and never
 * re-resolved. Matching still runs over EVERY language a value has, so an
 * English query finds a project whose English name exists while a Hebrew query
 * always works; only the displayed title and excerpt are resolved, and with
 * the `SOURCE` policy so a result is never blank.
 */
export async function search(
  query: string,
  limit = 20,
  locale: Locale = 'he',
): Promise<SearchResults> {
  const q = query.trim().toLowerCase()
  if (!q) return { items: [], total: 0, limit, offset: 0 }

  const results: SearchResult[] = []

  const projects = await getProjects({ limit: 100 })
  for (const p of projects.items) {
    // Matches against every language a value has, so an English query finds a
     // project whose English name exists and a Hebrew one always works. The
     // RESULT is rendered in the reader's locale by the caller.
    const haystack = [p.name.he, p.name.en, p.summary.he, p.summary.en, p.location.city.he]
      .filter(Boolean).join(' ').toLowerCase()
    if (haystack.includes(q)) {
      results.push({
        kind: 'project',
        title: resolveContent(p.name, locale, 'SOURCE') ?? '',
        excerpt: resolveContent(p.summary, locale, 'SOURCE') ?? '',
        href: `/projects/${p.slug}`,
      })
    }
  }

  for (const a of MOCK_ARTICLES) {
    if ([a.title, a.summary].join(' ').toLowerCase().includes(q)) {
      results.push({ kind: 'article', title: a.title, excerpt: a.summary, href: `/knowledge/${a.slug}` })
    }
  }

  for (const f of MOCK_FAQ) {
    if ([f.question, f.answer].join(' ').toLowerCase().includes(q)) {
      results.push({ kind: 'faq', title: f.question, excerpt: f.answer, href: '/faq' })
    }
  }

  return { items: results.slice(0, limit), total: results.length, limit, offset: 0 }
}
