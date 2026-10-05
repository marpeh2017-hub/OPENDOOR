import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import { Section } from './section'
import type { Localizer } from '@/lib/localize'

/**
 * "מה שאפשר לבדוק עלינו" — the facts a visitor can verify without us.
 *
 * ── WHY THIS EXISTS WHEN `TrustBlockView` ALREADY DOES ─────────────────────
 *
 * They answer different questions, and a reader needs both in this order.
 *
 * The trust index answers "how does this company work" — how decisions are
 * made, how updates arrive, what the representation may do. Its own intro says
 * trust is built from a clear process rather than from declarations, and it is
 * right. But it assumes the reader has already decided we are a real company
 * worth reading about.
 *
 * This answers the question before that one: "who are you, and can I check it."
 * A company number that resolves at the registrar, a payment model the reader
 * will see again in the agreement, and a boundary on our role. Every line here
 * is checkable somewhere other than this website, which is the only kind of
 * claim worth making to someone deciding about the largest asset they own.
 *
 * ── WHY IT IS NOT A SECOND DARK BAND ───────────────────────────────────────
 *
 * The first draft of this was on the inverse surface, because the content felt
 * weighty enough to deserve it. That would have broken the rule `trust-block`
 * sets out and depends on: one dark band on the homepage is emphasis, two are
 * a stripe pattern, and the trust index would have lost the distinction that
 * makes it land.
 *
 * So this is light and sits BEFORE it, and the composition is better for the
 * constraint — the reader gets the institutional facts on an ordinary surface,
 * then the process on the one dark moment in the page. Weight comes from the
 * 2px graphite rule and the teal numerals instead of from a fill.
 *
 * ── NO STATISTICS, DELIBERATELY ────────────────────────────────────────────
 *
 * There is no project count, no resident count and no shekel figure, because
 * there is nothing real to put in them yet. The section is built so that it is
 * COMPLETE without them rather than visibly waiting for them: a reader cannot
 * tell that anything is missing, because nothing is.
 *
 * ── `tone: 'inverse'` ──────────────────────────────────────────────────────
 *
 * The rule above is the homepage's. On a page with no other dark band, /about,
 * the facts can take the dark surface without starting a stripe pattern, and
 * the approved design for that page does exactly that.
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
    <Section size="lg" tone={inverse ? 'inverse' : 'page'}>
      <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
        <div>
          <h2
            className={`max-w-[15ch] text-3xl font-bold leading-[1.15] tracking-tight text-balance sm:text-4xl ${
              inverse ? 'text-white' : 'text-gray-900'
            }`}
          >
            {t(block.heading)}
          </h2>
          {block.intro && (
            <p
              className={`mt-5 max-w-md text-base leading-relaxed sm:text-lg ${
                inverse ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              {t(block.intro)}
            </p>
          )}
          <span
            aria-hidden="true"
            className={`mt-8 block h-[3px] w-16 ${inverse ? 'bg-teal-400' : 'bg-teal-500'}`}
          />
        </div>

        {/* A 2px rule opens the list: the darkest neutral on the light surface,
            a translucent white on the dark one, as the trust index uses. */}
        <ol className={`border-t-2 ${inverse ? 'border-white/30' : 'border-gray-800'}`}>
          {block.items.map((item, index) => (
            <li
              key={item.id}
              className={`flex gap-6 border-b py-6 sm:gap-7 ${
                inverse ? 'border-white/15' : 'border-gray-200'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pt-1 text-xs font-bold tabular-nums tracking-[0.2em] ${
                  inverse ? 'text-teal-300' : 'text-teal-700'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className={`text-lg font-semibold ${inverse ? 'text-white' : 'text-gray-900'}`}>
                  {t(item.title)}
                </h3>
                <p
                  className={`mt-2 text-[15px] leading-relaxed ${
                    inverse ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  {t(item.body)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  )
}
