import type { CmsPage, PageBlock } from '@urban-renewal/api-contracts'

/**
 * The CMS side of the content resolver.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHY MIGRATION IS AN EXPLICIT LIST AND NOT "WHATEVER THE CMS HAS"
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The tempting resolver is "ask the CMS; if it answers, use that". It hands
 * control of the live website to whatever happens to be in a database row —
 * so a half-finished import, a partially-filled draft that someone published
 * to see what it looked like, or a page created with a colliding slug silently
 * replaces working content, and the code that would have rendered correctly is
 * still sitting right there unused.
 *
 * So a page is served from the CMS only when its slug appears in
 * `CMS_MANAGED_SLUGS` below. Adding a slug to that list is a deliberate,
 * reviewable act — the same act as the import script's `--publish`, and
 * neither works without the other. Everything else keeps rendering from code,
 * with no change in behaviour and no risk.
 *
 * The migration therefore has three states per page, all of them safe:
 *
 *   not in the list          → code. The CMS may hold a draft; nobody sees it.
 *   in the list, unpublished → code. `getCmsPage` returns null, caller falls back.
 *   in the list, published   → CMS.
 *
 * ── WHY THE FALLBACK IS NOT AN ERROR PATH ──────────────────────────────────
 *
 * If the gateway is down, slow, or returns something unexpected, this returns
 * null and the caller renders the code fixture. A marketing site that 500s
 * because a CMS is unreachable has made the CMS a single point of failure for
 * content that has not changed in months. The fallback is the normal path for
 * every unmigrated page anyway, so it is exercised constantly rather than
 * being emergency code that has never run.
 */

/**
 * Pages the CMS is authoritative for. ONE entry, deliberately.
 *
 * `trust` was migrated first because it is the page whose content is most
 * about the company's own conduct, so it is the page most likely to need
 * editing without a deploy — and because it uses five different block types,
 * which makes it a real test of the round trip rather than a easy one.
 *
 * `about`, `why-organizer` and `how-we-work` followed in Pass 4G, imported by
 * the same script from the same fixtures with the same before/after proof —
 * their content is unchanged, only its home moved.
 *
 * `privacy` and `terms` are deliberately ABSENT. Both have a DRAFT row in the
 * CMS (see the import in Pass 4G) so an editor can see the shell, but no
 * legal copy exists to publish and none has been invented — see
 * `docs/ODG_CMS_ARCHITECTURE.md` Appendix E. Adding either slug here before
 * that copy exists would publish nothing (an unpublished draft still returns
 * null), so the absence is documentation, not a missing step.
 */
export const CMS_MANAGED_SLUGS: readonly string[] = [
  'trust', 'about', 'why-organizer', 'how-we-work',
]

export function isCmsManaged(slug: string): boolean {
  return CMS_MANAGED_SLUGS.includes(slug)
}

/** Cache tag for one page, so publishing can revalidate exactly that page. */
export function pageTag(slug: string): string {
  return `cms:page:${slug}`
}

const TENANT = process.env['CMS_TENANT_SLUG'] ?? 'opendoor-demo'

function gatewayBase(): string | null {
  const base = process.env['NEXT_PUBLIC_API_URL']
  return base ? base.replace(/\/+$/, '') : null
}

interface PublicCmsResponse {
  slug: string
  kind: string
  publishedAt: string
  content: { blocks?: PageBlock[]; title?: CmsPage['title'] }
  seo: CmsPage['seo']
}

/**
 * Fetch one published page, or null.
 *
 * Tagged with `pageTag(slug)` so `revalidateTag` after a publish refreshes
 * this page and nothing else. Without a tag the choice is between a
 * time-based window during which the site is stale and `no-store`, which
 * would put a network round trip on every request for content that changes
 * a few times a year.
 */
