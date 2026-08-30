import type { HeroBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import {
  ArchitecturalGrid,
  HeroComposition,
  HeroMarkCompact,
  STROKE,
} from '@/components/brand/architecture'

/**
 * Hero.
 *
 * ── WHAT CHANGED FROM V1 ───────────────────────────────────────────────────
 *
 * V1's hero was a two-column grid with a small line icon on the right. It was
 * correct and inert. Three things changed:
 *
 *   SCALE      the headline runs to `display-lg` on desktop, roughly a third
 *              larger, and the measure is held near 20 characters per line so
 *              it breaks into a shape rather than a paragraph.
 *   LAYERS     the drawing is now four depths on a planning grid and it bleeds
 *              past the container edge, so the composition continues off-screen
 *              instead of sitting in a box.
 *   CONTINUITY the process line leaves the drawing at the bottom and is picked
 *              up by the connector below the hero — the page's journey starts
 *              inside the graphic.
 *
 * ── THE POSITIONING CUE ────────────────────────────────────────────────────
 *
 * "חברה מארגנת — לא יזם" is the most important sentence on the page and V1
 * rendered it as a pill badge, which is the visual language of a status chip.
 * It is now set as a rule-and-caps line: quieter, more editorial, and it reads
 * as a statement of what the company IS rather than as a label stuck on it.
 *
 * ── MOBILE ─────────────────────────────────────────────────────────────────
 *
 * V1 hid the graphic entirely below `lg`, so a phone visitor met no brand
 * identity at all on the first screen. A separate compact mark now runs full
 * width under the CTAs — same grammar, fewer layers, no shrunken desktop art.
 */
export function HeroBlockView({ block, t }: { block: HeroBlock; t: Localizer }) {
  return (
    <section className="relative overflow-hidden bg-white">
      <ArchitecturalGrid size={48} opacity={0.7} />

      {/* A single teal hairline running the height of the hero, offset from the
          text column. It is the first stroke of the process line, and it is why
          the section has a vertical axis instead of just a background. */}
      <span
        aria-hidden="true"
        className="absolute bottom-0 top-0 hidden w-px lg:block"
        style={{
          insetInlineStart: '58%',
          background: `linear-gradient(to bottom, transparent, ${STROKE.hair} 20%, ${STROKE.faint} 100%)`,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-12 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="odg-hero-enter">
          {block.eyebrow && (
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">
              <span aria-hidden="true" className="h-px w-8 bg-teal-600" />
              {t(block.eyebrow)}
            </p>
          )}

          {/* `text-balance` keeps the Hebrew from leaving one orphaned word on
              the last line, which at this size is very visible. */}
          <h1 className="mt-6 max-w-[19ch] text-[2rem] font-bold leading-[1.1] tracking-tight text-gray-900 text-balance sm:text-display-sm lg:text-display-lg">
            {t(block.heading)}
          </h1>

          {block.subheading && (
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-gray-600 sm:text-xl sm:leading-relaxed">
              {t(block.subheading)}
            </p>
          )}

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href={block.primaryCtaHref}
              className="group inline-flex items-center justify-center gap-2.5 rounded-md bg-teal-600 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-teal-700"
            >
              {t(block.primaryCtaLabel)}
              {/* `rtl:rotate-180` mirrors the glyph, because "forward" is left
                  in Hebrew and an unmirrored → points backwards. Rotating also
                  reverses the hover translate for free: Tailwind composes the
                  translate before the rotation, so +3px moves it visually left
                  in RTL without a second direction-specific class. */}
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
              >
                →
              </span>
            </Link>

            {block.secondaryCtaLabel && block.secondaryCtaHref && (
              <Link
                href={block.secondaryCtaHref}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-7 py-4 text-base font-semibold text-gray-800 transition-colors hover:border-teal-600 hover:text-teal-800"
              >
                {t(block.secondaryCtaLabel)}
              </Link>
            )}
          </div>

          {block.note && (
            <p className="mt-7 flex items-start gap-3 border-s-2 border-teal-200 ps-4 text-sm leading-relaxed text-gray-600">
              {t(block.note)}
            </p>
          )}
        </div>

        {/* Desktop composition. Bleeds past the container so it reads as a
            drawing the page is sitting on, not a picture in a slot. */}
        <div className="relative mt-12 hidden lg:mt-0 lg:block">
          <div className="lg:-me-16 xl:-me-24">
            <HeroComposition />
          </div>
        </div>

        {/* Phone and tablet: the same idea, drawn for the width available. */}
        <div className="mt-12 lg:hidden">
          <HeroMarkCompact />
        </div>
      </div>
    </section>
  )
}
