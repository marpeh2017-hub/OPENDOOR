import type { HeroBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'

/**
 * Hero.
 *
 * ── THE VISUAL ─────────────────────────────────────────────────────────────
 *
 * No photograph. There is no verified OpenDoor project photography, and a stock
 * building beside "our projects" implies the building IS one — a factual claim
 * made in pictures. So the visual is an abstract architectural line drawing:
 * stacked residential volumes with an open doorway cut through them, echoing
 * the brand's shield-and-door idea without redrawing the logo.
 *
 * It is drawn in strokes rather than fills so it reads as a diagram, not as a
 * rendering of a real place, and so it costs nothing to load.
 *
 * ── RESTRAINT ──────────────────────────────────────────────────────────────
 *
 * No teal background field. The surface stays warm off-white; teal appears only
 * on the primary button and as thin strokes. The hero is deliberately not
 * full-height — the first section below it should be visible on a laptop, so a
 * visitor sees there is substance under the headline.
 */
export function HeroBlockView({ block, t }: { block: HeroBlock; t: Localizer }) {
  return (
    <section className="border-b border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-8 lg:py-24">
        <div>
          {/* Positioning line: the single most important clarification on the
              page — OpenDoor is not the developer. */}
          {block.eyebrow && (
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/60 px-3 py-1 text-xs font-semibold text-teal-800">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-600" aria-hidden="true" />
              {t(block.eyebrow)}
            </p>
          )}

          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-gray-900 sm:text-display-sm lg:text-display-md">
            {t(block.heading)}
          </h1>

          {block.subheading && (
            <p className="mt-6 max-w-prose text-lg leading-relaxed text-gray-600">
              {t(block.subheading)}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={block.primaryCtaHref}
              className="inline-flex items-center justify-center rounded-md bg-teal-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-teal-700"
            >
              {t(block.primaryCtaLabel)}
            </Link>
            {block.secondaryCtaLabel && block.secondaryCtaHref && (
              <Link
                href={block.secondaryCtaHref}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3.5 text-base font-semibold text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                {t(block.secondaryCtaLabel)}
              </Link>
            )}
          </div>

          {block.note && <p className="mt-6 text-sm text-gray-600">{t(block.note)}</p>}
        </div>

        <div className="hidden lg:block">
          <ArchitecturalMark />
        </div>
      </div>
    </section>
  )
}

/**
 * Abstract architectural mark.
 *
 * Decorative, so `aria-hidden` — it carries no information the headline does
 * not already state, and announcing "diagram" to a screen-reader user would be
 * noise. Strokes use `currentColor`-adjacent literals rather than the brand
 * token classes because an SVG's stroke is not a Tailwind text colour.
 */
function ArchitecturalMark() {
  return (
    <svg
      viewBox="0 0 420 340"
      className="h-auto w-full"
      role="presentation"
      aria-hidden="true"
      fill="none"
    >
      {/* Ground line */}
      <path d="M20 300h380" stroke="#d5d8db" strokeWidth="1.5" />

      {/* Rear volumes — lighter, to build depth without a photograph */}
      <path d="M60 300V150h70v150" stroke="#d5d8db" strokeWidth="1.5" />
      <path d="M310 300V180h60v120" stroke="#d5d8db" strokeWidth="1.5" />
      {[170, 200, 230, 260].map((y) => (
        <path key={`r-${y}`} d={`M60 ${y}h70`} stroke="#eaecee" strokeWidth="1" />
      ))}
      {[200, 230, 260].map((y) => (
        <path key={`l-${y}`} d={`M310 ${y}h60`} stroke="#eaecee" strokeWidth="1" />
      ))}

      {/* Foreground volume — the subject */}
      <path d="M150 300V90h130v210" stroke="#6D7378" strokeWidth="2" />
      {[130, 170, 210, 250].map((y) => (
        <path key={`f-${y}`} d={`M150 ${y}h130`} stroke="#d5d8db" strokeWidth="1.25" />
      ))}
      {[183, 216, 249].map((x) => (
        <path key={`v-${x}`} d={`M${x} 90v210`} stroke="#eaecee" strokeWidth="1" />
      ))}

      {/* The open doorway — the brand idea, drawn rather than borrowed */}
      <path d="M196 300v-72h38v72" stroke="#2F9DA0" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M234 228l16-14v72l-16 14" stroke="#2F9DA0" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="204" cy="266" r="2.5" fill="#2F9DA0" />

      {/* A single teal accent line at roof height, tying the composition */}
      <path d="M150 90h130" stroke="#2F9DA0" strokeWidth="2.5" />
    </svg>
  )
}
