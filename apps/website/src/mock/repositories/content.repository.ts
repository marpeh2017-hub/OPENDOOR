import type { CmsPage, PageBlock } from '@urban-renewal/api-contracts'
import { MOCK_PAGES } from '../fixtures/pages'
import { CORE_PAGES } from '../fixtures/core-pages'

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
export async function getPageBySlug(slug: string): Promise<CmsPage | null> {
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
