import type { FaqItem, Locale } from '@urban-renewal/api-contracts'
import { resolveContent } from '@urban-renewal/api-contracts'
import { getCmsFaqItems } from '@/lib/cms-source'

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
