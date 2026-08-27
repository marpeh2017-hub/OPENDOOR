import type { CollectionBlock, KnowledgeArticleSummary } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * Knowledge preview.
 *
 * A list, not a card grid. Three bordered tiles would give editorial articles
 * the same visual weight as the projects above them; a divided list reads as
 * reference material, which is what it is.
 */
export async function KnowledgeBlockView({
  block, articles, t, tone,
}: {
  block: CollectionBlock
  articles: KnowledgeArticleSummary[]
  t: Localizer
  tone?: 'page' | 'raised' | 'sunken'
}) {
  const tLinks = await getTranslations('links')

  return (
    <Section tone={tone}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading heading={block.heading} intro={block.intro} t={t} />
        <Link
          href="/knowledge"
          className="text-sm font-semibold text-teal-700 underline-offset-4 hover:underline"
        >
          {tLinks('knowledgeCentre')} →
        </Link>
      </div>

      <ul className="mt-10 divide-y divide-gray-200 border-y border-gray-200">
        {articles.map((article) => (
          <li key={article.id}>
            <Link
              href={`/knowledge/${article.slug}`}
              className="group flex flex-col gap-1.5 py-5 transition-colors hover:bg-white/60 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <span className="w-40 shrink-0 text-xs font-medium text-teal-700">
                {article.category.name}
              </span>
              <span className="flex-1">
                <span className="block text-base font-semibold text-gray-900 group-hover:text-teal-800">
                  {article.title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-gray-600">
                  {article.summary}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
