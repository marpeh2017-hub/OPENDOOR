import type { FeatureGridBlock, NarrativeItem } from '@urban-renewal/api-contracts'
import { Section, SectionHeading } from './section'
import type { Localizer } from '@/lib/localize'
import { LineIcon, isLineIcon } from '@/components/brand/line-icon'

/**
 * Trust centre: the working rules, grouped.
 *
 * ── CARDS IN GROUPS, NOT A LONG INDEX ──────────────────────────────────────
 *
 * Until 2026-10-11 the rules were numbered rows on the dark surface, the
 * visual language of a report. Seven of them made the page's longest stretch
 * (about two screens on a phone), and the owner approved a redesign: the
 * same words as cards, under three names a reader can scan (information,
 * decisions, contact and coordination). Consecutive items that share a
 * `group` sit under it; items without one form a group of their own with no
 * name. Nothing is ranked, and nothing claims to be exhaustive.
 *
 * The page's one dark band is now its documents section, further down.
 */
export function TrustBlockView({ block, t }: { block: FeatureGridBlock; t: Localizer }) {
  const groups = groupItems(block.items, t)

  return (
    <Section tone="sunken" size="lg">
      <SectionHeading heading={block.heading} intro={block.intro} t={t} />

      <div className="mt-10 grid items-start gap-8 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.key} className="space-y-3">
            {group.label && (
              <h3 className="flex items-center gap-2.5 type-small font-bold text-teal-700">
                <span aria-hidden="true" className="h-0.5 w-5 bg-teal-500" />
                {group.label}
              </h3>
            )}
            <ul className="space-y-2.5 sm:space-y-3">
              {group.items.map((item) => (
                <li key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
                  <h4 className="flex items-center gap-3 type-h3 font-bold text-gray-900">
                    {isLineIcon(item.icon) && (
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"
                      >
                        <LineIcon name={item.icon} size={20} />
                      </span>
                    )}
                    {t(item.title)}
                  </h4>
                  <p className="mt-2.5 type-body text-gray-600">{t(item.body)}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

/** Runs of consecutive items under the same group name. */
function groupItems(items: readonly NarrativeItem[], t: Localizer) {
  const groups: { key: string; label: string | null; items: NarrativeItem[] }[] = []
  for (const item of items) {
    const label = t(item.group) || null
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ key: item.id, label, items: [item] })
  }
  return groups
}
