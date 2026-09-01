import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { getPageBySlug, getExternalResources } from '@/mock'
import { makeLocalizer } from '@/lib/localize'
import { PageBlocks } from '@/components/blocks/page-blocks'

/**
 * Transparency and trust.
 *
 * ── THIS ROUTE OWNS NO COPY AND NO COMPOSITION ─────────────────────────────
 *
 * It resolves the locale, fetches the page and hands the blocks to
 * `PageBlocks`. Every sentence, every section and the order they appear in
 * live in `src/mock/fixtures/core-pages.ts`, which is what makes the eventual
 * CMS a swap rather than a rewrite.
 *
 * The page looks different from its three siblings because it uses different
 * blocks in a different order, not because this file lays anything out.
 */
const SLUG = 'trust'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const page = await getPageBySlug(SLUG)
  const seo = page?.seo[locale as Locale]
  if (!seo) return {}
  return { title: seo.title, description: seo.description }
}

export default async function TrustPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = makeLocalizer(locale as Locale)
  const [page, resources] = await Promise.all([
    getPageBySlug(SLUG),
    getExternalResources(),
  ])

  if (!page) notFound()

  return <PageBlocks blocks={page.blocks} t={t} resources={resources} />
}
