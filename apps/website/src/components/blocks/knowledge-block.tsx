import type { CollectionBlock, KnowledgeArticleSummary } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { ProjectPattern, STROKE } from '@/components/brand/architecture'

/**
 * Knowledge centre.
 *
 * ── EDITORIAL HIERARCHY, NOT THREE BLOG CARDS ──────────────────────────────
 *
 * One lead article with a graphic, then the rest as a divided index. That is
 * how a publication front page works, and it also solves a real problem: three
 * equal entries force a visitor to read three titles before choosing, where a
 * lead makes the choice for the majority who want a starting point.
 *
 * ── NO INVENTED CREDENTIALS ────────────────────────────────────────────────
 *
 * No author, no date, no read time, no view count. None of those are verified
 * for any article, and a byline is exactly the kind of small fabrication that
 * makes everything around it suspect. Category, title and summary are the
 * fields the content model actually guarantees.
 *
 * The lead's graphic is a generated architectural mark keyed on the slug — the
 * same system as the project cards, and for the same reason: it is visibly a
 * graphic, so it makes no claim about the article's subject, and it is not a
 * stock thumbnail chosen to fill space.
 */
export async function KnowledgeBlockView({
  block,
  articles,
  t,
}: {
  block: CollectionBlock
  articles: KnowledgeArticleSummary[]
  t: Localizer
}) {
  const tLinks = await getTranslations('links')
  const [lead, ...rest] = articles

  return (
    <Section tone="sunken" size="lg">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading heading={block.heading} intro={block.intro} t={t} size="lg" />
        <Link
          href="/knowledge"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-teal-700"
        >
          <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-teal-700">
            {tLinks('knowledgeCentre')}
          </span>
          <span
            aria-hidden="true"
            className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
          >
            →
          </span>
        </Link>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* ── the lead ──────────────────────────────────────────────────── */}
        {lead && (
          <Link
            href={`/knowledge/${lead.slug}`}
            className="group flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-white">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 z-10 h-px"
                style={{ background: STROKE.teal }}
              />
              <ProjectPattern slug={lead.slug} />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
              {lead.category.name}
            </p>
            <h3 className="mt-3 text-2xl font-semibold leading-snug text-gray-900 transition-colors group-hover:text-teal-800 sm:text-3xl">
              {lead.title}
            </h3>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-gray-600">{lead.summary}</p>
          </Link>
        )}

        {/* ── the index ─────────────────────────────────────────────────── */}
        <ul className="divide-y divide-gray-200 border-y border-gray-200 lg:mt-2">
          {rest.map((article) => (
            <li key={article.id}>
              <Link
                href={`/knowledge/${article.slug}`}
                className="group block py-6 outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
                  {article.category.name}
                </span>
                <span className="mt-2.5 flex items-start justify-between gap-4">
                  <span className="text-lg font-semibold leading-snug text-gray-900 transition-colors group-hover:text-teal-800">
                    {article.title}
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-block shrink-0 text-gray-600 transition-all duration-200 group-hover:translate-x-[3px] group-hover:text-teal-700 rtl:rotate-180"
                  >
                    →
                  </span>
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-gray-600">
                  {article.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
