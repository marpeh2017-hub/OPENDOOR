import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { MilestoneMarker, STROKE } from '@/components/brand/architecture'

/**
 * Project transparency — shown, not described.
 *
 * ── THE DEMONSTRATION IS EXPLICITLY A DEMONSTRATION ────────────────────────
 *
 * A stage list with ticks against it is the most persuasive thing on this page
 * and therefore the most dangerous. Four safeguards:
 *
 *   1. The stage NAMES come from the shared `stages` message catalogue — the
 *      same eleven-stage vocabulary the CRM uses. Nothing here is invented
 *      copy dressed up as product data.
 *   2. No project name is attached, anywhere, in any form.
 *   3. A permanent badge inside the frame marks it as an illustration.
 *   4. The block's own intro (content, not this file) states that the view
 *      demonstrates the structure and does not describe an existing project.
 *
 * ── WHY IT LEADS INTO THE PORTAL ───────────────────────────────────────────
 *
 * This section and the portal section below it are one argument: OpenDoor
 * explains the process publicly, and residents then follow their own copy of
 * it privately. So the frame here uses the same portal motif and the same
 * MilestoneMarker as the portal preview, and the section is set on white while
 * the portal is set on the page surface — adjacent, related, not identical.
 */

/**
 * The demonstrated stages.
 *
 * Keys into the shared `stages` namespace, so the labels are translated once
 * and match the vocabulary used everywhere else in the system. The states are
 * fixed here because they describe the SHAPE being demonstrated — completed,
 * current, upcoming — and belong to the demonstration, not to any project.
 */
const DEMO_STAGES = [
  { key: 'OWNER_ORGANIZATION', state: 'completed' },
  { key: 'REPRESENTATION_FORMED', state: 'completed' },
  { key: 'DEVELOPER_TENDER', state: 'current' },
  { key: 'DEVELOPER_SELECTED', state: 'upcoming' },
  { key: 'PLANNING', state: 'upcoming' },
] as const

export async function TransparencyBlockView({
  block,
  t,
}: {
  block: FeatureGridBlock
  t: Localizer
}) {
  const [tStages, tUi] = await Promise.all([getTranslations('stages'), getTranslations('ui')])

  return (
    <Section tone="raised" size="lg">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:items-start lg:gap-20">
        <div className="lg:sticky lg:top-28">
          <SectionHeading
            heading={block.heading}
            intro={block.intro}
            t={t}
            size="lg"
            eyebrow={tUi('transparencyEyebrow')}
          />

          {/* The three explanations: completed / now / next. A divided list
              rather than three cards, so the timeline beside it stays the
              subject of the section. */}
          <dl className="mt-10 divide-y divide-gray-200 border-t border-gray-200">
            {block.items.map((item) => (
              <div key={item.id} className="py-5">
                <dt className="text-sm font-semibold text-gray-900">{t(item.title)}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-gray-600">{t(item.body)}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── the demonstration frame ───────────────────────────────────── */}
        <div className="relative">
          {/* Portal motif: the top edge is interrupted, and the visitor reads
              the timeline through the opening. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="absolute start-0 top-0 h-px w-[16%]" style={{ background: STROKE.teal }} />
            <span className="absolute end-0 top-0 h-px w-[44%]" style={{ background: STROKE.teal }} />
            <span className="absolute bottom-0 start-0 h-px w-full" style={{ background: STROKE.faint }} />
            <span className="absolute bottom-0 start-0 top-0 w-px" style={{ background: STROKE.faint }} />
            <span className="absolute bottom-0 end-0 top-0 w-px" style={{ background: STROKE.faint }} />
          </span>

          <div className="bg-surface-page/70 p-6 sm:p-8">
            <span className="inline-flex items-center gap-1.5 border border-gray-300 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
              <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-gray-400" />
              {tUi('demonstration')}
            </span>

            <ol className="mt-7">
              {DEMO_STAGES.map((stage, index) => {
                const last = index === DEMO_STAGES.length - 1
                return (
                  <li key={stage.key} className="relative flex gap-4">
                    {/* The spine, coloured by what has been passed. */}
                    {!last && (
                      <span
                        aria-hidden="true"
                        className="absolute start-[17px] top-9 w-px"
                        style={{
                          height: 'calc(100% - 1.25rem)',
                          background:
                            stage.state === 'completed' ? STROKE.teal : STROKE.faint,
                        }}
                      />
                    )}
                    <MilestoneMarker state={stage.state} />
                    <div className="pb-7">
                      <p
                        className={`text-[15px] leading-snug ${
                          stage.state === 'current'
                            ? 'font-semibold text-teal-800'
                            : stage.state === 'completed'
                              ? 'font-medium text-gray-900'
                              : 'text-gray-500'
                        }`}
                      >
                        {tStages(stage.key)}
                      </p>
                      {stage.state === 'current' && (
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-teal-700">
                          {tUi('currentStage')}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
    </Section>
  )
}
