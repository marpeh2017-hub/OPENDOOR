import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { Reveal } from '@/components/brand/reveal'
import { STROKE } from '@/components/brand/architecture'
import { ContextFigure } from '@/components/brand/context-figure'
import { getImageSlot } from '@/mock/fixtures/images'

/**
 * "כך אנחנו עובדים" — the signature process section.
 *
 * ── A STEPPED JOURNEY, NOT A PROGRESS BAR ──────────────────────────────────
 *
 * The five stages climb: each column sits higher than the last, and the line
 * between them steps up with them. That shape says "a long route with stages"
 * where a flat horizontal bar says "a measured percentage" — and a percentage
 * is a claim about a specific project, which this section is emphatically not
 * making. It is the company's process, not anyone's status.
 *
 * ── NO CURRENT STAGE ───────────────────────────────────────────────────────
 *
 * Every marker is rendered in the same neutral state. Emphasising one would
 * read as "we are here", which would be a fabricated fact. The brief asks that
 * a stage receive emphasis as it enters the viewport, and it does — but as a
 * reveal, one after another, which conveys sequence without asserting progress.
 *
 * ── MOBILE ─────────────────────────────────────────────────────────────────
 *
 * The line rotates to vertical and the stages stack. No horizontal scrolling:
 * a five-stage process that a phone user has to swipe through is a process
 * three of five people will never see the end of.
 */
export async function ProcessBlockView({ block, t }: { block: FeatureGridBlock; t: Localizer }) {
  const count = block.items.length

  // Stable homepage stage IDs only: never assign a process illustration to
  // arbitrary CMS content or imply that these are photographs of our work.
  const illustrations: Record<string, string> = {
    'ph-1': 'st-1', 'ph-2': 'st-3', 'ph-3': 'st-6', 'ph-4': 'st-7', 'ph-5': 'st-8',
  }
  if (block.id === 'home-process' && block.items.every((item) => illustrations[item.id])) {
    const slots = await Promise.all(block.items.map((item) => getImageSlot(`PROCESS_STAGE_${illustrations[item.id].replace('st-', '')}`)))
    return (
      <Section tone="sunken" size="lg">
        <SectionHeading heading={block.heading} t={t} size="lg" />
        <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((item, index) => (
            <li key={item.id}>
              {slots[index].asset && <ContextFigure asset={slots[index].asset} t={t} uniform captionHidden />}
              <h3 className="mt-4 flex min-h-14 items-baseline gap-3 text-xl font-semibold text-gray-900">
                <span className="shrink-0 text-sm tabular-nums text-teal-700">{String(index + 1).padStart(2, '0')}{' '}</span>
                {t(item.title)}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-gray-600">{t(item.body)}</p>
            </li>
          ))}
        </ol>
      </Section>
    )
  }

  return (
    <Section tone="sunken" size="lg" grid>
      <SectionHeading heading={block.heading} intro={block.intro} t={t} size="lg" />

      {/* ── desktop: the stepped journey ────────────────────────────────── */}
      <ol className="relative mt-16 hidden md:grid" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {block.items.map((item, index) => {
          // Each stage rises by a fixed step. The last one is the summit, so the
          // composition reads left-to-right (or right-to-left) as an ascent.
          const rise = (count - 1 - index) * 26

          return (
            <Reveal
              as="li"
              key={item.id}
              delay={index * 90}
              className="relative px-3 first:ps-0 last:pe-0"
            >
              <div style={{ marginTop: `${rise}px` }}>
                {/* The connector to the NEXT stage, drawn as a step. Omitted on
                    the last item, which has nothing to connect to. */}
                {index < count - 1 && (
                  <span aria-hidden="true" className="absolute top-[17px] w-full">
                    <span
                      className="absolute h-px w-full"
                      style={{
                        background: STROKE.faint,
                        insetInlineStart: '50%',
                        top: `${rise}px`,
                      }}
                    />
                    {/* the vertical riser between this stage and the next */}
                    <span
                      className="absolute w-px"
                      style={{
                        background: STROKE.faint,
                        insetInlineStart: 'calc(150% - 0.5px)',
                        top: `${rise - 26}px`,
                        height: '26px',
                      }}
                    />
                  </span>
                )}

                <span className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-teal-600 bg-white text-xs font-bold tabular-nums text-teal-800">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <h3 className="mt-6 text-base font-semibold text-gray-900 lg:text-lg">
                  {t(item.title)}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-gray-600">{t(item.body)}</p>
              </div>
            </Reveal>
          )
        })}
      </ol>

      {/* ── mobile: the same line, vertical ─────────────────────────────── */}
      <ol className="relative mt-12 md:hidden">
        <span
          aria-hidden="true"
          className="absolute bottom-8 start-[17px] top-3 w-px"
          style={{ background: `linear-gradient(to bottom, ${STROKE.teal}, ${STROKE.faint})` }}
        />
        {block.items.map((item, index) => (
          <li key={item.id} className="relative ps-12 pb-9 last:pb-0">
            <span className="absolute start-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-teal-600 bg-white text-xs font-bold tabular-nums text-teal-800">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="pt-1.5 text-base font-semibold text-gray-900">{t(item.title)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{t(item.body)}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
