import type {
  FaqItem,
  KnowledgeArticleSummary,
  Locale,
  Paginated,
} from '@urban-renewal/api-contracts'
import { resolveContent } from '@urban-renewal/api-contracts'
import { getCmsArticles, getCmsFaqItems } from '@/lib/cms-source'

// Homepage, search and sitemap share the same published CMS content as detail pages.
// Unapproved fixtures are deliberately excluded, including during CMS outages.
export async function getKnowledgeArticles(
  options: { category?: string; limit?: number; offset?: number; locale?: Locale } = {},
): Promise<Paginated<KnowledgeArticleSummary>> {
  const { category, limit = 12, offset = 0, locale = 'he' } = options
  const text = (value: { he: string; en?: string } | undefined) =>
    value ? (resolveContent(value, locale, 'SOURCE') ?? '') : ''
  const articles = await getCmsArticles()
  const matched = articles
    .map((a) => ({
      id: a.slug,
      slug: a.slug,
      title: text(a.title),
      summary: text(a.summary),
      category: {
        id: a.category?.he ?? '',
        slug: a.category?.he ?? '',
        name: text(a.category),
        articleCount: 0,
      },
      updatedAt: a.publishedAt,
    }))
    .filter((a) => !category || a.category.slug === category)
  return { items: matched.slice(offset, offset + limit), total: matched.length, limit, offset }
}

export async function getFaqItems(_category?: string, locale: Locale = 'he'): Promise<FaqItem[]> {
  return (await getCmsFaqItems()).map((f) => ({
    id: f.id,
    order: f.order,
    question: resolveContent(f.question, locale, 'SOURCE') ?? '',
    answer: resolveContent(f.answer, locale, 'SOURCE') ?? '',
  }))
}
export async function getExternalResources() {
  const { MOCK_EXTERNAL_RESOURCES } = await import('../fixtures/knowledge')
  return [...MOCK_EXTERNAL_RESOURCES]
}
