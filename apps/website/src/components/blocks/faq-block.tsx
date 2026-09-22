import type { CollectionBlock, FaqItem } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * FAQ.
 *
 * ── STILL NATIVE <details> ─────────────────────────────────────────────────
 *
 * `<details>/<summary>` is keyboard-operable, screen-reader-announced and
 * findable by the browser's in-page search with no JavaScript at all. A custom
 * accordion has to reimplement expanded state, focus handling, Enter/Space and
 * the disclosure role — and typically gets the last two wrong. It also keeps
 * the answers in the DOM for search engines whether or not they are open.
 *
 * ── V2: RHYTHM, NOT CARDS ──────────────────────────────────────────────────
 *
 * The brief asks for a restrained FAQ, and it is right that this is the place
 * to be quiet — it sits between two of the loudest sections on the page. What
 * changed is only rhythm: questions are set larger, rows are taller, and the
 * marker is a plus/minus rule pair rather than a chevron, which is quieter and
 * reads correctly in both directions without mirroring.
 *
 * The open/close transition animates `grid-template-rows`, the one way to
 * transition to an unknown content height in CSS. It is disabled under
 * `prefers-reduced-motion` in `globals.css`.
 */
export async function FaqBlockView({
  block,
  items,
  t,
}: {
  block: CollectionBlock
  items: FaqItem[]
  t: Localizer
}) {
  const tLinks = await getTranslations('links')
  const tPage = await getTranslations('pages.faq')

  return (
    <Section size="lg">
      <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
        <SectionHeading heading={block.heading} intro={block.intro} t={t} size="lg" />

        <div>
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {items.length === 0 && <p className="py-6 text-gray-700">{tPage('empty')}</p>}
            {items.map((item) => (
              <details key={item.id} className="odg-faq group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-start text-lg font-medium text-gray-900 outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 group-open:text-teal-900 sm:text-xl">
                  {item.question}
                  {/* Two rules forming a plus; the vertical one collapses when
                      open. Direction-neutral, so nothing needs mirroring. */}
                  <span
                    aria-hidden="true"
                    className="relative mt-2.5 h-3 w-3 shrink-0 text-gray-400 group-open:text-teal-700"
                  >
                    <span className="absolute start-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                    <span className="absolute start-1/2 top-0 h-full w-px -translate-x-1/2 bg-current transition-transform duration-200 group-open:scale-y-0" />
                  </span>
                </summary>
                <div className="odg-faq-body">
                  <p className="overflow-hidden pb-6 pe-9 text-base leading-relaxed text-gray-600">
                    {item.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>

          <Link
            href="/faq"
            className="group mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700"
          >
            <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-teal-700">
              {tLinks('allQuestions')}
            </span>
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </Section>
  )
}
