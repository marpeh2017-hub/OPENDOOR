import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import { Section } from './section'
import type { Localizer } from '@/lib/localize'
import { Reveal } from '@/components/brand/reveal'
import { STROKE } from '@/components/brand/architecture'

/**
 * "אתם בעלי הדירות. אנחנו מנהלים את הדרך."
 *
 * ── THE STRONGEST EDITORIAL MOMENT ON THE PAGE ─────────────────────────────
 *
 * This sentence is the company's whole positioning in eight words, and V1 set
 * it at the same `text-3xl` as "שאלות שחוזרות". Here it is display scale,
 * sticky on desktop, and it holds one side of the section on its own while the
 * three principles move past it.
 *
 * ── STAGGERED, NOT A THREE-CARD GRID ───────────────────────────────────────
 *
 * The brief rules out three equal cards under the headline, and it is right to:
 * three equal rectangles make three equal claims and flatten the reading order.
 * The principles are stepped instead — each indented further than the last,
 * connected by a hairline — so the eye descends through them in sequence. The
 * indent also doubles as the process motif: this is a path, not a list.
 *
 * ── STICKY, WITH A LIMIT ───────────────────────────────────────────────────
 *
 * `lg:sticky` only. On a phone a sticky column would pin the headline over the
 * content the visitor is trying to read, and the section is short enough that
 * the effect would be a bug rather than a feature.
 */
export function WhyBlockView({ block, t }: { block: FeatureGridBlock; t: Localizer }) {
  return (
    <Section size="lg">
      <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
        {/* ── the statement ─────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="max-w-[16ch] text-3xl font-bold leading-[1.15] tracking-tight text-gray-900 text-balance sm:text-4xl lg:text-display-sm">
            {t(block.heading)}
          </h2>
          {block.intro && (
            <p className="mt-6 max-w-md text-base leading-relaxed text-gray-600 sm:text-lg">
              {t(block.intro)}
            </p>
          )}
          <span aria-hidden="true" className="mt-8 block h-0.5 w-16 bg-teal-600" />
        </div>

        {/* ── the three principles ──────────────────────────────────────── */}
        <ol className="relative">
          {/* The spine the principles hang from. Positioned with `start-*` so it
              follows text direction rather than sitting on the left in RTL. */}
          <span
            aria-hidden="true"
            className="absolute bottom-6 start-0 top-2 w-px"
            style={{
              background: `linear-gradient(to bottom, ${STROKE.teal}, ${STROKE.faint})`,
            }}
          />

          {block.items.map((item, index) => (
            <Reveal
              as="li"
              key={item.id}
              delay={index * 70}
              className="relative ps-8 pb-12 last:pb-0 sm:ps-10"
              // Progressive indent: each step sits further along the path.
              // Inline because the value is derived from the index, and a
              // Tailwind class cannot be composed from a runtime number.
            >
              <span
                aria-hidden="true"
                className="absolute start-0 top-2 h-2 w-2 -translate-x-1/2 rotate-45 rtl:translate-x-1/2"
                style={{ background: index === 0 ? STROKE.teal : STROKE.line }}
              />
              <div style={{ marginInlineStart: `${index * 20}px` }}>
                <span className="text-xs font-semibold tabular-nums tracking-[0.2em] text-teal-800">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-xl font-semibold text-gray-900 sm:text-2xl">
                  {t(item.title)}
                </h3>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-gray-600 sm:text-base">
                  {t(item.body)}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  )
}
