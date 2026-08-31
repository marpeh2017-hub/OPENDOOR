import { Fragment } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { getHomePage, getFeaturedProjects, getKnowledgeArticles, getFaqItems } from '@/mock'
import { makeLocalizer } from '@/lib/localize'
import { SectionConnector } from '@/components/brand/architecture'
import { JourneyThread } from '@/components/brand/journey-thread'
import { CityBandBlockView } from '@/components/blocks/city-band-block'
import { HeroBlockView } from '@/components/blocks/hero-block'
import { FeatureGridBlockView } from '@/components/blocks/feature-grid-block'
import { TextSectionBlockView } from '@/components/blocks/text-section-block'
import { ProjectsBlockView } from '@/components/blocks/projects-block'
import { PortalBlockView } from '@/components/blocks/portal-block'
import { KnowledgeBlockView } from '@/components/blocks/knowledge-block'
import { FaqBlockView } from '@/components/blocks/faq-block'
import { CtaBlockView } from '@/components/blocks/cta-block'

/**
 * Homepage.
 *
 * ── THE PAGE OWNS NO COPY ──────────────────────────────────────────────────
 *
 * Every sentence a visitor reads comes from `getHomePage()` — the CMS-shaped
 * mock. This file decides ORDER and which data each block needs; it decides
 * nothing about what the company says. That separation is what makes the CMS a
 * swap rather than a rewrite later, and V2 did not weaken it: the new visual
 * work added components, not copy.
 *
 * ── SURFACE RHYTHM: WHAT V2 CHANGED ────────────────────────────────────────
 *
 * V1 alternated page / raised / sunken bands, assigned here by position. It was
 * tidy, and it was the main reason the page read as eleven separate slides —
 * every section announced its own edge.
 *
 * V2 keeps one continuous surface. Three sections deviate, and each deviation
 * means something: the process sits on the sunken band as the page's first
 * change of ground, trust is the single dark moment, and knowledge returns to
 * sunken to close the editorial run. Because the exceptions are rare, they
 * register as emphasis rather than as a pattern.
 *
 * That decision now lives in each section's own component rather than in a
 * positional table here. A positional table was right while every section was
 * interchangeable; it is wrong once the surface is part of what a section
 * MEANS, because inserting one block in the CMS would silently restyle three
 * others.
 *
 * ── CONNECTORS ─────────────────────────────────────────────────────────────
 *
 * A hairline with a marker straddles the seams where the page changes subject.
 * The eye follows a line through the boundary instead of stopping at it, which
 * is what turns eleven sections into one journey. Decorative, `aria-hidden`,
 * and used at three seams rather than at all ten — a device used everywhere is
 * just a divider, and dividers are what V2 removed.
 *
 * ── COLLECTION DATA ────────────────────────────────────────────────────────
 *
 * Collection blocks reference content rather than duplicating it, so their rows
 * are fetched here in parallel. Three awaits sequentially would serialise three
 * round trips once these are real API calls.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const page = await getHomePage()
  const seo = page?.seo[locale as Locale]
  if (!seo) return {}
  return {
    // Overrides the layout's `%s | brand` template — the homepage title should
    // not repeat the brand name twice.
    title: { absolute: seo.title },
    description: seo.description,
  }
}

/**
 * Seams that get a connector, keyed by the block the connector follows.
 * Chosen where the page changes subject.
 */
const CONNECT_AFTER = new Set(['home-hero', 'home-process', 'home-transparency'])

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = makeLocalizer(locale as Locale)
  const [tLinks, tJourney] = await Promise.all([
    getTranslations('links'),
    getTranslations('journey'),
  ])

  const [page, projects, articles, faqItems] = await Promise.all([
    getHomePage(),
    getFeaturedProjects(3),
    getKnowledgeArticles({ limit: 3 }),
    getFaqItems(),
  ])

  if (!page) notFound()

  /**
   * The journey's waypoints. Content, so they come from the catalogue rather
   * than this file — and they are the same six beats the page argues in prose,
   * which is what makes the thread a summary of the page rather than an
   * ornament running beside it.
   */
  const waypoints = ['city', 'threshold', 'process', 'project', 'transparency', 'portal'].map(
    (key) => tJourney(key),
  )

  return (
    <div className="relative">
      <JourneyThread waypoints={waypoints} />

      {page.blocks.map((block) => {
        let rendered: React.ReactNode = null

        switch (block.type) {
          case 'HERO':
            rendered = <HeroBlockView block={block} t={t} />
            break

          case 'FEATURE_GRID':
          case 'PROCESS':
          case 'PROJECT_TRANSPARENCY':
          case 'TRUST':
            rendered = <FeatureGridBlockView block={block} t={t} />
            break

          case 'TEXT_SECTION':
            rendered = (
              <TextSectionBlockView
                block={block}
                t={t}
                cta={{ label: tLinks('whyOrganizer'), href: '/why-organizer' }}
              />
            )
            break

          case 'PROJECTS':
            rendered = <ProjectsBlockView block={block} projects={projects} t={t} />
            break

          case 'PORTAL':
            rendered = <PortalBlockView block={block} t={t} />
            break

          case 'KNOWLEDGE':
            rendered = <KnowledgeBlockView block={block} articles={articles.items} t={t} />
            break

          case 'FAQ':
            rendered = (
              <FaqBlockView block={block} items={faqItems.slice(0, block.limit ?? 5)} t={t} />
            )
            break

          case 'MEDIA':
            rendered = <CityBandBlockView block={block} t={t} />
            break

          case 'CTA':
            rendered = <CtaBlockView block={block} t={t} />
            break

          default:
            // An unknown block type renders nothing rather than crashing the
            // page. Once the CMS is real, a block added by a newer deploy can
            // reach an older client, and a blank gap is a better outcome than a
            // white screen.
            rendered = null
        }

        if (!rendered) return null

        return (
          <Fragment key={block.id}>
            {rendered}
            {CONNECT_AFTER.has(block.id) && <SectionConnector />}
          </Fragment>
        )
      })}
    </div>
  )
}
