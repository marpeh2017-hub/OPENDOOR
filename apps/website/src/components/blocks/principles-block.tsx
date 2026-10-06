import type { PrinciplesBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { LineIcon, isLineIcon } from '@/components/brand/line-icon'
import { Section, SectionHeading } from './section'

/**
 * How the company works, as a few principles: an icon, a name, one sentence.
 *
 * ── ON /about ──────────────────────────────────────────────────────────────
 *
 * Since 2026-10 this is "איך אנחנו עובדים": the company's four principles in
 * its own words (data, not estimates; transparency; listening before signing;
 * staying after the signatures). It replaced "העמדה שלנו", whose three lines
 * linked to texts on other pages; an item's link is still supported.
 *
 * On the sunken surface, not the wash: the checks two sections up are on the
 * wash, and the same tint twice in one page reads as a pattern. Four
 * principles sit in one row from lg, three in a row otherwise.
 */
export function PrinciplesBlockView({ block, t }: { block: PrinciplesBlock; t: Localizer }) {
  return (
    <Section id={block.id} tone="sunken" size="md" className="scroll-mt-16">
      <SectionHeading heading={block.heading} t={t} />

      <ul
        className={`mt-8 grid gap-10 md:grid-cols-2 md:gap-8 ${
          block.items.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3 lg:gap-12'
        }`}
      >
        {block.items.map((item) => (
          <li key={item.id} className="flex flex-col">
            {isLineIcon(item.icon) && (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-teal-600 shadow-[0_1px_2px_rgba(20,49,47,0.1)]">
                <LineIcon name={item.icon} size={28} />
              </span>
            )}
            <h3 className="mt-4 type-h3 font-bold text-gray-900">{t(item.title)}</h3>
            <p className="mt-2 type-body text-gray-600">{t(item.body)}</p>
            {item.href && t(item.linkLabel) && (
              <Link
                href={item.href}
                className="group mt-auto inline-flex min-h-11 items-center gap-2 pt-3 type-body font-semibold text-teal-600 hover:text-teal-700"
              >
                {t(item.linkLabel)}
                <span
                  aria-hidden="true"
                  className="inline-block rtl:rotate-180 motion-safe:transition-transform motion-safe:ltr:group-hover:translate-x-1 motion-safe:rtl:group-hover:-translate-x-1"
                >
                  →
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}
