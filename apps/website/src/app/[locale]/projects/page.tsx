import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
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
 * ── THE FILTER RAIL IS DATA-AWARE, AND THIS PAGE IS STATIC ─────────────────
 *
 * See `shouldShowFilters`: the rail appears only when there are enough
 * published projects for filtering to beat reading, and only when at least one
 * filter would have more than one option.
 *
 * ── WHY THERE IS NO `searchParams` ─────────────────────────────────────────
 *
 * Accepting `searchParams` opts a route out of static generation in Next's App
 * Router — unconditionally, whether or not any query string is ever read. This
 * page briefly did, and the result was the site's project index being
 * server-rendered on every request to support filters that are hidden until
 * there are seven projects. That is a real cost paid for a capability nobody
 * can reach.
 *
 * So the route takes no query string and prerenders like every other page on
 * the site. Everything filtering needs is still here and still tested by the
 * type checker: `shouldShowFilters` and its threshold, `getProjectCities`,
 * `getProjectTypes`, the `ProjectFilters` component and the `city`/`type`
 * fields on `PublicProjectQuery`, which the repository still honours.
 *
 * ── HOW TO TURN FILTERING ON, WHEN IT IS WORTH IT ──────────────────────────
 *
 * Do NOT add `searchParams` back to this route: that would return the whole
 * index to dynamic rendering to serve a minority of visits.
 *
 * Add a sibling route instead — `/projects/filter` — which accepts
 * `?city=`/`?type=`, passes them to `getProjects` and renders the same grid.
 * It is dynamic, and only that route pays for it. Then point `ProjectFilters`
 * at it (one `href` prefix) and render the rail here as a link into it. The
 * threshold keeps deciding when the rail appears, so the switch is genuinely
 * one route file plus one prefix.
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
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const [tPages, tProjects, page, cities, types] = await Promise.all([
    getTranslations('pages.projects'),
    getTranslations('projects'),
    getProjects({ limit: 100 }),
    getProjectCities(),
    getProjectTypes(),
  ])

  // Computed, not read from a query string. See the block comment above: this
  // is false today, and it is what a future activation switches on.
  const showFilters = shouldShowFilters({
    total: page.total,
    cityCount: cities.length,
    typeCount: types.length,
  })

  if (page.total === 0) {
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
        {/* Unreachable while `showFilters` is false, which is deliberate and
            is why the component, its props and this call site all stay: turning
            filtering on is an edit here, not a rebuild. `active` is empty
            because this route no longer reads a query string. */}
        {showFilters && <ProjectFilters cities={cities} types={types} active={{}} />}

        <ul className={`grid gap-8 sm:grid-cols-2 lg:grid-cols-3 ${showFilters ? 'mt-10' : ''}`}>
          {page.items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </ul>

        {/* ONE line carrying every card's absences, so no card has to repeat a
            "not published" notice per missing field. The brief is explicit
            that per-field absence messages are wrong; this is where the
            explanation lives instead. */}
        <p className="mt-8 max-w-prose text-[13.5px] leading-relaxed text-gray-600">
          {tProjects('verifiedOnly')}
        </p>
      </Section>
    </>
  )
}
