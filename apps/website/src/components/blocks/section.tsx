import type { Localizer } from '@/lib/localize'
import type { LocalizedText, LocalizedTextOptional } from '@urban-renewal/api-contracts'
import { ArchitecturalGrid } from '@/components/brand/architecture'

/**
 * Section chrome.
 *
 * ── WHAT CHANGED IN V2, AND WHY ────────────────────────────────────────────
 *
 * V1 alternated white / off-white / muted bands per section. It was clean, and
 * it was the single biggest reason the page read as eleven separate slides:
 * every section announced its own edge, so nothing carried across a boundary.
 *
 * V2 keeps ONE continuous page surface. Sections are separated by rhythm
 * (`size`), by an optional planning grid, and by the connector lines that cross
 * the seams — not by a colour change. `raised` and `inverse` still exist, but
 * as PUNCTUATION: used two or three times on a long page, they mean something.
 * Used eleven times, they meant nothing.
 *
 * The hard `border-b` on every section is gone for the same reason. A hairline
 * under every band is a table of contents drawn in rules.
 */
export function Section({
  tone = 'page',
  size = 'md',
  grid = false,
  children,
  id,
  className = '',
}: {
  tone?: 'page' | 'raised' | 'sunken' | 'inverse'
  /** Vertical rhythm. Varying it is what gives a long page pace. */
  size?: 'sm' | 'md' | 'lg'
  /** Lays the faint planning grid behind the section. Used sparingly. */
  grid?: boolean
  children: React.ReactNode
  id?: string
  className?: string
}) {
  const surface = {
    page: 'bg-surface-page',
    raised: 'bg-white',
    sunken: 'bg-surface-sunken',
    inverse: 'bg-surface-inverse text-white',
  }[tone]

  const rhythm = {
    sm: 'py-14 lg:py-16',
    md: 'py-16 lg:py-24',
    lg: 'py-20 lg:py-32',
  }[size]

  return (
    <section id={id} className={`relative overflow-hidden ${surface} ${className}`}>
      {grid && <ArchitecturalGrid opacity={0.55} />}
      <div className={`relative mx-auto max-w-7xl px-4 lg:px-8 ${rhythm}`}>{children}</div>
    </section>
  )
}

/**
 * Section heading.
 *
 * Always renders `h2` — the page has exactly one `h1`, and a section that picks
 * its own level breaks the outline a screen-reader user navigates by.
 *
 * ── THE V2 ADDITION: SCALE IS A CHOICE ─────────────────────────────────────
 *
 * V1 gave every section the same `text-3xl` heading, the same centred measure
 * and the same grey intro. That uniformity is what made the page feel like a
 * template — the brief names it exactly. `size` lets a section that carries an
 * editorial statement ("אתם בעלי הדירות") be set two steps larger than a
 * section that introduces a list, which is how print decides importance.
 *
 * `eyebrow` is optional and mostly unused, deliberately: an eyebrow above every
 * heading is the same uniformity in a smaller font.
 */
export function SectionHeading({
  heading,
  intro,
  eyebrow,
  t,
  size = 'md',
  align = 'start',
  className = '',
}: {
  /**
   * Accepts a partial map: a collection block's heading is optional, and a
   * heading translated into only one language is a normal CMS state.
   */
  heading?: LocalizedText | LocalizedTextOptional
  intro?: LocalizedText | LocalizedTextOptional
  eyebrow?: string
  t: Localizer
  size?: 'md' | 'lg' | 'xl'
  align?: 'start' | 'center'
  className?: string
}) {
  const scale = {
    md: 'text-2xl sm:text-3xl',
    lg: 'text-3xl sm:text-4xl',
    // Editorial scale. Tight leading and negative tracking, because Heebo at
    // this size set with body leading looks loose in both scripts.
    xl: 'text-3xl leading-[1.12] tracking-tight sm:text-display-sm lg:text-display-md',
  }[size]

  const introScale = size === 'xl' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
  const alignment = align === 'center' ? 'text-center mx-auto' : 'text-start'
  const measure = size === 'xl' ? 'max-w-4xl' : 'max-w-2xl'

  return (
    <div className={`${measure} ${alignment} ${className}`}>
      {eyebrow && (
        <p className="mb-4 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
          <span aria-hidden="true" className="h-px w-6 bg-teal-600" />
          {eyebrow}
        </p>
      )}
      {t(heading) && (
        <h2 className={`font-bold tracking-tight text-gray-900 ${scale}`}>{t(heading)}</h2>
      )}
      {intro && (
        <p className={`mt-5 leading-relaxed text-gray-600 ${introScale}`}>{t(intro)}</p>
      )}
    </div>
  )
}
