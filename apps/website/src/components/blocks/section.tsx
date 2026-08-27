import type { Localizer } from '@/lib/localize'
import type { LocalizedText, LocalizedTextOptional } from '@urban-renewal/api-contracts'

/**
 * Section chrome, defined once.
 *
 * ── WHY A SHARED SHELL ─────────────────────────────────────────────────────
 *
 * Every section shares the same container width, horizontal padding, vertical
 * rhythm and heading treatment. Repeating those classes per block guarantees
 * drift — one section at `py-20`, the next at `py-24`, and a page that feels
 * subtly uneven for reasons nobody can point at.
 *
 * `tone` is the only surface decision a block makes, and it is deliberately a
 * three-value choice rather than a free class: alternating warm off-white and a
 * muted band gives rhythm without putting every section inside a card.
 */
export function Section({
  tone = 'page',
  children,
  id,
}: {
  tone?: 'page' | 'raised' | 'sunken'
  children: React.ReactNode
  id?: string
}) {
  const surface =
    tone === 'raised' ? 'bg-white' : tone === 'sunken' ? 'bg-surface-sunken' : 'bg-surface-page'

  return (
    <section id={id} className={`${surface} border-b border-gray-200`}>
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">{children}</div>
    </section>
  )
}

/**
 * Section heading.
 *
 * Always renders `h2`. The page has exactly one `h1` (the hero), and a section
 * that picks its own level breaks the document outline a screen-reader user
 * navigates by.
 */
export function SectionHeading({
  heading,
  intro,
  t,
  align = 'start',
}: {
  /**
   * Accepts a partial map: a collection block's heading is optional, and a
   * heading translated into only one language is a normal CMS state. The
   * localizer falls back to Hebrew, and an entirely absent heading renders
   * nothing rather than an empty <h2>.
   */
  heading?: LocalizedText | LocalizedTextOptional
  intro?: LocalizedText | LocalizedTextOptional
  t: Localizer
  align?: 'start' | 'center'
}) {
  const alignment = align === 'center' ? 'text-center mx-auto' : 'text-start'
  return (
    <div className={`max-w-2xl ${alignment}`}>
      {t(heading) && (
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {t(heading)}
        </h2>
      )}
      {intro && <p className="mt-4 text-base leading-relaxed text-gray-600">{t(intro)}</p>}
    </div>
  )
}
