import { Fragment } from 'react'
import type { ExternalResource, PageBlock } from '@urban-renewal/api-contracts'
import type { Localizer } from '@/lib/localize'
import { PageHeader } from './page-header'
import { Section } from './section'
import { StatementBlockView } from './statement-block'
import { ProseBlockView } from './prose-block'
import { ComparisonBlockView } from './comparison-block'
import { RoleMapBlockView } from './role-map-block'
import { JourneyBlockView } from './journey-block'
import { ExternalResourcesBlockView } from './external-resources-block'
import { FeatureGridBlockView } from './feature-grid-block'
import { TextSectionBlockView } from './text-section-block'
import { CityBandBlockView } from './city-band-block'
import { CtaBlockView } from './cta-block'

/**
 * Renders a CMS page's blocks, in order.
 *
 * ── WHY A SHARED RENDERER RATHER THAN FOUR PAGE FILES ──────────────────────
 *
 * Each of the four core pages could have been written as its own JSX tree.
 * That is how internal pages usually end up hardcoded: the first page is
 * quick, the second copies it, and by the fourth the copy is entangled with
 * layout and conditionals so the eventual CMS migration is a rewrite.
 *
 * Here a page route does three things — resolve the locale, fetch its page,
 * hand the blocks to this component — and owns no copy and no composition.
 * Adding a page becomes a content edit, not a code change.
 *
 * ── COMPOSITION LIVES WITH THE PAGE, NOT IN A FLAG ─────────────────────────
 *
 * The four pages look genuinely different, and that difference is NOT achieved
 * with a `variant` prop on a generic template. It comes from which blocks each
 * page uses and in what order: /about pairs STATEMENT with PROSE in a sticky
 * two-column arrangement, /why-organizer runs COMPARISON then ROLE_MAP full
 * width, /how-we-work is one JOURNEY, /trust opens on STATEMENT over the
 * inverse surface.
 *
 * The two arrangements that need more than a block boundary to express — the
 * sticky statement pairing and the inverse opening — are handled by the
 * PAIRING RULES below rather than by a page-level layout component, so they
 * stay declarative and survive an editor reordering blocks.
 */

/**
 * Blocks that render inside a shared `Section` wrapper.
 *
 * Some blocks bring their own section (they need a full-bleed band, an
 * alternating surface, or a different tone), so wrapping them again would
 * double the vertical rhythm and nest two `<section>` elements.
 */
const SELF_WRAPPING = new Set([
  'PAGE_HEADER', 'COMPARISON', 'ROLE_MAP', 'JOURNEY',
  'EXTERNAL_RESOURCES', 'MEDIA', 'CTA', 'FEATURE_GRID', 'PROCESS',
  'PROJECT_TRANSPARENCY', 'TRUST', 'TEXT_SECTION',
])

export async function PageBlocks({
  blocks,
  t,
  resources = [],
}: {
  blocks: readonly PageBlock[]
  t: Localizer
  /** Only needed by pages carrying an EXTERNAL_RESOURCES block. */
  resources?: readonly ExternalResource[]
}) {
  const visible = blocks.filter((block) => !block.hidden)

  const rendered: React.ReactNode[] = []

  for (let index = 0; index < visible.length; index += 1) {
    const block = visible[index]!
    const next = visible[index + 1]

    /* ── PAIRING RULE 1: STATEMENT + PROSE ────────────────────────────────
     * A statement followed immediately by prose is one editorial moment, not
     * two sections: the statement sits in a sticky column beside the prose it
     * introduces. Rendering them as separate stacked sections would put a
     * display-scale sentence alone on a line above a paragraph, which reads as
     * a heading rather than as a position. */
    if (block.type === 'STATEMENT' && next?.type === 'PROSE') {
      rendered.push(
        <Section key={block.id} size="lg">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <StatementBlockView block={block} t={t} />
            </div>
            <ProseBlockView block={next} t={t} />
          </div>
        </Section>,
      )
      index += 1 // the PROSE block was consumed by this pairing
      continue
    }

    /* ── PAIRING RULE 2: a STATEMENT that opens a page ────────────────────
     * When a statement is the FIRST block, it is the page's opening and takes
     * the inverse surface, standing in for a PAGE_HEADER. That is how /trust
     * begins, and it is why that page needs no separate header block.
     *
     * Because it stands in for the header it also carries the `h1`: a page
     * whose visible title is an `h2` has no `h1` at all, which is exactly the
     * defect this rule would otherwise introduce. */
    if (block.type === 'STATEMENT' && index === 0) {
      rendered.push(
        <Section key={block.id} tone="inverse" size="lg">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <StatementBlockView block={block} t={t} tone="inverse" as="h1" />
            {block.support && <div aria-hidden="true" />}
          </div>
        </Section>,
      )
      continue
    }

    rendered.push(
      <Fragment key={block.id}>{await renderBlock(block, t, resources)}</Fragment>,
    )
  }

  return <>{rendered}</>
}

async function renderBlock(
  block: PageBlock,
  t: Localizer,
  resources: readonly ExternalResource[],
): Promise<React.ReactNode> {
  const body = await renderBlockBody(block, t, resources)
  if (!body) return null
  if (SELF_WRAPPING.has(block.type)) return body
  return <Section size="lg">{body}</Section>
}

async function renderBlockBody(
  block: PageBlock,
  t: Localizer,
  resources: readonly ExternalResource[],
): Promise<React.ReactNode> {
  switch (block.type) {
    case 'PAGE_HEADER':
      return (
        <PageHeader
          title={t(block.heading)}
          {...(block.eyebrow && t(block.eyebrow) ? { eyebrow: t(block.eyebrow) } : {})}
          {...(block.standfirst && t(block.standfirst)
            ? { standfirst: t(block.standfirst) }
            : {})}
        />
      )

    case 'STATEMENT':
      return <StatementBlockView block={block} t={t} />

    case 'PROSE':
      return <ProseBlockView block={block} t={t} />

    case 'COMPARISON':
      return <ComparisonBlockView block={block} t={t} />

    case 'ROLE_MAP':
      return <RoleMapBlockView block={block} t={t} />

    case 'JOURNEY':
      return <JourneyBlockView block={block} t={t} />

    case 'EXTERNAL_RESOURCES':
      return <ExternalResourcesBlockView block={block} resources={resources} t={t} />

    case 'FEATURE_GRID':
    case 'PROCESS':
    case 'PROJECT_TRANSPARENCY':
    case 'TRUST':
      return <FeatureGridBlockView block={block} t={t} />

    case 'TEXT_SECTION':
      return <TextSectionBlockView block={block} t={t} />

    case 'MEDIA':
      return <CityBandBlockView block={block} t={t} />

    case 'CTA':
      return <CtaBlockView block={block} t={t} />

    default:
      // An unknown block renders nothing rather than crashing the page. Once
      // the CMS is real, a block added by a newer deploy can reach an older
      // client, and a gap is a better outcome than a white screen.
      return null
  }
}
