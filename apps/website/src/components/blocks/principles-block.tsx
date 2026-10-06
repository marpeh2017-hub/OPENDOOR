import type { PrinciplesBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import type { Localizer } from '@/lib/localize'
import { LineIcon, isLineIcon } from '@/components/brand/line-icon'
import { Section, SectionHeading } from './section'

/**
 * "העמדה שלנו" — what the company holds to, in three lines.
 *
 * ── WHAT THIS REPLACED ─────────────────────────────────────────────────────
 *
 * /about used to carry three chapters, numbered 01 to 03 in outline numerals
 * larger than their headings: checking the offer, transparency, and our role.
 * The review found they were really a service, a transparency text and the
 * argument of /why-organizer, so each now lives in full on that page, and
 * /about keeps one line of each here, with a link to the rest.
 *
 * ── ON THE WASH, NOT THE DARK SURFACE ──────────────────────────────────────
 *
 * The approved sketch put these on a dark strip, but /about already has its
 * dark band two sections later (the facts), and two dark bands that close
 * together read as stripes. The wash keeps the section distinct without that.
 */
export function PrinciplesBlockView({ block, t }: { block: PrinciplesBlock; t: Localizer }) {
  return (
    <Section tone="wash" size="md">
      <SectionHeading heading={block.heading} t={t} />

      <ul className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8 lg:gap-12">
        {block.items.map((item) => (
          <li key={item.id} className="flex flex-col">
            {isLineIcon(item.icon) && (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-teal-600 shadow-[0_1px_2px_rgba(20,49,47,0.08)]">
                <LineIcon name={item.icon} size={28} />
              </span>
            )}
            <h3 className="mt-5 type-h3 font-bold text-gray-900">{t(item.title)}</h3>
            <p className="mt-2 type-body text-gray-700">{t(item.body)}</p>
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
