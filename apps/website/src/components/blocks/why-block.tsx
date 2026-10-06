import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { LineIcon, isLineIcon } from '@/components/brand/line-icon'

/**
 * A plain FEATURE_GRID: things the company does, each with a line icon.
 *
 * ── A LIST, NOT A PATH ─────────────────────────────────────────────────────
 *
 * Until 2026-10 this rendered the homepage's three principles as a stepped
 * path: numerals, a connecting hairline, each item indented further than the
 * last. That section has left the homepage, and the block's one remaining use
 * is the list of services on /services, which must NOT look like a process:
 * the process is told once, on /how-we-work, and a second numbered sequence
 * beside it was the design review's "third version of the process".
 *
 * So: no numerals, no connecting line, no indent. Items sit in a two-column
 * grid of equal weight, each with an icon from the shared set, and the order
 * carries no claim.
 */
export function WhyBlockView({ block, t }: { block: FeatureGridBlock; t: Localizer }) {
  return (
    <Section size="lg">
      <SectionHeading heading={block.heading} intro={block.intro} t={t} size="lg" />

      <ul className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2 lg:mt-14">
        {block.items.map((item) => (
          <li key={item.id} className="flex gap-5">
            {isLineIcon(item.icon) && (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                <LineIcon name={item.icon} size={26} />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="type-h3 font-semibold text-gray-900">{t(item.title)}</h3>
              <p className="mt-2 type-body text-gray-600">{t(item.body)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}
