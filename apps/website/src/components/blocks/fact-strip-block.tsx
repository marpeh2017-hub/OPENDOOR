import type { FactStripBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { LineIcon } from '@/components/brand/line-icon'
import { Section } from './section'

/**
 * The company facts in one dark strip: a line each, and where to read them in
 * full.
 *
 * ── WHY THE HOMEPAGE NO LONGER STATES THEM IN FULL ─────────────────────────
 *
 * "מה שאפשר לבדוק עלינו" appeared word for word on the homepage and on
 * /about, so a visitor who went from one to the other read it twice. /about
 * keeps the full version; this strip carries the same three facts cut to a
 * line, and links to it. The lines are cut from the full wording, never
 * rewritten (see the content file for why the payment line keeps both of its
 * clauses).
 *
 * ── THE ONE DARK BAND ON THE HOMEPAGE ──────────────────────────────────────
 *
 * The facts are the most institutional thing on the page, and the dark
 * surface gives them that weight without a heading competing with the doors
 * above. The heading is still there, for screen readers, which announce the
 * strip by it; sighted readers have the three titles.
 *
 * Contrast on #14312F: titles white, lines teal-100 (11:1), icons and the link
 * teal-300 (6.6:1).
 */
export function FactStripBlockView({ block, t }: { block: FactStripBlock; t: Localizer }) {
  const headingId = `${block.id}-heading`

  return (
    <Section tone="inverse" size="sm" labelledBy={headingId}>
      <h2 id={headingId} className="sr-only">
        {t(block.heading)}
      </h2>

      <ul className="grid gap-8 md:grid-cols-3 md:gap-10">
        {block.items.map((item) => (
          <li key={item.id} className="flex items-start gap-4">
            <LineIcon name={item.icon} size={32} className="mt-0.5 shrink-0 text-teal-300" />
            <div className="min-w-0">
              <h3 className="type-h3 font-bold text-white">{t(item.title)}</h3>
              <p className="mt-1 type-body text-teal-100">{t(item.body)}</p>
            </div>
          </li>
        ))}
      </ul>

      <Link
        href={block.linkHref}
        className="group mt-9 inline-flex min-h-11 items-center gap-2 type-body font-semibold text-teal-300 hover:text-white"
      >
        {t(block.linkLabel)}
        <span
          aria-hidden="true"
          className="inline-block rtl:rotate-180 motion-safe:transition-transform motion-safe:ltr:group-hover:translate-x-1 motion-safe:rtl:group-hover:-translate-x-1"
        >
          →
        </span>
      </Link>
    </Section>
  )
}
