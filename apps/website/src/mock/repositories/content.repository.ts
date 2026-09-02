import type { CmsPage, PageBlock } from '@urban-renewal/api-contracts'
import { MOCK_PAGES } from '../fixtures/pages'
import { CORE_PAGES } from '../fixtures/core-pages'
import { getCmsPage } from '@/lib/cms-source'

/** Every page the site can serve. Split across fixture files by subject so a
 *  single page's content is findable, not because they behave differently. */
const ALL_PAGES: readonly CmsPage[] = [...MOCK_PAGES, ...CORE_PAGES]

/**
 * Page/block access.
 *
 * Returns blocks already FILTERED and SORTED, so no renderer has to remember to
 * drop hidden blocks or to sort by order. A component that forgets either would
 * render a hidden block or an arbitrary order, and both failures are invisible
 * in review until the wrong page ships.
 */
/**
 * The content resolver: CMS first for migrated pages, code for everything else.
 *
 * ── THE ORDER IS THE WHOLE DESIGN ──────────────────────────────────────────
 *
 * `getCmsPage` returns null for any slug not in `CMS_MANAGED_SLUGS`, and also
 * for a managed slug whose CMS copy is unpublished or unreachable. So the code
 * fixture below is reached in three quite different situations — page not
 * migrated, page migrated but not published, gateway unavailable — and the
 * visitor sees a correct page in all three.
 *
 * That is deliberate. The alternative, failing when the CMS is unreachable,
 * makes a database a single point of failure for sentences that change a few
 * times a year.
 *
 * `visibleBlocks` is applied to BOTH sources, so the hidden-block and ordering
 * rules cannot differ depending on where a page came from. The import script
 * deliberately exports blocks unsorted and unfiltered for the same reason: the
 * rule lives here, once.
 */
export async function getPageBySlug(slug: string): Promise<CmsPage | null> {
  const fromCms = await getCmsPage(slug)
  if (fromCms) return { ...fromCms, blocks: visibleBlocks(fromCms.blocks) }

  const page = ALL_PAGES.find((p) => p.slug === slug && p.publishState === 'published')
  if (!page) return null
  return { ...page, blocks: visibleBlocks(page.blocks) }
}

export async function getHomePage(): Promise<CmsPage | null> {
  return getPageBySlug('home')
}

function visibleBlocks(blocks: readonly PageBlock[]): PageBlock[] {
  return blocks.filter((b) => !b.hidden).slice().sort((a, b) => a.order - b.order)
}
