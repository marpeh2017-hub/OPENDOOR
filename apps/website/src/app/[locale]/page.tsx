import { localeAlternates } from '@/lib/seo'
import { Fragment } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { getHomePage, getFeaturedProjects, getFaqItems } from '@/mock'
import { makeLocalizer } from '@/lib/localize'
import { CityBandBlockView } from '@/components/blocks/city-band-block'
import { HeroBlockView } from '@/components/blocks/hero-block'
import { FeatureGridBlockView } from '@/components/blocks/feature-grid-block'
import { TextSectionBlockView } from '@/components/blocks/text-section-block'
import { ProjectsBlockView } from '@/components/blocks/projects-block'
import { PortalBlockView } from '@/components/blocks/portal-block'
import { FaqBlockView } from '@/components/blocks/faq-block'
import { CtaBlockView } from '@/components/blocks/cta-block'
import { DoorsBlockView } from '@/components/blocks/doors-block'
import { FactStripBlockView } from '@/components/blocks/fact-strip-block'
import { NetworkBlockView } from '@/components/blocks/network-block'

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
 * V2 keeps one continuous surface, and the 2026-10 page keeps the rule with
 * fewer sections: the doors sit on the brand wash as the page's invitation,
 * the process on the sunken band, and the facts strip is the single dark
 * moment. Because the exceptions are rare, they register as emphasis rather
 * than as a pattern.
 *
 * That decision now lives in each section's own component rather than in a
 * positional table here. A positional table was right while every section was
 * interchangeable; it is wrong once the surface is part of what a section
 * MEANS, because inserting one block in the CMS would silently restyle three
 * others.
 *
 * ── NO CONNECTORS SINCE 2026-10 ────────────────────────────────────────────
 *
 * Hairlines once straddled the seams so eleven sections read as one journey.
 * The page is now six short sections, two of them on their own grounds (the
 * doors on the wash, the facts on the dark strip), and the change of ground
 * is the seam.
 *
 * ── COLLECTION DATA ────────────────────────────────────────────────────────
 *
 * Collection blocks reference content rather than duplicating it, so their rows
 * are fetched here in parallel. Three awaits sequentially would serialise three
 * round trips once these are real API calls. A collection is fetched only when
 * a visible block needs it: since the 2026-10 review the page carries none by
 * default, and the projects block is hidden until a project is published.
 */
async function pageMetadata({
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

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = makeLocalizer(locale as Locale)
  const tLinks = await getTranslations('links')

  const page = await getHomePage()
  if (!page) notFound()

  // Hidden blocks keep their content in the CMS and render nothing.
  const blocks = page.blocks.filter((block) => !block.hidden)
  const uses = (type: string) => blocks.some((block) => block.type === type)

  const [projects, faqItems] = await Promise.all([
    uses('PROJECTS') ? getFeaturedProjects(3) : [],
    uses('FAQ') ? getFaqItems(undefined, locale as Locale) : [],
  ])

  return (
    <div className="relative">
      {blocks.map((block) => {
        let rendered: React.ReactNode = null

        switch (block.type) {
          case 'HERO':
            rendered = <HeroBlockView block={block} t={t} />
            break

          case 'DOORS':
            rendered = <DoorsBlockView block={block} t={t} />
            break

          case 'FACT_STRIP':
            rendered = <FactStripBlockView block={block} t={t} />
            break

          case 'NETWORK':
            rendered = <NetworkBlockView block={block} t={t} />
            break

          case 'FEATURE_GRID':
          case 'PROCESS':
          case 'PROJECT_TRANSPARENCY':
          case 'TRUST':
          case 'VERIFIABLE_FACTS':
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
            // The knowledge centre was removed on 2026-10-07 (the forms page
            // took its place), so a knowledge block left on the page in the
            // CMS renders nothing.
            rendered = null
            break

          case 'FAQ':
            rendered = (
              <FaqBlockView block={block} items={faqItems.slice(0, block.limit ?? 5)} t={t} />
            )
            break

          case 'MEDIA':
            // The city panorama now opens the page in the managed hero gallery.
            rendered = block.id === 'home-city-rail' ? null : <CityBandBlockView block={block} t={t} />
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

        return <Fragment key={block.id}>{rendered}</Fragment>
      })}
    </div>
  )
}

/**
 * Canonical and hreflang, added around the page's own metadata so each page
 * keeps owning its title and description.
 */
export async function generateMetadata(
  props: Parameters<typeof pageMetadata>[0],
): Promise<Metadata> {
  const { locale } = await props.params
  return { ...(await pageMetadata(props)), alternates: localeAlternates(locale, '') }
}
