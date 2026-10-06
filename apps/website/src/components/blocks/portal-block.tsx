import type { PortalBlock } from '@urban-renewal/api-contracts'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { PortalTeaser, type PortalDemoStrings } from '@/components/brand/portal-teaser'

/**
 * The personal area, as the homepage now presents it: a heading, one line, the
 * way in, and a picture of the screen.
 *
 * Until 2026-10 this section listed what owners and representation members
 * each get, beside an interactive demo with two views. The lists live on
 * /trust and /resident-portal; the homepage says what the personal area is for
 * and where to go. `groups` and `buildNotice` still render when content sets
 * them, so the block stays usable elsewhere.
 *
 * The link is an outlined button rather than a filled one: the page has one
 * primary action, and it is "דברו איתנו על הבניין שלכם".
 */
export async function PortalBlockView({ block, t }: { block: PortalBlock; t: Localizer }) {
  const tUi = await getTranslations('ui')
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
      }
    : null

  return (
    <Section size="md">
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
        <div>
          <SectionHeading heading={block.heading} intro={block.intro} t={t} />

          {block.buildNotice && (
            <p className="mt-6 max-w-xl border-s-2 border-teal-300 ps-4 type-small text-gray-600">
              {t(block.buildNotice)}
            </p>
          )}

          {block.groups.length > 0 && (
            <div className="mt-10 space-y-9">
              {block.groups.map((group) => (
                <div key={group.id}>
                  <p className="type-small font-semibold text-teal-700">{t(group.audience)}</p>
                  <h3 className="mt-2 type-h3 font-semibold text-gray-900">{t(group.title)}</h3>
                  <ul className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
                    {group.items.map((item, index) => (
                      <li key={index} className="py-2.5 type-body text-gray-700">
                        {t(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {block.ctaLabel && block.ctaHref && (
            <Link
              href={block.ctaHref}
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-md border border-teal-600 px-6 type-body font-semibold text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700"
            >
              {t(block.ctaLabel)}
            </Link>
          )}
        </div>

        {demo && <PortalTeaser demo={demo} currentStageLabel={tUi('currentStage')} />}
      </div>
    </Section>
  )
}
