import type {
  ProjectType, PublicProject, PublicProjectQuery, PublicProjectSummary, Paginated,
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

/**
 * Published AND publicly visible. Both, because they are independent.
 *
 * `publishState` gained a `review` value in Pass 1. This check is written as
 * an explicit equality against `published` rather than as an exclusion list,
 * so a state added later is non-public by DEFAULT: a new workflow state can
 * never accidentally start rendering on the public site because somebody
 * forgot to add it to a blocklist.
 */
function isPubliclyVisible(project: MockProject): boolean {
  return project.publishState === 'published' && project.visibility === 'public'
}

/**
 * Runs the honesty guard, removes authoring metadata, and REDACTS THE
 * VERIFIER NAMES.
 *
 * ── WHY REDACTION HAPPENS HERE AND NOT IN A COMPONENT ──────────────────────
 *
 * A server-rendered page serialises whatever objects it was handed. A field
 * that is fetched but never displayed still reaches every visitor in the page
 * source, where it is greppable, archived by crawlers and plainly visible in
 * view-source. Not rendering `verifiedByName` is therefore NOT the same as not
 * publishing it, and the difference is the whole requirement.
 *
 * Removing it at the repository boundary means no component can leak it by
 * accident, because no component is ever given it: `PublicProject` is typed
 * with `PublicVerifiedFact`, which has no such field. The name stays in the
 * record for the CMS and for anyone who needs to ask who checked.
 */
function toPublic(project: MockProject): PublicProject {
  const checked = stripProvenance(assertNoInventedClaims(project, project.slug))
  return redactVerifiers(checked as PublicProject)
}

/** Drops `verifiedByName` from every verified fact on a project, at any depth
 *  the contract puts one. */
function redactVerifiers(project: PublicProject): PublicProject {
  const drop = <T,>(fact: T | undefined): T | undefined => {
    if (!fact) return undefined
    const { verifiedByName: _name, ...rest } = fact as Record<string, unknown> & {
      verifiedByName?: string
    }
    return rest as T
  }

  return {
    ...project,
    ...pick('currentStage', drop(project.currentStage)),
    ...pick('existingUnits', drop(project.existingUnits)),
    ...pick('proposedUnits', drop(project.proposedUnits)),
    ...pick('buildingCount', drop(project.buildingCount)),
    ...pick('planningStatus', drop(project.planningStatus)),
    ...pick('developer', drop(project.developer)),
    ...pick('professionals', drop(project.professionals)),
    ...pick('approvals', drop(project.approvals)),
    ...pick('permits', drop(project.permits)),
    ...pick('materialDates', drop(project.materialDates)),
    ...(project.milestones
      ? {
          milestones: project.milestones.map((milestone) => ({
            ...milestone,
            ...pick('verification', drop(milestone.verification)),
          })),
        }
      : {}),
  }
}

/** Spreads a key only when it has a value, so `exactOptionalPropertyTypes`
 *  never sees an explicit `undefined`. */
function pick<K extends string, V>(key: K, value: V | undefined) {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>)
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
    // Optional on purpose: most projects have no verified stage, and the card
    // must render without one. The whole `VerifiedFact` wrapper travels with
    // it rather than just the value, so a consumer that wants to show "who
    // confirmed this" can, and one that unwraps it has to do so deliberately.
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
    .filter((p) => (stage ? p.currentStage?.value === stage : true))
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

/**
 * Distinct renewal tracks among published projects.
 *
 * Derived for the same reason as the cities: a hardcoded list would offer a
 * filter for a track nothing is published under, and the visitor who picks it
 * gets an empty page from a control the site itself drew.
 */
export async function getProjectTypes(): Promise<ProjectType[]> {
  const types = MOCK_PROJECTS.filter(isPubliclyVisible).map((p) => p.type)
  return [...new Set(types)]
}

/**
 * A project regardless of publish state, for the development preview only.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THIS IS HOW THE RICH AND SPARSE STATES GET TESTED WITHOUT PUBLISHING THEM
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The QA brief requires the populated detail page to be exercised, and also
 * requires that the fixtures used to do it never become public content. Those
 * two are only compatible if there is a way to render an internal record
 * outside the public filter.
 *
 * The safety is not in this function, which deliberately bypasses
 * `isPubliclyVisible`. It is in its ONLY caller: a route that returns 404
 * before doing anything else when `NODE_ENV === 'production'`. That route is
 * therefore the thing to read before changing anything here, and this function
 * must never be called from a page that ships.
 *
 * It doubles as the shape of the CMS "preview before publish" capability the
 * architecture calls for, which is why it lives here rather than in a test
 * helper.
 */
export async function getProjectForPreview(slug: string): Promise<PublicProject | null> {
  const found = MOCK_PROJECTS.find((p) => p.slug === slug)
  return found ? toPublic(found) : null
}

/**
 * Every project as card summaries, published or not. Development preview only.
 *
 * Same bypass, same single safe caller rule as `getProjectForPreview`: the
 * projects preview index 404s in production before calling this. It exists so
 * the grid and the card are rendered at least once before they ship, since the
 * public index correctly shows its empty state and would otherwise never
 * exercise them.
 *
 * Templates (which have no name) are excluded: they are a CMS starting point,
 * not a card, and a nameless card tests nothing.
 */
export async function getAllProjectsForPreview(): Promise<PublicProjectSummary[]> {
  return MOCK_PROJECTS
    .filter((p) => p.name.length > 0)
    .map(toPublic)
    .map(toSummary)
}
