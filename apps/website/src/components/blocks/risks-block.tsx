import type { RisksBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { LineIcon } from '@/components/brand/line-icon'
import { Section, SectionHeading } from './section'

/**
 * "מה שבעלי הדירות רואים קודם, ומה עושים עם זה."
 *
 * ── WHAT THIS REPLACED ─────────────────────────────────────────────────────
 *
 * /about used to open with one long sentence listing five worries: moving
 * out, uncertainty, bureaucracy, everyday disruption, documents that are hard
 * to follow. The sentence named them and moved on. Here each worry is a row,
 * and the row's other half is what is done about it, in wording the site
 * already uses for that work.
 *
 * ── THE WORRY IS NEUTRAL, THE ANSWER CARRIES THE COLOUR ────────────────────
 *
 * The worry sits in grey with a plain icon: no red, no warning sign, because
 * the page is answering a concern, not raising an alarm. The answer is in the
 * action teal (7.5:1 on the page). A description list pairs them, so a screen
 * reader announces each worry with its answer.
 */
export function RisksBlockView({ block, t }: { block: RisksBlock; t: Localizer }) {
  return (
    <Section size="md">
      <SectionHeading heading={block.heading} intro={block.intro} t={t} />

      <dl className="mt-10 border-t border-gray-200">
        {block.rows.map((row) => (
          <div
            key={row.id}
            className="grid gap-x-8 gap-y-2 border-b border-gray-200 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:items-center md:py-6"
          >
            <dt className="flex items-center gap-3 type-h3 font-semibold text-gray-700">
              <LineIcon name={row.icon} size={26} className="shrink-0 text-gray-500" />
              {t(row.risk)}
            </dt>
            <dd className="m-0 flex items-start gap-3 type-body font-semibold text-teal-700 md:items-center">
              <span aria-hidden="true" className="inline-block shrink-0 text-teal-500 rtl:rotate-180">
                →
              </span>
              <span>{t(row.answer)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
