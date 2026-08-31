import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { getProjectBySlug } from '@/mock'
import { PageShell } from '@/components/layout/page-shell'

/**
 * Project detail.
 *
 * Phase 1 skeleton: the real Project Transparency timeline is built in a later
 * task. What this route already has to get right is the two things every
 * visitor and every crawler depends on regardless of how much content exists
 * yet — the slug resolves to a real project, and the metadata describes it.
 *
 * ── FIXED HERE: THE SLUG WAS NEVER CHECKED ─────────────────────────────────
 *
 * The route previously rendered `<PageShell title={slug} />` for ANY slug,
 * including ones matching no project — `/projects/does-not-exist` returned
 * 200 with a page titled "does-not-exist". It now calls `getProjectBySlug`
 * and 404s when nothing matches, which is also what makes the metadata below
 * correct instead of a guess: title and slug are the same string only by
 * coincidence for a placeholder page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const project = await getProjectBySlug(slug)
  if (!project) return {}
  return {
    title: project.name,
    description: project.summary,
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const project = await getProjectBySlug(slug)
  if (!project) notFound()

  return <PageShell title={project.name} />
}
