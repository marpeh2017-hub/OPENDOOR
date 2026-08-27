import type { PortalBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * Resident portal / representation workspace.
 *
 * ── NOT SAAS MARKETING ─────────────────────────────────────────────────────
 *
 * No product screenshot, no device mockup, no "features" grid with icons. Those
 * are how software is sold, and this is not software being sold — it is part of
 * a service, described in the same voice as the rest of the page.
 *
 * Two plain columns, each a named audience and what they get. The distinction
 * between the two is the whole point, so it is the layout.
 *
 * ── THE HONESTY NOTICE IS PART OF THE BLOCK ────────────────────────────────
 *
 * `buildNotice` is rendered adjacent to the heading, not buried at the bottom.
 * Some of what this section describes is still being built, and a visitor
 * deciding whether to trust the company should read that at the same moment
 * they read the promise — not after scrolling past it.
 */
export function PortalBlockView({
  block, t, tone,
}: { block: PortalBlock; t: Localizer; tone?: 'page' | 'raised' | 'sunken' }) {
  return (
    <Section tone={tone}>
      <SectionHeading heading={block.heading} intro={block.intro} t={t} />

      {block.buildNotice && (
        <p className="mt-5 max-w-2xl border-s-2 border-gray-300 ps-4 text-sm leading-relaxed text-gray-600">
          {t(block.buildNotice)}
        </p>
      )}

      <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
        {block.groups.map((group) => (
          <div key={group.id} className="rounded-lg border border-gray-200 bg-white p-6 lg:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              {t(group.audience)}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-gray-900">{t(group.title)}</h3>

            <ul className="mt-6 space-y-3">
              {group.items.map((item, index) => (
                <li key={index} className="flex gap-3 text-[15px] leading-relaxed text-gray-700">
                  <svg
                    viewBox="0 0 20 20"
                    className="mt-1 h-4 w-4 shrink-0 text-teal-600"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 10.5l3.5 3.5L16 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{t(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {block.ctaLabel && block.ctaHref && (
        <Link
          href={block.ctaHref}
          className="mt-8 inline-flex text-sm font-semibold text-teal-700 underline-offset-4 hover:underline"
        >
          {t(block.ctaLabel)} →
        </Link>
      )}
    </Section>
  )
}
