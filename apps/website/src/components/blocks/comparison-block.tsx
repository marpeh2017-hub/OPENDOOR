import type { ComparisonBlock, ComparisonColumn } from '@urban-renewal/api-contracts'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { STROKE } from '@/components/brand/architecture'

/**
 * Two columns, side by side.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THIS COMPONENT IS DESIGNED SO IT CANNOT BECOME AN ACCUSATION
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The obvious way to build a "without / with" comparison is red crosses on the
 * left and green ticks on the right. That would be a mistake here, and not a
 * stylistic one: the left column describes what happens when owners are not
 * organised, and the party a reader would infer blame onto is the developer —
 * who is a necessary partner representing its own interests, exactly as any
 * professional party does.
 *
 * So the baseline column gets NO red, NO warning icon, NO negative framing. It
 * is set in the ordinary body tone on the ordinary surface. The only visual
 * difference is that the organised column carries the teal rule and sits on
 * white, which reads as emphasis rather than as verdict.
 *
 * The block's `note` states the point in words as well, and it renders
 * directly under both columns rather than at the foot of the page, because a
 * clarification a reader has to scroll to find is a clarification most readers
 * never see.
 *
 * ── ORDER ON MOBILE ────────────────────────────────────────────────────────
 *
 * The columns stack in DOM order, so the organised column comes second. That
 * is deliberate: on a phone the last thing read before scrolling on should be
 * what an organised process makes possible, not what happens without one.
 */
export function ComparisonBlockView({ block, t }: { block: ComparisonBlock; t: Localizer }) {
  return (
    <Section tone="sunken" size="lg">
      {(block.heading || block.intro) && (
        <SectionHeading heading={block.heading} intro={block.intro} t={t} size="lg" />
      )}

      <div className="mt-12 grid bg-white lg:grid-cols-2">
        <Column column={block.baseline} t={t} emphasis={false} />
        <Column column={block.organised} t={t} emphasis />
      </div>

      {block.note && (
        <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-gray-600">
          {t(block.note)}
        </p>
      )}
    </Section>
  )
}

function Column({
  column,
  t,
  emphasis,
}: {
  column: ComparisonColumn
  t: Localizer
  emphasis: boolean
}) {
  return (
    <div
      className={`relative p-7 sm:p-8 ${
        // A dividing rule between the columns on desktop; a top rule between
        // them once they stack. `border-s` and `border-t` are logical, so the
        // divider lands on the correct side in both directions.
        emphasis ? 'border-t border-gray-200 lg:border-s lg:border-t-0' : ''
      }`}
    >
      {emphasis && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: STROKE.tealDeep }}
        />
      )}

      <p
        className={`text-xs font-bold uppercase tracking-[0.14em] ${
          emphasis ? 'text-teal-800' : 'text-gray-600'
        }`}
      >
        {t(column.label)}
      </p>

      <div className="mt-6 divide-y divide-gray-200">
        {column.points.map((point, index) => (
          <div key={point.id} className={index === 0 ? 'pb-5' : 'py-5 last:pb-0'}>
            <h3
              className={`text-[15px] font-semibold ${
                emphasis ? 'text-gray-900' : 'text-gray-700'
              }`}
            >
              {t(point.title)}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{t(point.body)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
