import type { HeroBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { ArchitecturalGrid, STROKE } from '@/components/brand/architecture'
import { StoneCoursing } from '@/components/brand/jerusalem'
import { EditorialImage } from '@/components/brand/editorial-image'
import { getImageSlot } from '@/mock/fixtures/images'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  HERO V3 — THE CITY, SEEN THROUGH THE DOOR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The composition is one idea: a tall architectural APERTURE cut into the
 * page, with Jerusalem behind it. The visitor is standing on this side of a
 * threshold looking through at the city — which is exactly the position an
 * apartment owner is in at the start of an urban-renewal process, and exactly
 * what the company's name means.
 *
 * That is why the image is a PORTRAIT slot and not the usual landscape panel:
 * a doorway is taller than it is wide. The single decision that a portrait
 * aperture forces — and a rectangular stock panel does not — is what keeps
 * this off the "text left, image right" template the brief rules out.
 *
 * ── THE LAYERS, BACK TO FRONT ──────────────────────────────────────────────
 *
 *   planning grid        the survey, faint, across the whole section
 *   stone coursing       Jerusalem ashlar, inside the aperture's reveal
 *   the aperture         the city — drawing now, photograph when licensed
 *   the frame            three sides drawn, the head interrupted: the opening
 *   the thread           a teal line leaving the threshold, down the page
 *
 * ── THE HEADLINE IS SET AS ARCHITECTURE ────────────────────────────────────
 *
 * Not "the H1, but bigger". It is held to a deliberately narrow measure so it
 * breaks into three or four stacked lines of similar length — a BLOCK of type
 * with a flat edge, which is a built form rather than a paragraph. Its
 * inline-start edge aligns to the same rule the eyebrow and the note align to,
 * so the type column reads as a structural element of the composition.
 *
 * Hebrew was composed first: `max-w-[15ch]` and the leading were set against
 * the Hebrew string, which has no ascender/descender rhythm to loosen it and
 * therefore needs tighter line-height than the English would suggest. The
 * English then gets its own slightly wider measure rather than inheriting one
 * tuned for another script.
 *
 * ── WHY THE IMAGE CANNOT HURT READABILITY ──────────────────────────────────
 *
 * The type and the aperture occupy different columns and never overlap. There
 * is no text over photography anywhere in this hero, so no scrim is needed and
 * contrast cannot regress when a real photograph replaces the drawing — which
 * is the usual way a hero passes review and then fails it after the asset
 * lands.
 */
export function HeroBlockView({ block, t }: { block: HeroBlock; t: Localizer }) {
  const slot = getImageSlot('HERO_JERUSALEM_ARCHITECTURE')

  return (
    <section className="relative overflow-hidden bg-white">
      <ArchitecturalGrid size={48} opacity={0.7} />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="lg:grid lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-16">
          {/* ── the type column ──────────────────────────────────────────── */}
          <div className="odg-hero-enter relative">
            {/* The rule the whole type column aligns to. */}
            <span
              aria-hidden="true"
              className="absolute bottom-2 start-0 top-1 hidden w-px lg:block"
              style={{ background: STROKE.hair }}
            />

            <div className="lg:ps-8">
              {block.eyebrow && (
                <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
                  <span aria-hidden="true" className="h-px w-8 bg-teal-600" />
                  {t(block.eyebrow)}
                </p>
              )}

              {/* Narrow measure → a stacked block of type with a flat edge. */}
              <h1 className="mt-7 max-w-[15ch] text-[2.125rem] font-bold leading-[1.08] tracking-[-0.02em] text-gray-900 text-balance sm:text-display-sm lg:max-w-[16ch] lg:text-display-lg">
                {t(block.heading)}
              </h1>

              {block.subheading && (
                <p className="mt-8 max-w-lg text-lg leading-[1.65] text-gray-600 sm:text-xl sm:leading-[1.6]">
                  {t(block.subheading)}
                </p>
              )}

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={block.primaryCtaHref}
                  className="group inline-flex items-center justify-center gap-2.5 rounded-md bg-teal-600 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-teal-700"
                >
                  {t(block.primaryCtaLabel)}
                  {/* `rtl:rotate-180` mirrors the glyph — "forward" is left in
                      Hebrew — and reverses the hover translate for free, since
                      the translate composes before the rotation. */}
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
                <p className="mt-8 border-s-2 border-teal-200 ps-4 text-sm leading-relaxed text-gray-600">
                  {t(block.note)}
                </p>
              )}
            </div>
          </div>

          {/* ── the aperture ─────────────────────────────────────────────── */}
          <div className="relative mt-14 lg:mt-0">
            <Aperture slot={slot} t={t} />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * The threshold: a tall opening with the city behind it.
 *
 * The frame is drawn as four separate rules because the head is INTERRUPTED —
 * a border cannot carry a gap, and the gap is the entire motif. The reveal
 * (the stone coursing visible between the frame and the image) is what makes
 * it read as an opening cut through something rather than a picture with a
 * border around it.
 *
 * The teal thread leaves the sill and continues down the page: the journey the
 * homepage describes begins physically inside this graphic.
 */
function Aperture({
  slot,
  t,
}: {
  slot: ReturnType<typeof getImageSlot>
  /** Resolves the asset's alt text, which a screen reader announces. */
  t: Localizer
}) {
  return (
    <div className="relative">
      {/* the reveal — stone, the material of the wall being cut through */}
      <div className="relative bg-surface-page p-3 sm:p-4">
        <StoneCoursing id="odg-hero-stone" opacity={0.85} />

        <div className="relative">
          <EditorialImage
            t={t}
            slot={slot}
            priority
            sizes="(max-width: 1023px) 92vw, 46vw"
            // The caption would sit under the hero's most important control.
            // The image is a drawing today and claims nothing; when a
            // photograph lands the credit line belongs in the footer instead,
            // which is noted in the inventory.
            captionHidden
            className="aspect-[16/10] w-full lg:aspect-[3/4]"
          />

          {/* the frame — head interrupted */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span
              className="absolute start-0 top-0 h-[2px] w-[18%]"
              style={{ background: STROKE.teal }}
            />
            <span
              className="absolute end-0 top-0 h-[2px] w-[40%]"
              style={{ background: STROKE.teal }}
            />
            <span
              className="absolute bottom-0 start-0 h-[2px] w-full"
              style={{ background: STROKE.teal }}
            />
            <span
              className="absolute bottom-0 start-0 top-0 w-[2px]"
              style={{ background: STROKE.teal }}
            />
            <span
              className="absolute bottom-0 end-0 top-0 w-[2px]"
              style={{ background: STROKE.teal }}
            />
          </span>
        </div>
      </div>

      {/* the thread leaves the sill */}
      <span
        aria-hidden="true"
        className="absolute -bottom-16 start-1/2 hidden h-16 w-px -translate-x-1/2 lg:block"
        style={{ background: `linear-gradient(to bottom, ${STROKE.teal}, transparent)` }}
      />
    </div>
  )
}
