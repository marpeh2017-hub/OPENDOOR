import type { CollectionBlock, FaqItem } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * FAQ preview.
 *
 * ── NATIVE <details>, NOT A JS ACCORDION ───────────────────────────────────
 *
 * `<details>/<summary>` is keyboard-operable, screen-reader-announced and
 * findable by the browser's in-page search with no JavaScript at all. A custom
 * accordion has to reimplement expanded state, focus handling, Enter/Space and
 * the disclosure role — and typically gets the last two wrong.
 *
 * It also means the answers are in the DOM for search engines whether or not
 * they are open, which a JS accordion often prevents.
 */
export async function FaqBlockView({
  block, items, t, tone,
}: {
  block: CollectionBlock
  items: FaqItem[]
  t: Localizer
  tone?: 'page' | 'raised' | 'sunken'
}) {
  const tLinks = await getTranslations('links')

  return (
    <Section tone={tone}>
      <SectionHeading heading={block.heading} intro={block.intro} t={t} />

      <div className="mt-10 max-w-3xl divide-y divide-gray-200 border-y border-gray-200">
        {items.map((item) => (
          <details key={item.id} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-start text-base font-medium text-gray-900 marker:content-none">
              {item.question}
              <svg
                viewBox="0 0 20 20"
                className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
                fill="none"
                aria-hidden="true"
              >
                <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <p className="mt-3 pe-9 text-[15px] leading-relaxed text-gray-600">{item.answer}</p>
          </details>
        ))}
      </div>

      <Link
        href="/faq"
        className="mt-8 inline-flex text-sm font-semibold text-teal-700 underline-offset-4 hover:underline"
      >
        {tLinks('allQuestions')} →
      </Link>
    </Section>
  )
}
