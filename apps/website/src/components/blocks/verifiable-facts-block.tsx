import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import { Section } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * "מה שאפשר לבדוק עלינו" — the facts a visitor can verify without us.
 *
 * ── WHAT THIS ANSWERS ──────────────────────────────────────────────────────
 *
 * "Who are you, and can I check it": a company number that resolves at the
 * registrar, the company's role and who pays it as the agreement states
 * them, and that the owners' professionals are theirs. Every line is
 * checkable somewhere other than this website. /about is the one place the
 * facts appear in full; the homepage's strip cuts each to a line and links
 * here, to the section's id.
 *
 * ── LAYOUT (2026-10) ───────────────────────────────────────────────────────
 *
 * The heading and its line on one side; the facts as a grid of two on the
 * other, each under a hairline, as the approved /about design draws them.
 * The numerals that used to run down a single list are gone: four facts
 * read at a glance in a grid, and a number beside each implied a ranking
 * among them that there is not.
 *
 * `tone: 'inverse'` puts the section on the dark surface (/about); the light
 * tone remains for a page that already has its dark band.
 *
 * ── NO STATISTICS, DELIBERATELY ────────────────────────────────────────────
 *
 * There is no project count, no resident count and no shekel figure, because
 * there is nothing real to put in them yet. The section is complete without
 * them rather than visibly waiting for them.
 */
export function VerifiableFactsBlockView({
  block,
  t,
}: {
  block: FeatureGridBlock
  t: Localizer
}) {
  const inverse = block.tone === 'inverse'

  return (
    // The id is the anchor the homepage's fact strip links to; the scroll
    // margin keeps the heading clear of the sticky header when it lands.
    <Section id={block.id} size="md" tone={inverse ? 'inverse' : 'page'} className="scroll-mt-16">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <h2 className={`max-w-[18ch] type-h2 font-bold text-balance ${inverse ? 'text-white' : 'text-gray-900'}`}>
            {t(block.heading)}
          </h2>
          {block.intro && (
            <p className={`mt-4 max-w-md type-body ${inverse ? 'text-teal-100' : 'text-gray-600'}`}>
              {t(block.intro)}
            </p>
          )}
        </div>

        <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {block.items.map((item) => (
            <li key={item.id} className={`border-t pt-4 ${inverse ? 'border-white/20' : 'border-gray-200'}`}>
              <h3 className={`type-h3 font-bold ${inverse ? 'text-white' : 'text-gray-900'}`}>{t(item.title)}</h3>
              <p className={`mt-1.5 type-body ${inverse ? 'text-teal-100' : 'text-gray-600'}`}>{t(item.body)}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
