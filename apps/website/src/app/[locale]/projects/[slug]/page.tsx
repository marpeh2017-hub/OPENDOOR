import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { PageShell } from '@/components/layout/page-shell'

/**
 * Project detail.
 *
 * Phase 1 skeleton. The real page renders the Project Transparency timeline
 * from typed mock data in a later task.
 *
 * `generateMetadata` reads the slug rather than a hardcoded title, so the tab,
 * bookmark and share preview are already correct per project before any content
 * exists — SEO structure that would otherwise be retrofitted (§38).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return { title: slug }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  return <PageShell title={slug} />
}
