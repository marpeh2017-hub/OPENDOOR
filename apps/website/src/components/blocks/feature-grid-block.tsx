import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * FEATURE_GRID · PROCESS · PROJECT_TRANSPARENCY · TRUST.
 *
 * One component, four presentations, because the content shape is identical —
 * a heading, an intro, and a list of titled paragraphs. What differs is
 * arrangement, and arrangement belongs to the renderer.
 *
 * ── NO CARDS HERE, ON PURPOSE ──────────────────────────────────────────────
 *
 * The brief warns against putting every section in a card. These items are
 * separated by a short teal rule and whitespace instead of a border and a
 * shadow. Bordered boxes would give three equal-weight rectangles competing
 * with the section heading; a rule reads as punctuation and lets the type do
 * the work.
 */
export function FeatureGridBlockView({
  block,
  t,
  tone,
}: {
  block: FeatureGridBlock
  t: Localizer
  tone?: 'page' | 'raised' | 'sunken'
}) {
  if (block.type === 'PROCESS') return <ProcessView block={block} t={t} tone={tone} />
  if (block.type === 'PROJECT_TRANSPARENCY') return <TransparencyView block={block} t={t} tone={tone} />

  const columns = block.items.length >= 4 ? 'lg:grid-cols-3' : 'lg:grid-cols-3'

  return (
    <Section tone={tone}>
      <SectionHeading heading={block.heading} intro={block.intro} t={t} />
      <div className={`mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 ${columns}`}>
        {block.items.map((item) => (
          <div key={item.id}>
            <span className="block h-0.5 w-10 bg-teal-600" aria-hidden="true" />
            <h3 className="mt-5 text-lg font-semibold text-gray-900">{t(item.title)}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{t(item.body)}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/**
 * Process.
 *
 * A numbered progression, not a decorated list. On desktop the five phases run
 * along a single hairline with numbered nodes; on mobile that line rotates to
 * vertical rather than collapsing into five unrelated blocks — the sequence IS
 * the message, and a stack of cards loses it.
 */
function ProcessView({
  block, t, tone,
}: { block: FeatureGridBlock; t: Localizer; tone?: 'page' | 'raised' | 'sunken' }) {
  return (
    <Section tone={tone}>
      <SectionHeading heading={block.heading} intro={block.intro} t={t} />

      <ol className="relative mt-12 grid gap-8 md:grid-cols-5 md:gap-6">
        {/* The connecting line. Horizontal on desktop, vertical on mobile —
            `start-*` rather than `left-*` so it follows text direction. */}
        <span
          className="absolute start-[15px] top-2 bottom-2 w-px bg-gray-200 md:inset-x-0 md:start-0 md:top-[15px] md:bottom-auto md:h-px md:w-full"
          aria-hidden="true"
        />
        {block.items.map((item, index) => (
          <li key={item.id} className="relative ps-11 md:ps-0">
            <span
              className="absolute start-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-teal-600 bg-white text-sm font-semibold text-teal-700 md:relative md:mb-5"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <h3 className="text-base font-semibold text-gray-900 md:mt-0">{t(item.title)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{t(item.body)}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/**
 * Project transparency.
 *
 * Shows the completed → current → next SHAPE with no project attached to it.
 * The three states are demonstrated as a concept, and the block's own intro
 * says the view is a demonstration — so nothing here can be read as a statement
 * about a real building's progress.
 *
 * There is no percentage and no bar. A progress bar implies a measured
 * fraction; eleven named stages with one marked "current" is a fact.
 */
function TransparencyView({
  block, t, tone,
}: { block: FeatureGridBlock; t: Localizer; tone?: 'page' | 'raised' | 'sunken' }) {
  const states = ['completed', 'current', 'upcoming'] as const

  return (
    <Section tone={tone}>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <SectionHeading heading={block.heading} intro={block.intro} t={t} />
        </div>

        <ol className="space-y-0">
          {block.items.map((item, index) => {
            const state = states[index] ?? 'upcoming'
            return (
              <li key={item.id} className="relative flex gap-4 ps-1">
                {/* Connector between nodes, omitted after the last. */}
                {index < block.items.length - 1 && (
                  <span
                    className="absolute start-[15px] top-8 h-[calc(100%-1rem)] w-px bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={[
                    'relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                    state === 'completed' && 'border-teal-600 bg-teal-600 text-white',
                    state === 'current' && 'border-teal-600 bg-white text-teal-700',
                    state === 'upcoming' && 'border-gray-300 bg-white text-gray-400',
                  ].filter(Boolean).join(' ')}
                  aria-hidden="true"
                >
                  {state === 'completed' ? (
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                      <path d="M5 10.5l3.5 3.5L15 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-current" />
                  )}
                </span>
                <div className="pb-8">
                  <h3 className="text-base font-semibold text-gray-900">{t(item.title)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{t(item.body)}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </Section>
  )
}
