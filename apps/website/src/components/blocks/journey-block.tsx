import type { JourneyBlock, JourneyStage } from '@urban-renewal/api-contracts'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { Reveal } from '@/components/brand/reveal'
import { ProjectPattern, STROKE } from '@/components/brand/architecture'
import { ContextFigure } from '@/components/brand/context-figure'
import { stageImages } from '@/content/editorial-assets'
import { getImageSlot } from '@/mock/fixtures/images'
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
 *
 * ── A ROW AS TALL AS ITS TEXT ──────────────────────────────────────────────
 *
 * The 2026-10 review found /how-we-work too long, mostly for its pictures:
 * each half the row's width at 4:3, with 96px between stages. The approved
 * design keeps every stage and every word and shrinks the frame: 48px between
 * stages, and each picture about 40% of the row at 16:9, a crop the eight
 * pictures were checked to survive. The picture keeps to the outer edge of
 * its half, in line with the page's margins.
 *
 * On a phone the picture comes straight under the stage's title, before its
 * text, so it reads as that stage's picture and not as the start of the next.
 * One DOM order serves both: title, picture, text. On desktop a grid puts the
 * title and the text in one column, centred together beside the picture.
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
          <p className="max-w-4xl type-small text-gray-700">
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
    </>
  )
}

async function StageRow({
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

  const title = (
    <div className="flex items-center gap-4">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-teal-600 bg-white text-xs font-bold tabular-nums text-teal-800"
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <Heading className="type-h3 font-bold text-gray-900">
        {t(stage.title)}
      </Heading>
    </div>
  )

  const text = (
    <div>
      <p className="max-w-xl type-body text-gray-600">
        {t(stage.body)}
      </p>

      {stage.asks && (
        <p className="mt-5 max-w-xl border-s-2 border-teal-300 ps-4 type-small text-gray-700">
          <span className="font-semibold text-gray-900">{asksLabel}</span>{' '}
          {t(stage.asks)}
        </p>
      )}
    </div>
  )

  const assignment = illustrated ? stageImages[stage.id] : undefined
  const asset = assignment?.title === stage.title.he
    ? (await getImageSlot(`PROCESS_STAGE_${stage.id.replace('st-', '')}`)).asset
    : undefined
  const graphic = asset ? <ContextFigure asset={asset} t={t} wide /> : (
    <div className="aspect-[16/9] overflow-hidden bg-surface-sunken">
      {/* Deterministic per stage, so the eight marks differ from one another
          and stay the same on every render. The variation encodes nothing. */}
      <ProjectPattern slug={stage.id} />
    </div>
  )

  return (
    // The id is the stage index's anchor (STAGE_INDEX); the scroll margin
    // keeps the row clear of the sticky header when it lands.
    <li id={stage.id} className={`relative scroll-mt-16 ${surface}`}>
      <Reveal>
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-2 lg:grid-rows-[auto_auto] lg:gap-x-16 lg:px-8">
          {/* DOM order is title, picture, text on every row, so the reading
              order never changes; the grid places them (A ROW AS TALL AS ITS
              TEXT). The title sits at the foot of the first row and the text
              at the head of the second, so the pair is centred beside the
              picture spanning both. */}
          <div className={`lg:row-start-1 lg:self-end ${flipped ? 'lg:col-start-2' : 'lg:col-start-1'}`}>{title}</div>
          <div
            className={`${asset ? 'block' : 'hidden lg:block'} lg:row-span-2 lg:row-start-1 lg:w-[84%] lg:self-center ${
              flipped ? 'lg:col-start-1 lg:justify-self-start' : 'lg:col-start-2 lg:justify-self-end'
            }`}
          >
            {graphic}
          </div>
          <div className={`lg:row-start-2 lg:self-start ${flipped ? 'lg:col-start-2' : 'lg:col-start-1'}`}>{text}</div>
        </div>
      </Reveal>
    </li>
  )
}
