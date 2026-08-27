import type {
  PublicProject, PublicProjectQuery, PublicProjectSummary, Paginated,
} from '@urban-renewal/api-contracts'
import { MOCK_PROJECTS, type MockProject } from '../fixtures/projects'
import { assertNoInventedClaims, stripProvenance } from '../provenance'

/**
 * Project repository.
 *
 * ── WHY EVERY FUNCTION IS ASYNC ────────────────────────────────────────────
 *
 * Nothing here awaits anything. They are async so that swapping this module for
 * an HTTP client in Phase 2 requires NO change in any component: the call sites
 * already `await`, already handle a pending state, and already sit in a Server
 * Component or a `use()` boundary. A synchronous mock would let components be
 * written in a shape that cannot survive a real network call, and the rewrite
 * would surface everywhere at once.
 *
 * ── WHY COMPONENTS MUST NOT IMPORT THE FIXTURES ────────────────────────────
 *
 * The fixture array is not exported from the mock barrel. A component importing
 * `MOCK_PROJECTS` directly would bypass the publish filter, the provenance
 * guard and the projection below — and would have to be rewritten when the data
 * moves behind an API. Access is through these functions only.
 *
 * ── WHAT "PUBLIC" MEANS HERE ───────────────────────────────────────────────
 *
 * The filter below is PRESENTATION, not authorisation. It decides what this
 * mock returns; in Phase 2 the server decides, and this filter becomes
 * redundant rather than load-bearing.
 */

/** Published AND publicly visible. Both, because they are independent. */
function isPubliclyVisible(project: MockProject): boolean {
  return project.publishState === 'published' && project.visibility === 'public'
}

/** Runs the honesty guard, then removes authoring metadata. */
function toPublic(project: MockProject): PublicProject {
  return stripProvenance(assertNoInventedClaims(project, project.slug))
}

/** Card projection — exactly what a grid needs, nothing more. */
function toSummary(project: PublicProject): PublicProjectSummary {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    type: project.type,
    location: project.location,
    summary: project.summary,
    // Optional on purpose: a realistic placeholder has no stage, and the card
    // must render without one.
    ...(project.currentStage ? { currentStage: project.currentStage } : {}),
    ...(project.heroImage ? { heroImage: project.heroImage } : {}),
    featured: project.featured,
  } as PublicProjectSummary
}

export async function getProjects(
  query: PublicProjectQuery = {},
): Promise<Paginated<PublicProjectSummary>> {
  const { city, type, stage, featured, search, limit = 12, offset = 0 } = query

  const matched = MOCK_PROJECTS
    .filter(isPubliclyVisible)
    .map(toPublic)
    .filter((p) => (city ? p.location.city === city : true))
    .filter((p) => (type ? p.type === type : true))
    .filter((p) => (stage ? p.currentStage === stage : true))
    .filter((p) => (featured === undefined ? true : p.featured === featured))
    .filter((p) =>
      search
        ? [p.name, p.summary, p.location.city].join(' ').toLowerCase().includes(search.toLowerCase())
        : true,
    )
    // Featured first, then most recently updated. Deterministic, so the grid
    // does not reshuffle between renders.
    .sort((a, b) =>
      Number(b.featured) - Number(a.featured) || b.updatedAt.localeCompare(a.updatedAt),
    )

  return {
    items: matched.slice(offset, offset + limit).map(toSummary),
    total: matched.length,
    limit,
    offset,
  }
}

/**
 * One project, or null.
 *
 * Null rather than a throw: "not found" is an ordinary outcome the page turns
 * into a 404, whereas an exception would be indistinguishable from a real
 * failure once this is backed by a network call.
 */
export async function getProjectBySlug(slug: string): Promise<PublicProject | null> {
  const found = MOCK_PROJECTS.filter(isPubliclyVisible).find((p) => p.slug === slug)
  return found ? toPublic(found) : null
}

export async function getFeaturedProjects(limit = 3): Promise<PublicProjectSummary[]> {
  const page = await getProjects({ featured: true, limit })
  return page.items
}

/** Distinct cities, for the project filter. Derived, never a hardcoded list. */
export async function getProjectCities(): Promise<string[]> {
  const cities = MOCK_PROJECTS.filter(isPubliclyVisible).map((p) => p.location.city)
  return [...new Set(cities)].sort((a, b) => a.localeCompare(b, 'he'))
}
