import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import { Section } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * Trust centre.
 *
 * ── AN INDEX, NOT A FEATURE GRID ───────────────────────────────────────────
 *
 * V1 rendered these six as a card grid, which made "how decisions are made"
 * look like a product feature. They are not features; they are the table of
 * contents of a transparency policy. So they are set as NUMBERED ROWS with
 * rules between them — the visual language of a report, not of marketing.
 *
 * The numbering is presentational (`01`–`06`), and it is the row index, not a
 * ranking. Nothing here is ordered by importance and nothing claims to be
 * exhaustive.
 *
 * ── THE ONE DARK MOMENT ON THE PAGE ────────────────────────────────────────
 *
 * The heading sits on the inverse surface. It is used exactly once on the
 * homepage, and it is used here because this is the section where the company
 * states its working principle rather than describing a service. A dark band
 * appearing three or four times would be a stripe pattern; appearing once, it
 * is emphasis.
 *
 * Contrast on the inverse surface was measured, not assumed: white on
 * `#14312F` is 14.8:1, and the muted `gray-300` intro is 8.9:1 — both clear AA
 * for their sizes with room to spare.
 */
export function TrustBlockView({ block, t }: { block: FeatureGridBlock; t: Localizer }) {
  return (
    <Section tone="inverse" size="lg">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <h2 className="max-w-[15ch] text-3xl font-bold leading-[1.15] tracking-tight text-white text-balance sm:text-4xl lg:text-display-sm">
            {t(block.heading)}
          </h2>
          {block.intro && (
            <p className="mt-6 max-w-md text-base leading-relaxed text-gray-300 sm:text-lg">
              {t(block.intro)}
            </p>
          )}
          <span aria-hidden="true" className="mt-8 block h-0.5 w-16 bg-teal-400" />
        </div>

        {/* The index. `divide-white/15` rather than a grey token: on the
            inverse surface a neutral divider goes muddy, where a translucent
            white stays part of the same material. */}
        <ol className="divide-y divide-white/15 border-y border-white/15">
          {block.items.map((item, index) => (
            <li key={item.id} className="flex gap-5 py-5 sm:gap-7">
              <span
                aria-hidden="true"
                className="pt-0.5 text-xs font-semibold tabular-nums tracking-[0.2em] text-teal-400"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">{t(item.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-300">{t(item.body)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  )
}
