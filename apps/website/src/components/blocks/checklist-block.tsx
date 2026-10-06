import type { ChecklistBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { Section } from './section'
import { LineIcon, isLineIcon } from '@/components/brand/line-icon'

/**
 * Named things with icons, laid out as tiles: what we check in an offer.
 *
 * ── THE ICONS ARE A CLOSED SET ─────────────────────────────────────────────
 *
 * Named in the content and drawn by `LineIcon`, never uploaded. An unknown
 * name renders the tile without an icon rather than a broken image, for the
 * same reason an unknown block renders nothing.
 *
 * ── THE NUMBERS ARE ORDER, NOT RANK ────────────────────────────────────────
 *
 * They help a reader keep their place in six tiles. They are hidden from
 * screen readers, which announce the list's length and position already.
 */
export function ChecklistBlockView({ block, t }: { block: ChecklistBlock; t: Localizer }) {
  return (
    <Section size="lg">
      <h2 className="max-w-3xl text-balance type-h2 font-bold text-gray-900">
        {t(block.heading)}
      </h2>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
        {block.items.map((item, index) => {
          return (
            <li
              key={item.id}
              className="flex items-center gap-5 border border-t-2 border-gray-100 border-t-teal-600 bg-white px-6 py-6 sm:px-7 sm:py-7"
            >
              {isLineIcon(item.icon) && (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                  <LineIcon name={item.icon} size={28} />
                </span>
              )}
              <div>
                <span aria-hidden="true" className="block text-[13px] tabular-nums text-gray-500">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="mt-0.5 block type-h3 font-semibold text-gray-900">
                  {t(item.label)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      {block.note && (
        <p className="mt-11 max-w-prose type-lead text-gray-700">
          {t(block.note)}
        </p>
      )}
    </Section>
  )
}
