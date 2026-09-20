import type { FeatureGridBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { WhyBlockView } from './why-block'
import { ProcessBlockView } from './process-block'
import { TransparencyBlockView } from './transparency-block'
import { TrustBlockView } from './trust-block'

/**
 * Dispatcher for the four blocks that share the `FeatureGridBlock` SHAPE —
 * a heading, an intro, and a list of titled paragraphs.
 *
 * ── WHY FOUR FILES AND NOT ONE COMPONENT WITH VARIANTS ─────────────────────
 *
 * In V1 these four rendered as one grid with minor differences, and that is a
 * large part of why the page looked like a template: identical content shape
 * had produced identical presentation. In V2 they are genuinely different
 * compositions — an editorial statement, a process journey, an interface
 * demonstration and an institutional index — and each is long enough that
 * keeping them in one file would produce a 500-line component nobody edits
 * safely.
 *
 * The CONTENT MODEL is unchanged. Nothing about the CMS block architecture
 * moved to accommodate the visuals; only the renderers were replaced.
 */
export function FeatureGridBlockView({
  block,
  t,
}: {
  block: FeatureGridBlock
  t: Localizer
}) {
  switch (block.type) {
    case 'PROCESS':
      return <ProcessBlockView block={block} t={t} />
    case 'PROJECT_TRANSPARENCY':
      return <TransparencyBlockView block={block} t={t} />
    case 'TRUST':
      return <TrustBlockView block={block} t={t} />
    default:
      return <WhyBlockView block={block} t={t} />
  }
}
