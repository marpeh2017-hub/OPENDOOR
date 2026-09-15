import { ArchitecturalGrid, STROKE } from '@/components/brand/architecture'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  PAGE HEADER — THE OPENING EVERY INTERNAL PAGE NEEDS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── WHY THIS IS NOT THE HERO ───────────────────────────────────────────────
 *
 * The homepage hero is a full architectural aperture with a portrait image
 * slot, a display-lg headline and a pair of competing calls to action. It is
 * built to hold someone who has just arrived and has not decided anything.
 *
 * A visitor on `/about` has already decided to be there. Repeating the hero
 * would cost a screen of scrolling before the page starts, and — the reason
 * the brief warns about it — would make eleven pages look like eleven copies
 * of the homepage.
 *
 * So this is the hero's grammar at a quieter volume: same teal rule at the
 * top edge, same architectural grid, same eyebrow-and-rule device, same type
 * family. One h1, one supporting line, no CTA pair, no aperture.
 *
 * ── THE TOP RULE IS THE THRESHOLD, NOT A DECORATION ────────────────────────
 *
 * A single teal segment at the inline-start edge, deliberately not the full
 * width. It is the same interrupted-border idea the whole site is built on,
 * reduced to its smallest legible form: an edge that starts and stops rather
 * than a line that encloses.
 */
export function PageHeader({
  eyebrow,
  title,
  standfirst,
  children,
  tone = 'raised',
}: {
  /** Short label above the title. Optional — most pages do not need one. */
  eyebrow?: string
  title: string
  /** One or two sentences. Sets up the page; never repeats the title. */
  standfirst?: string
  /** Breadcrumb or other chrome, rendered above the eyebrow. */
  children?: React.ReactNode
  /** `raised` for most pages; `page` where the header sits on a coloured
   *  section that follows immediately and two whites would read as a seam. */
  tone?: 'raised' | 'page'
}) {
  const surface = tone === 'raised' ? 'bg-white' : 'bg-surface-page'

  return (
    <header className={`relative overflow-hidden border-b border-gray-200 ${surface}`}>
      <ArchitecturalGrid size={48} opacity={0.55} />

      {/* The threshold: an edge that starts and stops. */}
      <span
        aria-hidden="true"
        className="absolute top-0 h-[2px] w-[90px]"
        style={{ insetInlineStart: '1rem', background: STROKE.teal }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-11 lg:px-8 lg:pb-14 lg:pt-14">
        {children}

        {eyebrow && (
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
            <span aria-hidden="true" className="h-px w-8 bg-teal-600" />
            {eyebrow}
          </p>
        )}

        {/* `text-balance` keeps a long Hebrew title from leaving one orphaned
            word on the last line, which is very visible at this size. */}
        <h1
          className={`max-w-[20ch] text-[2rem] font-bold leading-[1.12] tracking-[-0.02em] text-gray-900 text-balance sm:text-4xl lg:text-display-sm ${
            eyebrow ? 'mt-5' : ''
          }`}
        >
          {title}
        </h1>

        {standfirst && (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">{standfirst}</p>
        )}
      </div>
    </header>
  )
}
