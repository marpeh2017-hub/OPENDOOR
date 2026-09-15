import type { StatementBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'

/**
 * One large editorial sentence.
 *
 * ── WHY THIS IS A HEADING AND NOT A `p` ────────────────────────────────────
 *
 * At display scale a sentence sitting alone reads as a heading whether or not
 * it is marked as one, and a screen-reader user navigating by heading should
 * find it where a sighted reader does. The blocks that follow it are the
 * content it introduces.
 *
 * ── WHICH LEVEL DEPENDS ON WHERE THE CALLER PUT IT ─────────────────────────
 *
 * `h2` in the body of a page that already has a PAGE_HEADER. But on /trust the
 * statement IS the page opening, standing in for that header, and a page whose
 * visible title is marked `h2` leaves the document with no `h1` at all. The
 * caller that makes it the opening therefore asks for `h1`.
 *
 * ── STICKY IS THE CALLER'S DECISION ────────────────────────────────────────
 *
 * On /about this sits in a sticky column beside the prose; on /trust it opens
 * the page across the full width on the inverse surface. The component owns
 * the type and the rule, not the position — which is what lets one block type
 * serve two very different compositions without a variant flag.
 */
export function StatementBlockView({
  block,
  t,
  tone = 'light',
  as: Heading = 'h2',
}: {
  block: StatementBlock
  t: Localizer
  /** `inverse` for the dark surface, where the neutral tones have to lift. */
  tone?: 'light' | 'inverse'
  /** `h1` only when this statement is the page's opening. */
  as?: 'h1' | 'h2'
}) {
  const headingColor = tone === 'inverse' ? 'text-white' : 'text-gray-900'
  const supportColor = tone === 'inverse' ? 'text-gray-300' : 'text-gray-600'
  const ruleColor = tone === 'inverse' ? 'bg-teal-400' : 'bg-teal-600'

  return (
    <div>
      <Heading
        className={`max-w-[16ch] text-2xl font-bold leading-[1.18] tracking-[-0.015em] text-balance sm:text-3xl lg:text-[2rem] ${headingColor}`}
      >
        {t(block.statement)}
      </Heading>

      <span aria-hidden="true" className={`mt-6 block h-0.5 w-16 ${ruleColor}`} />

      {block.support && (
        <p className={`mt-6 max-w-md text-base leading-relaxed sm:text-lg ${supportColor}`}>
          {t(block.support)}
        </p>
      )}
    </div>
  )
}
