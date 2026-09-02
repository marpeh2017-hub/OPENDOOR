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
 */
export const CMS_MANAGED_SLUGS: readonly string[] = ['trust']

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
