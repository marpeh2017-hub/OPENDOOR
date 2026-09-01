import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { ProjectType } from '@urban-renewal/api-contracts'
import { getProjects, getProjectCities, getProjectTypes } from '@/mock'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectFilters } from '@/components/projects/project-filters'
import { ProjectsEmpty } from '@/components/projects/projects-empty'
import { shouldShowFilters } from '@/lib/project-presentation'

/**
 * Projects index.
 *
 * ── TWO STATES, NEITHER OF THEM A FALLBACK ─────────────────────────────────
 *
 * With nothing published this renders `ProjectsEmpty`, which is a fully
 * designed page and is what every visitor sees today. With projects published
 * it renders the grid. Both are primary; the empty state is not a placeholder
 * waiting to be replaced, and it stays correct on the day a project is
 * unpublished.
 *
 * ── THE FILTER RAIL IS DATA-AWARE ──────────────────────────────────────────
 *
 * See `shouldShowFilters`. It appears only when there are enough published
 * projects for filtering to beat reading, and only when at least one filter
 * would have more than one option. Nobody has to switch it on.
 *
 * ── `STUB_ROBOTS` IS GONE ──────────────────────────────────────────────────
 *
 * The page has real content and a real empty state; it is indexable. The route
 * joined `SITE_ROUTES` in `sitemap.ts` in the same change, as that file's
 * comment requires.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.projects' })
  return { title: t('title') }
}

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ city?: string; type?: string }>
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams])
  setRequestLocale(locale)

  const [tPages, tProjects, all, cities, types] = await Promise.all([
    getTranslations('pages.projects'),
    getTranslations('projects'),
    // Unfiltered, because the filter rail's visibility depends on the size of
    // the whole catalogue rather than on the current view: a filter that
    // narrows six projects to one must not then hide itself.
    getProjects({ limit: 100 }),
    getProjectCities(),
    getProjectTypes(),
  ])

  const showFilters = shouldShowFilters({
    total: all.total,
    cityCount: cities.length,
    typeCount: types.length,
  })

  // Filters only apply when the rail is actually offered. A hand-typed query
  // string cannot silently empty a page whose controls are not on screen.
  const page = showFilters
    ? await getProjects({
        limit: 100,
        ...(filters.city ? { city: filters.city } : {}),
        ...(filters.type ? { type: filters.type as ProjectType } : {}),
      })
    : all

  if (all.total === 0) {
    return (
      <>
        <PageHeader title={tPages('title')} />
        <Section size="lg">
          <ProjectsEmpty />
        </Section>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={tPages('title')}
        eyebrow={tProjects('eyebrow')}
        standfirst={tProjects('standfirst')}
      />

      <Section size="lg">
        {showFilters && (
          <ProjectFilters
            cities={cities}
            types={types}
            active={{
              ...(filters.city ? { city: filters.city } : {}),
              ...(filters.type ? { type: filters.type } : {}),
            }}
          />
        )}

        <ul className={`grid gap-8 sm:grid-cols-2 lg:grid-cols-3 ${showFilters ? 'mt-10' : ''}`}>
          {page.items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>

        {/* ONE line carrying every card's absences, so no card has to repeat a
            "not published" notice per missing field. The brief is explicit
            that per-field absence messages are wrong; this is where the
            explanation lives instead. */}
        <p className="mt-8 max-w-prose text-[13.5px] leading-relaxed text-gray-500">
          {tProjects('verifiedOnly')}
        </p>
      </Section>
    </>
  )
}
