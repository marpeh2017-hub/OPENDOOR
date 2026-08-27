import type {
  ExternalResource, FaqItem, KnowledgeArticle, KnowledgeArticleSummary,
  KnowledgeCategory, Paginated, SearchResult, SearchResults,
} from '@urban-renewal/api-contracts'
import {
  MOCK_ARTICLES, MOCK_CATEGORIES, MOCK_FAQ, MOCK_EXTERNAL_RESOURCES,
} from '../fixtures/knowledge'

/**
 * Knowledge, FAQ and external-resource access.
 *
 * Async for the same reason as the project repository: call sites must already
 * be shaped for a network round trip, so Phase 2 replaces the body of these
 * functions and nothing else.
 */

function toSummary(a: KnowledgeArticle): KnowledgeArticleSummary {
  return { id: a.id, slug: a.slug, title: a.title, summary: a.summary, category: a.category, updatedAt: a.updatedAt }
}

export async function getKnowledgeCategories(): Promise<KnowledgeCategory[]> {
  return [...MOCK_CATEGORIES]
}

export async function getKnowledgeArticles(
  options: { category?: string; limit?: number; offset?: number } = {},
): Promise<Paginated<KnowledgeArticleSummary>> {
  const { category, limit = 12, offset = 0 } = options
  const matched = MOCK_ARTICLES
    .filter((a) => (category ? a.category.slug === category : true))
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return {
    items: matched.slice(offset, offset + limit).map(toSummary),
    total: matched.length,
    limit,
    offset,
  }
}

/** Null, not a throw — "no such article" is a 404, not a failure. */
export async function getArticleBySlug(slug: string): Promise<KnowledgeArticle | null> {
  return MOCK_ARTICLES.find((a) => a.slug === slug) ?? null
}

/**
 * Related articles, resolved from slugs to summaries.
 *
 * A slug that matches nothing is dropped rather than rendered as a dead link —
 * the article body is editorial content and may reference something later
 * unpublished.
 */
export async function getRelatedArticles(slug: string): Promise<KnowledgeArticleSummary[]> {
  const article = await getArticleBySlug(slug)
  if (!article?.relatedArticleSlugs?.length) return []
  return article.relatedArticleSlugs
    .map((s) => MOCK_ARTICLES.find((a) => a.slug === s))
    .filter((a): a is KnowledgeArticle => Boolean(a))
    .map(toSummary)
}

export async function getFaqItems(category?: string): Promise<FaqItem[]> {
  return MOCK_FAQ
    .filter((f) => (category ? f.category === category : true))
    .slice()
    .sort((a, b) => a.order - b.order)
}

export async function getExternalResources(): Promise<ExternalResource[]> {
  return [...MOCK_EXTERNAL_RESOURCES]
}
