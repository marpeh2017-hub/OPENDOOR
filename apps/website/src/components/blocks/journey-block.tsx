import type { JourneyBlock, JourneyStage } from '@urban-renewal/api-contracts'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { Reveal } from '@/components/brand/reveal'
import { ProjectPattern, STROKE } from '@/components/brand/architecture'
import { ContextFigure } from '@/components/brand/context-figure'
import { stageImages, residentMeeting } from '@/content/editorial-assets'
import { getTranslations } from 'next-intl/server'

/**
 * The process, at page scale.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THIS IS A SHAPE, NOT A SCHEDULE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Eight numbered stages laid out in order will be read as a fixed statutory
 * sequence unless the page says otherwise. It is not one: projects differ in
 * planning route, ownership structure and timing, several stages overlap, and
 * some repeat.
 *
 * `variabilityNote` is REQUIRED by the type and renders BEFORE the first
 * stage. Placing it after would make it a disclaimer; placing it first makes
 * it context, which is what it is.
 *
 * There is no `state` on a stage and no current-step marker. This is the
 * company's process, not any project's status, and highlighting a stage here
 * would be a claim about a real building nobody verified.
 *
 * ── `asks` IS THE POINT OF THE PAGE ────────────────────────────────────────
 *
 * A process page that only lists what the company does is a brochure. What an
 * owner wants to know is what THEY will have to do, so every stage that asks
 * something says so, in its own emphasised line. Stages that ask nothing omit
 * the field rather than inventing a task to fill the slot.
 *
 * ── STAGE HEADING LEVEL FOLLOWS THE BLOCK, NOT A GUESS ─────────────────────
 *
 * The block's own heading is optional: /how-we-work lets the PAGE_HEADER title
 * the process and supplies none. Hardcoding `h3` on the stages would then skip
 * a level straight from the page `h1`, so the level is derived — `h3` beneath
 * the block heading when there is one, `h2` when the stages are the first
 * headings under the page title.
 *
 * ── ALTERNATION ────────────────────────────────────────────────────────────
 *
 * Stages alternate sides on desktop with the process line running between
 * them, which is the homepage's device given room. On mobile they align to one
 * side and the line moves to the inline edge beside the numbers — a zigzag on
 * a 375px screen is just noise.
 */
export async function JourneyBlockView({
  block,
  t,
}: {
  block: JourneyBlock
  t: Localizer
}) {
  const tJourney = await getTranslations('journeyPage')

  // See STAGE HEADING LEVEL above.
  const stageHeadingLevel = block.heading ? 'h3' : 'h2'

  return (
    <>
      {(block.heading || block.intro) && (
        <Section size="sm">
          <SectionHeading heading={block.heading} intro={block.intro} t={t} size="lg" />
        </Section>
      )}

      {/* The variability note, before anything numbered. */}
      <div className="border-y border-gray-200 bg-surface-sunken">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <p className="max-w-4xl text-[15px] leading-relaxed text-gray-700">
            {t(block.variabilityNote)}
          </p>
        </div>
      </div>

      {/* The journey. One continuous line down the centre on desktop. */}
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute bottom-0 top-0 hidden w-px lg:block"
          style={{
            insetInlineStart: '50%',
            background: `linear-gradient(to bottom, ${STROKE.teal}, ${STROKE.faint})`,
          }}
        />

        <ol>
          {block.stages.map((stage, index) => (
            <StageRow
              key={stage.id}
              stage={stage}
              index={index}
              t={t}
              headingLevel={stageHeadingLevel}
              illustrated={block.id === 'how-journey'}
              asksLabel={tJourney('asksLabel')}
            />
          ))}
        </ol>
      </div>
      {block.id === 'how-journey' && (
        <Section size="sm"><ContextFigure asset={residentMeeting} t={t} /></Section>
      )}
    </>
  )
}

function StageRow({
  stage,
  index,
  t,
  headingLevel: Heading,
  asksLabel,
  illustrated,
}: {
  stage: JourneyStage
  index: number
  t: Localizer
  headingLevel: 'h2' | 'h3'
  illustrated: boolean
  asksLabel: string
}) {
  const flipped = index % 2 === 1
  // Alternating surface, so consecutive bands are distinguishable without a
  // border under every one.
  const surface = index % 2 === 0 ? 'bg-surface-page' : 'bg-white'

  const text = (
    <div>
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-teal-600 bg-white text-xs font-bold tabular-nums text-teal-800"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <Heading className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
          {t(stage.title)}
        </Heading>
      </div>

      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-gray-600 sm:text-base">
        {t(stage.body)}
      </p>

      {stage.asks && (
        <p className="mt-5 max-w-xl border-s-2 border-teal-300 ps-4 text-sm leading-relaxed text-gray-700">
          <span className="font-semibold text-gray-900">{asksLabel}</span>{' '}
          {t(stage.asks)}
        </p>
      )}
    </div>
  )

  const assignment = illustrated ? stageImages[stage.id] : undefined
  const asset = assignment?.title === stage.title.he ? assignment.asset : undefined
  const graphic = asset ? <ContextFigure asset={asset} t={t} /> : (
    <div className="aspect-[16/9] overflow-hidden bg-surface-sunken">
      {/* Deterministic per stage, so the eight marks differ from one another
          and stay the same on every render. The variation encodes nothing. */}
      <ProjectPattern slug={stage.id} />
    </div>
  )

  return (
    <li className={`relative ${surface}`}>
      <Reveal>
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-12">
          {/* DOM order is always text first, so the reading and tab order stay
              consistent; `lg:order-*` does the visual alternation. */}
          <div className={flipped ? 'lg:order-2' : ''}>{text}</div>
          <div className={`${asset ? 'block' : 'hidden lg:block'} ${flipped ? 'lg:order-1' : ''}`}>{graphic}</div>
        </div>
      </Reveal>
    </li>
  )
}
