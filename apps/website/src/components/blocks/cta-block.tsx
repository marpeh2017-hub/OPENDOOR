import type { CtaBlock } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { ArchitecturalGrid, STROKE } from '@/components/brand/architecture'
import { EditorialImage } from '@/components/brand/editorial-image'
import { getImageSlot } from '@/mock/fixtures/images'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE CLOSING — THE OTHER SIDE OF THE DOOR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The hero put the visitor on THIS side of a threshold, looking at Jerusalem
 * through an opening. The page closes on the far side of the same threshold,
 * and what is beyond it is the city again — the Chords Bridge, the homepage's
 * one landmark, appearing once and only here.
 *
 * The bridge is the right closing subject for a reason beyond its being
 * recognisable: it is a structure whose entire purpose is to carry people
 * across a gap. That is the argument of the page, and it does not have to be
 * stated for it to land.
 *
 * ── HOW IT IS KEPT CALM ────────────────────────────────────────────────────
 *
 * The image sits BEHIND the composition at low opacity, on white, with the
 * headline in front of it and nowhere near it — no text over photography, so
 * no scrim and no contrast risk when a real photograph replaces the drawing.
 * There is no countdown, no scarcity, no "last chance". The only persuasion is
 * the true statement that the check commits the visitor to nothing.
 *
 * ── THE THREAD ENDS HERE ───────────────────────────────────────────────────
 *
 * The teal line that left the hero's sill and travelled the page arrives at
 * this section and stops at the button. That is the entire signature idea in
 * one section: a route, managed, that ends somewhere specific.
 */
export async function CtaBlockView({ block, t }: { block: CtaBlock; t: Localizer }) {
  const tLinks = await getTranslations('links')
  const slot = await getImageSlot('JERUSALEM_CHORDS_BRIDGE')

  return (
    <section className="relative overflow-hidden bg-white">
      <ArchitecturalGrid size={48} opacity={0.5} />

      {/* The city beyond the threshold. Held back hard — it is the ground the
          closing stands on, not the subject of it. Decorative here because the
          copy carries the message; the same slot states its context in full
          wherever it is used as a subject. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 opacity-[0.5]"
      >
        <div className="relative mx-auto max-w-5xl">
          <EditorialImage
            t={t}
            slot={slot}
            sizes="(max-width: 1023px) 100vw, 64rem"
            captionHidden
            className="aspect-[4/3] w-full sm:aspect-[2/1]"
          />
          {/* Fades the drawing into the page so it has no cut edge. */}
          <span
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, #fff 0%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0.9) 100%)',
            }}
          />
        </div>
      </div>

      {/* The thread arrives from the section above. */}
      <span aria-hidden="true" className="absolute start-1/2 top-0 h-20 w-px -translate-x-1/2">
        <span
          className="block h-full w-full"
          style={{ background: `linear-gradient(to bottom, transparent, ${STROKE.teal})` }}
        />
      </span>

      <div className="relative mx-auto max-w-4xl px-4 py-20 text-center lg:px-8 lg:py-28">
        {/* The threshold, at its largest. Head interrupted, sill in teal — the
            visitor is standing in the opening rather than looking through it,
            which is why the head gap here is wider than the hero's. */}
        <div className="relative px-6 py-14 sm:px-14 sm:py-16">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span
              className="absolute start-0 top-0 h-px w-[22%]"
              style={{ background: STROKE.line }}
            />
            <span
              className="absolute end-0 top-0 h-px w-[22%]"
              style={{ background: STROKE.line }}
            />
            <span
              className="absolute bottom-0 start-0 h-[2px] w-full"
              style={{ background: STROKE.teal }}
            />
            <span
              className="absolute bottom-0 start-0 top-0 w-px"
              style={{ background: STROKE.line }}
            />
            <span
              className="absolute bottom-0 end-0 top-0 w-px"
              style={{ background: STROKE.line }}
            />
          </span>

          <h2 className="mx-auto max-w-[17ch] text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-display-sm lg:text-display-md">
            {t(block.heading)}
          </h2>

          {block.body && (
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-700">
              {block.ctaHref === '/eligibility' ? tLinks('enquiryIntro') : t(block.body)}
            </p>
          )}

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={block.ctaHref}
              className="group inline-flex items-center justify-center gap-2.5 rounded-md bg-teal-600 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-teal-700"
            >
              {t(block.ctaLabel)}
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
              >
                →
              </span>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md border border-gray-400 bg-white px-8 py-4 text-base font-semibold text-gray-800 transition-colors hover:border-teal-600 hover:text-teal-800"
            >
              {tLinks('contact')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
