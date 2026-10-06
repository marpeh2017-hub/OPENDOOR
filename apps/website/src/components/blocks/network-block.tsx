import type { NetworkBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { LineIcon } from '@/components/brand/line-icon'
import { Section, SectionHeading } from './section'

/**
 * "האנשים שאנחנו מביאים לשולחן" — the developers, architects and inspectors
 * the company works with, and the professionals it can recommend.
 *
 * ── ROLES, NOT NAMES ───────────────────────────────────────────────────────
 *
 * Each card describes a kind of partner and what it gives the owners. No firm
 * is named and no logo is shown: naming a firm claims a relationship only the
 * firm can confirm, so names wait for each firm's written agreement.
 *
 * ── THE RECOMMENDATION LINE ────────────────────────────────────────────────
 *
 * The company can recommend appraisers, lawyers and architects. The line that
 * says so sits under the cards on the wash, and it always says in the same
 * breath that the choice is the owners' and the professional acts for them.
 * That is not modesty: the owners' lawyer and appraiser represent the owners,
 * including in projects where the company is the developer, and a
 * recommendation that read as an appointment would undo it.
 *
 * On a phone each card is a row, the icon beside the text, as the doors are.
 */
export function NetworkBlockView({ block, t }: { block: NetworkBlock; t: Localizer }) {
  return (
    <Section size="md">
      <SectionHeading heading={block.heading} intro={block.intro} t={t} />

      <ul className="mt-10 grid gap-4 md:grid-cols-3 lg:gap-6">
        {block.items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 md:block md:p-6 lg:p-7"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600 md:h-14 md:w-14">
              <LineIcon name={item.icon} size={26} />
            </span>
            <div className="min-w-0 md:mt-5">
              <h3 className="type-h3 font-bold text-gray-900">{t(item.title)}</h3>
              <p className="mt-1.5 type-body text-gray-600">{t(item.body)}</p>
            </div>
          </li>
        ))}
      </ul>

      {block.note && t(block.note) && (
        <div className="mt-5 flex items-start gap-4 rounded-2xl bg-teal-50 p-5 md:items-center md:p-6 lg:mt-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-teal-600">
            <LineIcon name="users" size={22} />
          </span>
          <p className="type-body text-gray-800">{t(block.note)}</p>
        </div>
      )}
    </Section>
  )
}
