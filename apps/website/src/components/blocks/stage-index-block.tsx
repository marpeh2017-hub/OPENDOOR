import type { JourneyBlock, StageIndexBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { LineIcon } from '@/components/brand/line-icon'
import { Section } from './section'

/**
 * The eight stages at a glance, before they are told one by one.
 *
 * ── WHY /how-we-work NEEDS IT ──────────────────────────────────────────────
 *
 * The page is eight long rows. Without an overview a reader meets the stages
 * one screen at a time and never sees the route whole, which is the thing the
 * design review asked this page to show. The index is that route: an icon and
 * a title per stage, on one line across from `lg`, and each a link down to its
 * row, so it doubles as the page's navigation.
 *
 * ── NOTHING COPIED ─────────────────────────────────────────────────────────
 *
 * The stages come from the JOURNEY block the index names, resolved by the
 * page renderer, so a stage renamed there is renamed here.
 *
 * ── AS WITH THE PROCESS, NO STAGE IS "CURRENT" ─────────────────────────────
 *
 * All eight are drawn alike: this is the company's process, not a project's
 * status.
 */
export function StageIndexBlockView({
  block,
  journey,
  t,
}: {
  block: StageIndexBlock
  journey: JourneyBlock
  t: Localizer
}) {
  const count = journey.stages.length
  const edge = `${50 / count}%`

  return (
    <Section size="sm">
      <nav aria-label={t(block.heading)}>
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute top-[23px] hidden h-0.5 bg-teal-200 lg:block"
            style={{ insetInlineStart: edge, insetInlineEnd: edge }}
          />
          <ol
            className="relative grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4 lg:gap-y-0 lg:[grid-template-columns:repeat(var(--stops),minmax(0,1fr))]"
            style={{ '--stops': count } as React.CSSProperties}
          >
            {journey.stages.map((stage) => (
              <li key={stage.id}>
                <a
                  href={`#${stage.id}`}
                  className="group flex min-h-11 items-center gap-3 rounded-lg py-1 text-gray-800 hover:text-teal-700 lg:flex-col lg:gap-3 lg:text-center"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-teal-500 bg-white text-teal-600 transition-colors group-hover:bg-teal-50">
                    <LineIcon name={stage.icon} size={22} />
                  </span>
                  <span className="type-small font-semibold">{t(stage.title)}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>
    </Section>
  )
}
