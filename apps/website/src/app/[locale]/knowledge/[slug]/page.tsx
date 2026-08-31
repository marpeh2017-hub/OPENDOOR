import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { getArticleBySlug } from '@/mock'
import { PageShell } from '@/components/layout/page-shell'

/**
 * Knowledge article detail.
 *
 * ── THIS ROUTE DID NOT EXIST ────────────────────────────────────────────────
 *
 * The homepage's knowledge section, and the full `/knowledge` listing, both
 * link to `/knowledge/${article.slug}` for every article. With no `[slug]`
 * route under `knowledge/`, every one of those links fell through to the
 * catch-all and 404'd — a real dead link on a page a visitor reaches directly
 * from the homepage, not an edge case.
 *
 * Scaffolded to the same Phase 1 pattern as `projects/[slug]`: resolve the
 * slug against the mock repository, 404 on no match, and render the shared
 * placeholder shell otherwise. The real article layout — body, tags, related
 * articles, related projects — is a later task's content, not a routing fix.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return {}
  return {
    title: article.title,
    description: article.summary,
  }
}

export default async function KnowledgeArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  return <PageShell title={article.title} />
}
