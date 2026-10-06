import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { LineIcon } from '@/components/brand/line-icon'

/**
 * The process at a glance: a line of stages, an icon and a few words each.
 *
 * ── WHAT THIS REPLACED ─────────────────────────────────────────────────────
 *
 * Until 2026-10 the homepage showed the five stages as five illustrations
 * with a paragraph under each: on a phone, five screens of pictures. The
 * design review asked for the shape of the route rather than its detail,
 * which lives on /how-we-work, so this is one line with five stops and a
 * link to the eight stages there. It is an HTML list, not a picture: every
 * word is text.
 *
 * ── NO CURRENT STAGE ───────────────────────────────────────────────────────
 *
 * Every stop is drawn the same. Emphasising one would read as "we are here",
 * which on a company's page about its process would be a fabricated fact
 * about a building nobody named. The line shows sequence, not progress.
 *
 * ── LAYOUT ─────────────────────────────────────────────────────────────────
 *
 * From `md` the line runs across and the stops sit on it, centred; the line
 * spans the first stop's centre to the last one's. On a phone it stands down
 * the start edge with the stops beside their text, so nothing scrolls
 * sideways.
 */
export function ProcessBlockView({ block, t }: { block: FeatureGridBlock; t: Localizer }) {
  const count = block.items.length
  const edge = `${50 / count}%`

  return (
    <Section tone="sunken" size="md">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <SectionHeading heading={block.heading} intro={block.intro} t={t} />
        {block.linkLabel && block.linkHref && t(block.linkLabel) && (
          <Link
            href={block.linkHref}
            className="group inline-flex min-h-11 items-center gap-2 type-body font-semibold text-teal-600 hover:text-teal-700"
          >
            {t(block.linkLabel)}
            <span
              aria-hidden="true"
              className="inline-block rtl:rotate-180 motion-safe:transition-transform motion-safe:ltr:group-hover:translate-x-1 motion-safe:rtl:group-hover:-translate-x-1"
            >
              →
            </span>
          </Link>
        )}
      </div>

      <div className="relative mt-10 md:mt-14">
        {/* The line: down the start edge on a phone, across from md. */}
        <span
          aria-hidden="true"
          className="absolute bottom-7 top-7 w-0.5 bg-teal-200 [inset-inline-start:1.6875rem] md:hidden"
        />
        <span
          aria-hidden="true"
          className="absolute top-[39px] hidden h-0.5 bg-teal-200 md:block"
          style={{ insetInlineStart: edge, insetInlineEnd: edge }}
        />

        <ol
          className="relative grid gap-7 md:gap-4 md:[grid-template-columns:repeat(var(--stops),minmax(0,1fr))]"
          style={{ '--stops': count } as React.CSSProperties}
        >
          {block.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-5 md:flex-col md:items-center md:gap-4 md:text-center"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-teal-500 bg-white text-teal-600 md:h-20 md:w-20">
                <LineIcon name={item.icon} size={26} className="md:h-9 md:w-9" />
              </span>
              <div className="min-w-0 pt-2 md:pt-0">
                <h3 className="type-h3 font-bold text-gray-900">{t(item.title)}</h3>
                <p className="mt-1 type-body text-gray-600">{t(item.body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  )
}
