import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAllProjectsForPreview } from '@/mock'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { ProjectCard } from '@/components/projects/project-card'

/**
 * Development-only projects index preview.
 *
 * The public index correctly shows its empty state, because nothing is
 * published. That means the GRID, the CARD and their data-density behaviour
 * would otherwise ship having never been rendered — which is the failure this
 * route exists to prevent, and the reason the sibling detail preview exists.
 *
 * Same three protections as that route, and for the same reasons:
 *   1. 404 in production, as the first statement, before any data call.
 *   2. `noindex, nofollow`.
 *   3. Absent from the sitemap; nothing links here.
 *
 * It renders the SAME `ProjectCard` the public grid uses. A preview with its
 * own card markup would be evidence of nothing.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function ProjectsPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { locale } = await params
  setRequestLocale(locale)

  const [tPreview, projects] = await Promise.all([
    getTranslations('projectPreview'),
    getAllProjectsForPreview(),
  ])

  return (
    <>
      <div className="bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-white lg:px-8">
        {tPreview('indexBanner')}
      </div>

      <PageHeader title={tPreview('indexTitle')} />

      <Section size="lg">
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>
      </Section>
    </>
  )
}
