import type { PortalBlock } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { PortalPreview, type PortalDemoStrings } from '@/components/brand/portal-preview'

/**
 * Resident portal / representation workspace.
 *
 * ── STILL NOT SAAS MARKETING ───────────────────────────────────────────────
 *
 * The rule from V1 holds: no device mockup, no floating browser window, no
 * feature grid with icons. What changed is that the section now SHOWS the
 * thing instead of only describing it — because "you will be able to see where
 * your project stands" is a sentence anyone can write, and the shape of the
 * view is the actual differentiator.
 *
 * The demonstration's honesty safeguards live in `PortalPreview` and in the
 * content fixture, which is where they can be audited.
 *
 * ── THE BUILD NOTICE STAYS NEXT TO THE PROMISE ─────────────────────────────
 *
 * `buildNotice` renders adjacent to the heading, not at the foot of the
 * section. Some of what this describes is still being built, and a visitor
 * deciding whether to trust the company should read that at the same moment
 * they read the claim — not after scrolling past a convincing interface.
 *
 * ── THE TWO AUDIENCES ARE NOW ROWS, NOT CARDS ──────────────────────────────
 *
 * Two bordered boxes side by side gave the resident and the representation
 * equal visual weight and turned the section into a comparison table. Nearly
 * everyone reading this page is an owner, not a representation member, so the
 * resident list leads and the representation list follows as a related layer —
 * which is also how the demo's two tabs are ordered.
 */
export function PortalBlockView({ block, t }: { block: PortalBlock; t: Localizer }) {
  /**
   * The demo is resolved to plain strings HERE, on the server.
   *
   * `PortalPreview` is a client component, and a function cannot cross that
   * boundary — passing `t` down fails at render. Resolving first also keeps
   * `LocalizedText` maps and the locale-resolution rules out of the client
   * bundle entirely.
   */
  const demo: PortalDemoStrings | null = block.demo
    ? {
        label: t(block.demo.label),
        projectLabel: t(block.demo.projectLabel),
        stages: block.demo.stages.map((stage) => ({
          id: stage.id,
          state: stage.state,
          title: t(stage.title),
        })),
        panels: block.demo.panels.map((panel) => ({
          id: panel.id,
          label: t(panel.label),
          value: t(panel.value),
        })),
        tabs: block.demo.tabs.map((tab) => t(tab)),
        representation: block.demo.representation
          ? {
              label: t(block.demo.representation.label),
              items: block.demo.representation.items.map((item) => ({
                id: item.id,
                label: t(item.label),
                value: t(item.value),
              })),
            }
          : undefined,
      }
    : null

  return (
    <Section size="lg" grid>
      <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
        <div>
          <SectionHeading heading={block.heading} intro={block.intro} t={t} size="lg" />

          {block.buildNotice && (
            <p className="mt-6 max-w-xl border-s-2 border-teal-300 ps-4 text-sm leading-relaxed text-gray-600">
              {t(block.buildNotice)}
            </p>
          )}

          <div className="mt-10 space-y-9">
            {block.groups.map((group) => (
              <div key={group.id}>
                <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
                  <span aria-hidden="true" className="h-px w-5 bg-teal-600" />
                  {t(group.audience)}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-gray-900">{t(group.title)}</h3>

                {/* A plain divided list. Ticks against every line would read as
                    "shipped", and the build notice above says otherwise. */}
                <ul className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
                  {group.items.map((item, index) => (
                    <li key={index} className="py-2.5 text-[15px] leading-relaxed text-gray-700">
                      {t(item)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {block.ctaLabel && block.ctaHref && (
            <Link
              href={block.ctaHref}
              className="group mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700"
            >
              <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-teal-700">
                {t(block.ctaLabel)}
              </span>
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
              >
                →
              </span>
            </Link>
          )}
        </div>

        {/* Sticky so the interface stays in view while the lists scroll past
            it — the section's argument is "this is what you get", and the
            demonstration is the evidence. Desktop only. */}
        {demo && (
          <div className="lg:sticky lg:top-28">
            <PortalPreview demo={demo} />
          </div>
        )}
      </div>
    </Section>
  )
}
