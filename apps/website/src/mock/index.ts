/**
 * MOCK CONTENT LAYER — the website's only content source in Phase 1.
 *
 * ── DEPENDENCY DIRECTION ───────────────────────────────────────────────────
 *
 *     @urban-renewal/api-contracts  →  mock  →  website UI
 *
 * The contracts know nothing about this folder. Reverse that and the shared
 * vocabulary starts being shaped by one app's fixtures.
 *
 * ── WHAT THIS BARREL DELIBERATELY DOES NOT EXPORT ──────────────────────────
 *
 * The fixture arrays. A component importing `MOCK_PROJECTS` directly would
 * bypass the publish filter, the provenance guard and the card projection — and
 * would need rewriting when the data moves behind an API. Access is through the
 * repository functions only, and they are async so call sites are already
 * shaped for a network round trip.
 *
 * ── REPLACING THIS WITH A REAL API ─────────────────────────────────────────
 *
 * Phase 2 changes the BODY of each repository function to a `fetch` against the
 * gateway. Signatures, return types and call sites are unchanged, because both
 * sides are typed by the contracts.
 */
export {
  getProjects,
  getProjectBySlug,
  getFeaturedProjects,
  getProjectCities,
  getProjectTypes,
  getProjectForPreview,
  getAllProjectsForPreview,
} from './repositories/projects.repository'

export {
  getKnowledgeArticles,
  getFaqItems,
  getExternalResources,
} from './repositories/knowledge.repository'

export { search } from './repositories/search.repository'

export { getPageBySlug, getHomePage } from './repositories/content.repository'
