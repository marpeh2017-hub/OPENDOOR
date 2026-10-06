import type { ComparisonBlock } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * "Without an organised process / with one", as rows of pairs.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THIS COMPONENT IS DESIGNED SO IT CANNOT BECOME AN ACCUSATION
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The obvious way to build a "without / with" comparison is red crosses on the
 * left and green ticks on the right. That would be a mistake here, and not a
 * stylistic one: the baseline describes what happens when owners are not
 * organised, and the party a reader would infer blame onto is the developer,
 * who is a necessary partner representing its own interests, exactly as any
 * professional party does.
 *
 * So the baseline gets NO red, NO warning icon, NO negative framing. It is set
 * in the ordinary body tone, under a drawing of scattered points. The organised
 * side carries the teal rule, the wash and a drawing of the same points in
 * order, which reads as emphasis rather than as verdict. The block's `note`
 * says so in words, directly under the comparison.
 *
 * ── ROWS, SINCE 2026-10 ────────────────────────────────────────────────────
 *
 * The points pair up by position (information, standing, pace, comparing
 * offers), so each row now shows one pair of titles side by side and the eye
 * reads across, not down two columns of eight paragraphs. The paragraphs are
 * all still there: a row is a native <details>, and opening it shows both.
 * That was the design review's ask: the difference visible at a glance, the
 * explanation one tap away. Screen readers hear each side's label before its
 * title, since a summary holding two bare titles would not say which is which.
 *
 * The two sides stay side by side on a phone: the comparison is the point,
 * and the titles are short enough for half the width.
 */
const STRUCTURE = '#82878A'
const BRAND = '#0D8B8B'

function Scattered() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 200 56" className="h-10 w-full max-w-[12rem] md:h-12">
      {[[24, 14], [70, 40], [112, 12], [160, 36], [46, 34]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" fill="none" stroke={STRUCTURE} strokeWidth="2" />
      ))}
    </svg>
  )
}

function Ordered() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 200 56" className="h-10 w-full max-w-[12rem] md:h-12">
      {[56, 78, 100, 122, 144].map((cx) => (
        <circle key={cx} cx={cx} cy="28" r="7" fill={BRAND} />
      ))}
    </svg>
  )
}

export async function ComparisonBlockView({ block, t }: { block: ComparisonBlock; t: Localizer }) {
  const tUi = await getTranslations('ui')
  const baseLabel = t(block.baseline.label)
  const orgLabel = t(block.organised.label)
  const count = Math.max(block.baseline.points.length, block.organised.points.length)
  const rows = Array.from({ length: count }, (_, index) => ({
    base: block.baseline.points[index],
    org: block.organised.points[index],
  }))

  return (
    <Section tone="sunken" size="md">
      {(block.heading || block.intro) && (
        <SectionHeading heading={block.heading} intro={block.intro} t={t} />
      )}
      <p className="mt-4 type-small text-gray-600">{tUi('expandRowHint')}</p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="grid grid-cols-2">
          <div className="flex flex-col gap-3 p-4 md:p-6">
            <Scattered />
            <p className="type-body font-bold text-gray-700">{baseLabel}</p>
          </div>
          <div className="relative flex flex-col gap-3 border-s border-gray-200 bg-teal-50 p-4 md:p-6">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-teal-600" />
            <Ordered />
            <p className="type-body font-bold text-teal-700">{orgLabel}</p>
          </div>
        </div>

        <ul className="divide-y divide-gray-200 border-t border-gray-200">
          {rows.map(({ base, org }, index) => (
            <li key={base?.id ?? org?.id ?? index}>
              <details className="group">
                <summary className="grid cursor-pointer list-none grid-cols-2 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                  <span className="p-4 type-body font-semibold text-gray-700 md:px-6">
                    <span className="sr-only">{baseLabel}: </span>
                    {base ? t(base.title) : ''}
                    <span className="sr-only">. </span>
                  </span>
                  <span className="flex items-start justify-between gap-3 border-s border-gray-200 p-4 type-body font-semibold text-gray-900 md:px-6">
                    <span>
                      <span className="sr-only">{orgLabel}: </span>
                      {org ? t(org.title) : ''}
                    </span>
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-1 shrink-0 text-teal-600 group-open:rotate-180 motion-safe:transition-transform"
                    >
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </span>
                </summary>
                <div className="grid grid-cols-2">
                  <p className="px-4 pb-5 type-small text-gray-600 md:px-6">{base ? t(base.body) : ''}</p>
                  <p className="border-s border-gray-200 px-4 pb-5 type-small text-gray-700 md:px-6">
                    {org ? t(org.body) : ''}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>

      {block.note && <p className="mt-6 max-w-3xl type-body text-gray-600">{t(block.note)}</p>}
    </Section>
  )
}
