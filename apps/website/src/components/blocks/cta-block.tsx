import type { CtaBlock } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { ArchitecturalGrid, STROKE } from '@/components/brand/architecture'

/**
 * Closing call to action.
 *
 * ── CALM BY CONSTRUCTION ───────────────────────────────────────────────────
 *
 * No countdown, no scarcity, no "last chance". The only persuasion is the
 * reassurance that the check commits the visitor to nothing, which is true and
 * is the actual objection. That rule is unchanged from V1.
 *
 * ── THE CLOSING COMPOSITION ────────────────────────────────────────────────
 *
 * The page opened with a doorway drawn inside an architectural elevation. It
 * closes by walking through it: the headline is set INSIDE a portal frame, at
 * the largest type on the page, with the process line arriving from the section
 * above and terminating at the button.
 *
 * That is the whole visual argument of the site in one section — architecture,
 * an opening, and a process that ends somewhere — and it is why the closing
 * needs neither a colour band nor an animation to have weight.
 */
export async function CtaBlockView({ block, t }: { block: CtaBlock; t: Localizer }) {
  const tLinks = await getTranslations('links')

  return (
    <section className="relative overflow-hidden bg-white">
      <ArchitecturalGrid size={48} opacity={0.6} />

      {/* The process line arrives from the section above and stops at the
          headline — the journey the hero started, ending here. */}
      <span aria-hidden="true" className="absolute start-1/2 top-0 h-16 w-px -translate-x-1/2">
        <span
          className="block h-full w-full"
          style={{ background: `linear-gradient(to bottom, transparent, ${STROKE.teal})` }}
        />
      </span>

      <div className="relative mx-auto max-w-4xl px-4 py-20 text-center lg:px-8 lg:py-28">
        {/* The portal, at its largest. Three sides drawn, the top interrupted —
            the headline reads through the opening. */}
        <div className="relative px-6 py-12 sm:px-12 sm:py-14">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="absolute start-0 top-0 h-px w-[26%]" style={{ background: STROKE.faint }} />
            <span className="absolute end-0 top-0 h-px w-[26%]" style={{ background: STROKE.faint }} />
            <span className="absolute bottom-0 start-0 h-px w-full" style={{ background: STROKE.teal }} />
            <span className="absolute bottom-0 start-0 top-0 w-px" style={{ background: STROKE.faint }} />
            <span className="absolute bottom-0 end-0 top-0 w-px" style={{ background: STROKE.faint }} />
          </span>

          <h2 className="mx-auto max-w-[18ch] text-3xl font-bold leading-[1.12] tracking-tight text-gray-900 text-balance sm:text-display-sm lg:text-display-md">
            {t(block.heading)}
          </h2>

          {block.body && (
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
              {t(block.body)}
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
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-8 py-4 text-base font-semibold text-gray-800 transition-colors hover:border-teal-600 hover:text-teal-800"
            >
              {tLinks('contact')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
