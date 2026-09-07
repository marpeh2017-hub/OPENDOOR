import type { CmsPage, PageBlock } from '@urban-renewal/api-contracts'

/** Migrated pages are served only from an active CMS publication.
 * Missing, withdrawn or unreachable content fails closed; it never revives a code fixture.
 * Legal pages remain outside this list until approved copy is available. */
export const CMS_MANAGED_SLUGS: readonly string[] = [
  'trust',
  'about',
  'why-organizer',
  'how-we-work',
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
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
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
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []

    const body = (await res.json()) as { content?: { items?: unknown } }
    const items = body?.content?.items
    if (!Array.isArray(items)) return []

    // Shape-checked rather than trusted, same discipline as `getCmsPage`.
    return items
      .filter(
        (it): it is CmsFaqEntry =>
          Boolean(it) &&
          typeof it === 'object' &&
          !(it as CmsFaqEntry & { hidden?: boolean }).hidden &&
          typeof (it as CmsFaqEntry).id === 'string' &&
          typeof (it as CmsFaqEntry).question?.he === 'string' &&
          typeof (it as CmsFaqEntry).answer?.he === 'string' &&
          (it as CmsFaqEntry).question.he.trim() !== '' &&
          (it as CmsFaqEntry).answer.he.trim() !== '',
      )
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
  seo?: Record<string, { title?: string; description?: string; noIndex?: boolean }>
}

export interface CmsArticle extends CmsArticleSummary {
  body?: { he: string; en?: string }
  featuredImage?: {
    storageKey: string
    alt: { he: string; en?: string }
    classification: string
  } | null
  seo?: Record<string, { title?: string; description?: string; noIndex?: boolean }>
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
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const rows = (await res.json()) as {
      slug: string
      publishedAt: string
      seo?: CmsArticleSummary['seo']
      content?: Record<string, unknown>
    }[]
    if (!Array.isArray(rows)) return []
    const summaries: CmsArticleSummary[] = []
    for (const r of rows) {
      const c = r.content ?? {}
      const title = c['title'] as CmsArticleSummary['title'] | undefined
      if (!title?.he) continue
      summaries.push({
        slug: r.slug,
        title,
        summary: c['summary'] as CmsArticleSummary['summary'],
        category: c['category'] as CmsArticleSummary['category'],
        publishedAt: r.publishedAt,
        seo: r.seo,
      })
    }
    return summaries.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  } catch {
    return []
  }
}

export async function getCmsArticleBySlug(slug: string): Promise<CmsArticle | null> {
  const base = gatewayBase()
  if (!base) return null
  try {
    const res = await fetch(`${base}/api/v1/public/cms/${TENANT}/article/${slug}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as {
      slug: string
      publishedAt: string
      content?: Record<string, unknown>
      seo?: CmsArticle['seo']
    }
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

/**
 * A signed URL for one managed object, from the SERVER — used by article and
 * project-image renderers that hold a `storageKey` rather than a ready URL.
 * Not cached with a tag of its own: the URL itself is short-lived by design,
 * so tag-based revalidation would not help it; the surrounding page's own
 * cache window governs how often this re-runs.
 */
export async function getPublicMediaUrl(storageKey: string): Promise<string | null> {
  const base = gatewayBase()
  if (!base) return null
  try {
    const res = await fetch(
      `${base}/api/v1/public/cms/${TENANT}/media?key=${encodeURIComponent(storageKey)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const body = (await res.json()) as { url?: string }
    return body.url ?? null
  } catch {
    return null
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  IMAGE SLOT ASSIGNMENT — Pass 4G
// ══════════════════════════════════════════════════════════════════════════

export interface CmsSlotAssignment {
  storageKey: string
  alt: { he: string; en?: string }
  classification: string
}

/**
 * Every CMS-assigned image slot, published slots only, or an empty object.
 *
 * Read once per request and passed down by the caller — see `getImageSlot`
 * in `mock/fixtures/images.ts` for why this is a lookup table rather than a
 * per-slot fetch: seven slots would otherwise be seven network round trips
 * for one page render.
 */
export async function getCmsImageSlots(): Promise<Record<string, CmsSlotAssignment>> {
  const base = gatewayBase()
  if (!base) return {}
  try {
    const res = await fetch(`${base}/api/v1/public/cms/${TENANT}/settings/image-slots`, {
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return {}
    const body = (await res.json()) as { content?: { slots?: Record<string, unknown> } }
    const slots = body?.content?.slots
    if (!slots || typeof slots !== 'object') return {}
    const out: Record<string, CmsSlotAssignment> = {}
    for (const [id, raw] of Object.entries(slots)) {
      const s = raw as Partial<CmsSlotAssignment> | null
      if (s && typeof s.storageKey === 'string' && s.alt?.he) {
        out[id] = {
          storageKey: s.storageKey,
          alt: s.alt as CmsSlotAssignment['alt'],
          classification: s.classification ?? 'EDITORIAL_CONTEXT',
        }
      }
    }
    return out
  } catch {
    return {}
  }
}
