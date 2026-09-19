import type { CmsPage, PageBlock } from '@urban-renewal/api-contracts'
import { MOCK_PAGES } from '../fixtures/pages'
import { CORE_PAGES } from '../fixtures/core-pages'
import { getCmsPage, isCmsManaged } from '@/lib/cms-source'

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
/** CMS publication is authoritative for migrated pages. Code supplies only unmigrated pages. */
export async function getPageBySlug(slug: string): Promise<CmsPage | null> {
  const fromCms = await getCmsPage(slug)
  if (fromCms) return { ...fromCms, blocks: visibleBlocks(fromCms.blocks) }
  // During local development the gateway is often intentionally stopped while
  // the website is being worked on. Keep the approved fixture available there;
  // production remains fail-closed so an unpublished or withdrawn CMS page can
  // never be resurrected by an outage.
  if (isCmsManaged(slug) && process.env.NODE_ENV === 'production') return null

  const page = ALL_PAGES.find((p) => p.slug === slug && p.publishState === 'published')
  if (!page) return null
  return { ...page, blocks: visibleBlocks(page.blocks) }
}

export async function getHomePage(): Promise<CmsPage | null> {
  return getPageBySlug('home')
}

function visibleBlocks(blocks: readonly PageBlock[]): PageBlock[] {
  return blocks
    .filter((b) => !b.hidden)
    .slice()
    .sort((a, b) => a.order - b.order)
}
