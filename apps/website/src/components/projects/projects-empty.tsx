import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { JerusalemHillside } from '@/components/brand/jerusalem'
import { STROKE } from '@/components/brand/architecture'

/**
 * The projects index with nothing published.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THIS IS A PRIMARY STATE, NOT A FALLBACK
 * ══════════════════════════════════════════════════════════════════════════
 *
 * It is what every visitor sees today, and it is unchanged as the correct
 * behaviour on the day a project is unpublished. It is therefore built to the
 * same standard as the populated grid.
 *
 * Extracted from the route in Pass 3B so the page can now choose between this
 * and the grid without either branch being the poor relation. Nothing about
 * its design changed in the move.
 *
 * ── WHAT IT REFUSES TO DO ──────────────────────────────────────────────────
 *
 * No "0 projects found". No empty grid of dashed outlines. No skeleton rows
 * that never resolve. No apology, and no invented project to fill the space.
 * Each of those tells the visitor the site is broken; the copy tells them the
 * company is careful, which is more useful and also true.
 */
export async function ProjectsEmpty() {
  const [tProjects, tCta, tLinks] = await Promise.all([
    getTranslations('projects'),
    getTranslations('cta'),
    getTranslations('links'),
  ])

  return (
    <div className="relative bg-white px-6 py-12 sm:px-12 sm:py-14">
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span
          className="absolute start-0 top-0 h-[2px] w-[18%]"
          style={{ background: STROKE.teal }}
        />
        <span
          className="absolute end-0 top-0 h-[2px] w-[46%]"
          style={{ background: STROKE.teal }}
        />
        <span
          className="absolute bottom-0 start-0 h-px w-full"
          style={{ background: STROKE.faint }}
        />
        <span
          className="absolute bottom-0 start-0 top-0 w-px"
          style={{ background: STROKE.faint }}
        />
        <span
          className="absolute bottom-0 end-0 top-0 w-px"
          style={{ background: STROKE.faint }}
        />
      </span>

      <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <h2 className="max-w-[20ch] text-2xl font-bold leading-[1.2] tracking-tight text-gray-900 text-balance sm:text-3xl">
            {tProjects('emptyTitle')}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600">
            {tProjects('emptyBody')}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/eligibility"
              className="group inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-md bg-teal-600 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-teal-700"
            >
              {tCta('eligibility')}
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
              >
                →
              </span>
            </Link>
            <Link
              href="/how-we-work"
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 bg-white px-7 py-4 text-base font-semibold text-gray-800 transition-colors hover:border-teal-600 hover:text-teal-800"
            >
              {tLinks('howWeWork')}
            </Link>
          </div>
        </div>

        {/* Decorative, and deliberately not a photograph: an empty list is not
            the place to introduce imagery that would need its own provenance
            caption. */}
        <div className="hidden aspect-[4/3] overflow-hidden bg-surface-sunken lg:block">
          <JerusalemHillside />
        </div>
      </div>
    </div>
  )
}
