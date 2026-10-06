import type { ChecklistBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { LineIcon, isLineIcon } from '@/components/brand/line-icon'
import { Section } from './section'

/**
 * What we check in an offer: one card per check, on the wash.
 *
 * ── SINCE 2026-10 ──────────────────────────────────────────────────────────
 *
 * The checklist lived on /services as six labels. The company rewrote the
 * checks as five sentences for /about ("מה אנחנו בודקים בהצעה"), so an item
 * may now carry a `body` under its label, and the cards are built for one:
 * icon, number, a short name, then the sentence. Labels alone still render.
 * Five checks sit in one row from lg; other counts, three to a row.
 *
 * The section's id is an anchor: /services links straight to it.
 *
 * ── THE ICONS ARE A CLOSED SET; THE NUMBERS ARE ORDER, NOT RANK ────────────
 *
 * Icons are named in the content and drawn by `LineIcon`. The numbers help a
 * reader keep their place, and are hidden from screen readers, which announce
 * the list's length and position already.
 */
export function ChecklistBlockView({ block, t }: { block: ChecklistBlock; t: Localizer }) {
  return (
    <Section id={block.id} tone="wash" size="md" className="scroll-mt-16">
      <h2 className="max-w-3xl text-balance type-h2 font-bold text-gray-900">{t(block.heading)}</h2>

      <ol
        className={`mt-8 grid gap-4 sm:grid-cols-2 ${
          block.items.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-3'
        }`}
      >
        {block.items.map((item, index) => (
          <li key={item.id} className="flex flex-col gap-3 rounded-2xl bg-white p-6">
            <span className="flex items-center justify-between">
              {isLineIcon(item.icon) ? (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                  <LineIcon name={item.icon} size={22} />
                </span>
              ) : (
                <span />
              )}
              <span aria-hidden="true" className="type-small font-bold tabular-nums text-teal-600">
                {String(index + 1).padStart(2, '0')}
              </span>
            </span>
            <span className="type-h3 font-bold text-gray-900">{t(item.label)}</span>
            {t(item.body) && <span className="type-small text-gray-600">{t(item.body)}</span>}
          </li>
        ))}
      </ol>

      {block.note && <p className="mt-8 max-w-prose type-lead text-gray-700">{t(block.note)}</p>}
    </Section>
  )
}
