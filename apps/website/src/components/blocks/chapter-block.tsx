import type { ChapterBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { EditorialImage } from '@/components/brand/editorial-image'
import { STROKE } from '@/components/brand/architecture'
import { getImageSlot, IMAGE_SLOTS } from '@/mock/fixtures/images'
import { Section } from './section'

/**
 * One section of a longer argument: text on one side, an image on the other.
 *
 * ── SIDE AND SURFACE COME FROM THE SEQUENCE ────────────────────────────────
 *
 * `position` is this chapter's index among the page's chapters, supplied by
 * `PageBlocks`. Odd positions put the image on the start side and the section
 * on the sunken surface, so consecutive chapters alternate without the content
 * saying how, and reordering them in the CMS cannot stack three images on one
 * side.
 *
 * ── JUSTIFIED FROM THE SMALL BREAKPOINT UP ─────────────────────────────────
 *
 * Body text is justified, as the approved design sets it. Not on a phone: a
 * justified column thirty-odd characters wide opens gaps between words that
 * hurt reading more than a ragged edge does, and browsers do not hyphenate
 * Hebrew to close them.
 *
 * ── A CHAPTER CAN SHIP BEFORE ITS PHOTOGRAPH ───────────────────────────────
 *
 * The image comes from a slot. A slot without an asset draws its architectural
 * fallback, so the composition holds while the photograph is still to be
 * taken. That matters most for a portrait: a generated likeness of a real
 * person is a fabrication, not a placeholder, and the drawing stands in instead.
 */
export async function ChapterBlockView({
  block,
  t,
  position,
}: {
  block: ChapterBlock
  t: Localizer
  position: number
}) {
  const slot =
    block.slotId && block.slotId in IMAGE_SLOTS
      ? await getImageSlot(block.slotId as keyof typeof IMAGE_SLOTS)
      : null
  const flipped = position % 2 === 1
  const paragraphs = block.body
    ? t(block.body)
        .split('\n')
        .filter((paragraph) => paragraph.trim().length > 0)
    : []

  return (
    <Section size="lg" tone={flipped ? 'sunken' : 'page'}>
      <div
        className={`flex flex-col gap-12 lg:items-center lg:gap-[4.5rem] ${
          flipped ? 'lg:flex-row-reverse' : 'lg:flex-row'
        }`}
      >
        <div className="min-w-0 lg:flex-1">
          {block.numeral && (
            <span
              aria-hidden="true"
              className="block text-[5.5rem] font-extrabold leading-[0.9] text-transparent sm:text-[7.5rem]"
              style={{ WebkitTextStroke: `1.5px ${STROKE.teal}` }}
            >
              {block.numeral}
            </span>
          )}

          <h2
            className={`text-3xl font-bold leading-[1.15] tracking-tight text-gray-900 sm:text-[2.5rem] ${
              block.numeral ? 'mt-6' : ''
            }`}
          >
            {t(block.heading)}
          </h2>

          {block.quote && (
            <blockquote className="m-0 mt-8">
              <p className="text-2xl font-bold leading-[1.35] tracking-[-0.01em] text-teal-800 sm:text-justify sm:text-[2rem]">
                {t(block.quote)}
              </p>
            </blockquote>
          )}

          {block.lead && (
            <p className="mt-6 text-lg leading-[1.7] text-gray-900 sm:text-justify sm:text-xl">
              {t(block.lead)}
            </p>
          )}

          {paragraphs.length > 0 && (
            <div className={`space-y-4 ${block.quote ? 'mt-8' : 'mt-5'}`}>
              {paragraphs.map((paragraph, index) => (
                <p
                  key={index}
                  className="text-base leading-[1.75] text-gray-600 sm:text-justify sm:text-lg"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {block.emphasis && (
            <p className="mt-6 text-lg font-semibold leading-relaxed text-teal-600 sm:text-xl">
              {t(block.emphasis)}
            </p>
          )}
        </div>

        {slot && (
          <div className="min-w-0 lg:flex-1">
            <EditorialImage
              t={t}
              slot={slot}
              sizes="(min-width: 1024px) 40vw, 100vw"
              className={slot.orientation === 'portrait' ? 'aspect-[4/5]' : 'aspect-[4/3]'}
            />
          </div>
        )}
      </div>
    </Section>
  )
}