export async function getCmsPage(slug: string): Promise<CmsPage | null> {
  if (!isCmsManaged(slug)) return null

  const base = gatewayBase()
  if (!base) return null

  try {
    const res = await fetch(`${base}/api/v1/public/cms/${TENANT}/page/${slug}`, {
      next: { tags: [pageTag(slug)], revalidate: 300 },
    })
    if (!res.ok) return null

    const body = (await res.json()) as PublicCmsResponse
    const blocks = body?.content?.blocks
    // Shape check rather than trust: the resolver must not hand a half-shaped
    // object to the renderers, because the failure would surface as a blank
    // section rather than as a fetch error.
    if (!Array.isArray(blocks) || blocks.length === 0) return null

    return {
      id: `cms-${slug}`,
      slug: body.slug,
      title: body.content.title ?? { he: '', en: '' },
      publishState: 'published',
      blocks,
      seo: body.seo,
      updatedAt: body.publishedAt,
      updatedByName: '',
    } as CmsPage
  } catch {
    // Deliberately silent to the visitor, who gets the code fallback and a
    // working page. Operationally this is visible as a stale page rather than
    // an outage, which is the right trade for a marketing site.
    return null
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  FAQ — Pass 4G
// ══════════════════════════════════════════════════════════════════════════

export interface CmsFaqEntry {
  id: string
  question: { he: string; en?: string }
  answer: { he: string; en?: string }
  order: number
}

/**
 * Published FAQ items, or an empty array.
 *
 * The FAQ is managed as a single CMS PAGE (slug "faq") holding an array —
 * see `apps/crm/src/components/site/faq-editor.tsx` for why one row rather
 * than one per question. An empty array is not an error: it is the correct
 * result before anyone has published a question, or if the gateway cannot be
 * reached, and the caller renders an honest empty state either way.
 */
export async function getCmsFaqItems(): Promise<CmsFaqEntry[]> {
  const base = gatewayBase()
  if (!base) return []

  try {
    const res = await fetch(`${base}/api/v1/public/cms/${TENANT}/page/faq`, {
      next: { tags: ['cms:page:faq'], revalidate: 300 },
    })
    if (!res.ok) return []

    const body = (await res.json()) as { content?: { items?: unknown } }
    const items = body?.content?.items
    if (!Array.isArray(items)) return []

    // Shape-checked rather than trusted, same discipline as `getCmsPage`.
    return items
      .filter((it): it is CmsFaqEntry =>
        Boolean(it) && typeof it === 'object'
        && typeof (it as CmsFaqEntry).id === 'string'
        && typeof (it as CmsFaqEntry).question?.he === 'string'
        && typeof (it as CmsFaqEntry).answer?.he === 'string'
        && (it as CmsFaqEntry).question.he.trim() !== ''
        && (it as CmsFaqEntry).answer.he.trim() !== '')
      .slice()
      .sort((a, b) => a.order - b.order)
  } catch {
    return []
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  KNOWLEDGE CENTER — Pass 4G
// ══════════════════════════════════════════════════════════════════════════

export interface CmsArticleSummary {
  slug: string
  title: { he: string; en?: string }
  summary?: { he: string; en?: string }
  category?: { he: string; en?: string }
  publishedAt: string
}

export interface CmsArticle extends CmsArticleSummary {
  body?: { he: string; en?: string }
  featuredImage?: { storageKey: string; alt: { he: string; en?: string }; classification: string } | null
  seo?: Record<string, { title?: string; description?: string }>
}

/**
 * Every published article, newest first.
 *
 * Never invented: if nobody has published an article, this returns an empty
 * array and the Knowledge Center shows its own honest empty state rather than
 * a placeholder or fabricated content — see `docs/ODG_CMS_ARCHITECTURE.md`
 * Appendix E.
 */
export async function getCmsArticles(): Promise<CmsArticleSummary[]> {
  const base = gatewayBase()
  if (!base) return []
  try {
    const res = await fetch(`${base}/api/v1/public/cms/${TENANT}/article`, {
      next: { tags: ['cms:articles'], revalidate: 300 },
    })
    if (!res.ok) return []
    const rows = (await res.json()) as { slug: string; publishedAt: string; content?: Record<string, unknown> }[]
    if (!Array.isArray(rows)) return []
    return rows
      .map((r) => {
        const c = r.content ?? {}
        const title = c['title'] as CmsArticleSummary['title'] | undefined
        if (!title?.he) return null
        return {
          slug: r.slug,
          title,
          summary: c['summary'] as CmsArticleSummary['summary'],
          category: c['category'] as CmsArticleSummary['category'],
          publishedAt: r.publishedAt,
        } satisfies CmsArticleSummary
      })
      .filter((a): a is CmsArticleSummary => a !== null)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  } catch {
    return []
  }
}

export async function getCmsArticleBySlug(slug: string): Promise<CmsArticle | null> {
  const base = gatewayBase()
  if (!base) return null
  try {
    const res = await fetch(`${base}/api/v1/public/cms/${TENANT}/article/${slug}`, {
      next: { tags: [`cms:article:${slug}`], revalidate: 300 },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { slug: string; publishedAt: string; content?: Record<string, unknown>; seo?: CmsArticle['seo'] }
    const c = body.content ?? {}
    const title = c['title'] as CmsArticle['title'] | undefined
    if (!title?.he) return null
    return {
      slug: body.slug,
      title,
      summary: c['summary'] as CmsArticle['summary'],
      body: c['body'] as CmsArticle['body'],
      category: c['category'] as CmsArticle['category'],
      featuredImage: c['featuredImage'] as CmsArticle['featuredImage'],
      publishedAt: body.publishedAt,
      seo: body.seo,
    }
  } catch {
    return null
  }
}
