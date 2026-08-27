import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { getHomePage, getFeaturedProjects, getKnowledgeArticles, getFaqItems } from '@/mock'
import { makeLocalizer } from '@/lib/localize'
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
 * mock. This file decides ORDER, SURFACE and which data each block needs; it
 * decides nothing about what the company says. That separation is what makes
 * the CMS a swap rather than a rewrite later.
 *
 * ── SURFACE RHYTHM ─────────────────────────────────────────────────────────
 *
 * Alternating page / raised / sunken bands give the long page structure without
 * putting each section in a card. The pattern is decided HERE, once, so section
 * components cannot each invent their own background and produce a page that
 * feels uneven for reasons nobody can name.
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

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = makeLocalizer(locale as Locale)
  const tLinks = await getTranslations('links')

  const [page, projects, articles, faqItems] = await Promise.all([
    getHomePage(),
    getFeaturedProjects(3),
    getKnowledgeArticles({ limit: 3 }),
    getFaqItems(),
  ])

  if (!page) notFound()

  /** Alternating surfaces, assigned by position among the non-hero blocks. */
  const tones = ['page', 'raised', 'sunken', 'page', 'raised', 'sunken'] as const
  let bandIndex = 0
  const nextTone = () => tones[bandIndex++ % tones.length]

  return (
    <>
      {page.blocks.map((block) => {
        switch (block.type) {
          case 'HERO':
            return <HeroBlockView key={block.id} block={block} t={t} />

          case 'FEATURE_GRID':
          case 'PROCESS':
          case 'PROJECT_TRANSPARENCY':
          case 'TRUST':
            return (
              <FeatureGridBlockView key={block.id} block={block} t={t} tone={nextTone()} />
            )

          case 'TEXT_SECTION':
            return (
              <TextSectionBlockView
                key={block.id}
                block={block}
                t={t}
                tone={nextTone()}
                cta={{ label: tLinks('whyOrganizer'), href: '/why-organizer' }}
              />
            )

          case 'PROJECTS':
            return (
              <ProjectsBlockView
                key={block.id}
                block={block}
                projects={projects}
                t={t}
                tone={nextTone()}
              />
            )

          case 'PORTAL':
            return <PortalBlockView key={block.id} block={block} t={t} tone={nextTone()} />

          case 'KNOWLEDGE':
            return (
              <KnowledgeBlockView
                key={block.id}
                block={block}
                articles={articles.items}
                t={t}
                tone={nextTone()}
              />
            )

          case 'FAQ':
            return (
              <FaqBlockView
                key={block.id}
                block={block}
                items={faqItems.slice(0, block.limit ?? 5)}
                t={t}
                tone={nextTone()}
              />
            )

          case 'CTA':
            return <CtaBlockView key={block.id} block={block} t={t} />

          default:
            // An unknown block type renders nothing rather than crashing the
            // page. Once the CMS is real, a block added by a newer deploy can
            // reach an older client, and a blank gap is a better outcome than a
            // white screen.
            return null
        }
      })}
    </>
  )
}
