import type { Locale, SearchResult, SearchResults } from '@urban-renewal/api-contracts'
import {
  REPRESENTATION_PROTOCOL,
  protocolPlainText,
  resolveContent,
} from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { REPRESENTATION_PROTOCOL_HREF } from '@/lib/navigation'
import { getFaqItems } from './knowledge.repository'
import { getProjects } from './projects.repository'
import { getPageBySlug } from './content.repository'

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

  const slugs = ['about', 'why-organizer', 'how-we-work', 'trust', 'services', 'stalled-projects']
  const [pages, projects, faq, tForms] = await Promise.all([
    Promise.all(slugs.map((slug) => getPageBySlug(slug))),
    getProjects({ limit: 100 }),
    getFaqItems(undefined, locale),
    getTranslations({ locale, namespace: 'pages.forms' }),
  ])
  for (const [index, page] of pages.entries()) {
    const slug = slugs[index]
    if (!page) continue
    const title = resolveContent(page.title, locale, 'SOURCE') ?? ''
    const excerpt = page.seo?.[locale]?.description ?? page.seo?.he?.description ?? ''
    if (`${title} ${excerpt}`.toLowerCase().includes(q))
      results.push({ kind: 'page', title, excerpt, href: `/${slug}` })
  }
  // The forms are code pages, titled from the site's messages. The protocol
  // also matches on its own Hebrew text, so a search for a phrase in it
  // ("ניגוד עניינים") finds the document.
  const protocolText = REPRESENTATION_PROTOCOL.parts
    .flatMap((part) => part.clauses)
    .flatMap((clause) => [
      clause.heading ?? '',
      ...clause.blocks.flatMap((block) =>
        block.kind === 'paragraph' ? [block.text] : block.kind === 'items' ? [...block.items] : [],
      ),
    ])
    .map(protocolPlainText)
    .join(' ')
  const forms = [
    { title: tForms('heading'), excerpt: tForms('standfirst'), href: '/forms', extra: '' },
    {
      title: tForms('protocolTitle'),
      excerpt: tForms('protocolSummary'),
      href: REPRESENTATION_PROTOCOL_HREF,
      extra: `${REPRESENTATION_PROTOCOL.title} ${protocolText}`,
    },
  ]
  for (const { extra, ...form } of forms) {
    if (`${form.title} ${form.excerpt} ${extra}`.toLowerCase().includes(q))
      results.push({ kind: 'page', ...form })
  }

  for (const p of projects.items) {
    // Matches against every language a value has, so an English query finds a
    // project whose English name exists and a Hebrew one always works. The
    // RESULT is rendered in the reader's locale by the caller.
    const haystack = [p.name.he, p.name.en, p.summary.he, p.summary.en, p.location.city.he]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (haystack.includes(q)) {
      results.push({
        kind: 'project',
        title: resolveContent(p.name, locale, 'SOURCE') ?? '',
        excerpt: resolveContent(p.summary, locale, 'SOURCE') ?? '',
        href: `/projects/${p.slug}`,
      })
    }
  }

  for (const f of faq) {
    if ([f.question, f.answer].join(' ').toLowerCase().includes(q)) {
      results.push({ kind: 'faq', title: f.question, excerpt: f.answer, href: '/faq' })
    }
  }

  return { items: results.slice(0, limit), total: results.length, limit, offset: 0 }
}
