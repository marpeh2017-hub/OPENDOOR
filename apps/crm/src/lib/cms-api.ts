import { api, upload } from './api-client'

/**
 * The Site Manager's API client.
 *
 * Every call goes through the CRM's existing BFF proxy, so the httpOnly access
 * token is never exposed to this code and the CMS inherits the same 401
 * refresh and 403 handling as the rest of the CRM. There is no second auth
 * path here, deliberately: a CMS that authenticated differently would be a
 * second place for access to be revoked incompletely.
 *
 * Nothing here sends a tenant id. The gateway takes it from the verified JWT
 * and would ignore one anyway — the DTOs do not declare the field, so
 * `whitelist: true` strips it. That is worth knowing when reading these
 * signatures and wondering where the tenant went.
 */

export type CmsState = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED'

export interface CmsListItem {
  id: string
  kind: string
  slug: string
  state: CmsState
  exposure: 'PUBLIC' | 'INTERNAL' | 'FEASIBILITY'
  updatedAt: string
  firstPublishedAt: string | null
  livePublicationId: string | null
  updatedBy: { id: string; firstName: string; lastName: string } | null
}

export interface CmsContentDetail {
  id: string
  kind: string
  slug: string
  state: CmsState
  exposure: 'PUBLIC' | 'INTERNAL' | 'FEASIBILITY'
  draft: Record<string, unknown>
  seo: Record<string, unknown> | null
  currentRevisionId: string | null
  livePublicationId: string | null
  updatedAt: string
  verifications: {
    field: string
    status: string
    verifiedAt: string | null
    source: string | null
    sourceReference: string | null
  }[]
}

export interface CmsRevisionSummary {
  id: string
  sequence: number
  reason: 'SAVE' | 'PUBLISH' | 'UNPUBLISH' | 'RESTORE'
  stateAtRevision: CmsState
  createdAt: string
  summary: string | null
  restoredFromRevisionId: string | null
  author: { id: string; firstName: string; lastName: string } | null
}

export interface PublicationCheck {
  canPublish: boolean
  blockers: { code: string; message: string; field?: string }[]
  warnings: { code: string; message: string; field?: string }[]
  /** Projects only: the two columns that make the check readable. */
  willBecomePublic?: { field: string; label: string }[]
  staysPrivate?: { area: string; label: string; detail: string }[]
}

export interface FactAuditEntry {
  id: string
  field: string
  event: 'EDITED' | 'VERIFIED' | 'INVALIDATED' | 'REVIEW_REQUESTED'
  status: string
  occurredAt: string
  previousValueLabel: string | null
  newValueLabel: string | null
  source: string | null
  sourceReference: string | null
  note: string | null
  actor: { id: string; firstName: string; lastName: string } | null
}

/**
 * The BFF proxy at /api/proxy prepends `/api/v1`, so paths here start at the
 * resource. Repeating the version produced /api/v1/v1/cms/content and a 404
 * from Express rather than a typed error.
 */
const BASE = '/cms/content'

export const cmsApi = {
  list: (params: { kind?: string; state?: string } = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    ).toString()
    return api.get<CmsListItem[]>(`${BASE}${q ? `?${q}` : ''}`)
  },

  get: (id: string) => api.get<CmsContentDetail>(`${BASE}/${id}`),

  revisions: (id: string) => api.get<CmsRevisionSummary[]>(`${BASE}/${id}/revisions`),

  revision: (id: string, revisionId: string) =>
    api.get<{ id: string; sequence: number; snapshot: Record<string, unknown> }>(
      `${BASE}/${id}/revisions/${revisionId}`,
    ),

  publicationCheck: (id: string) => api.get<PublicationCheck>(`${BASE}/${id}/publication-check`),

  /**
   * `expectedRevisionId` is sent on every save. The editor always knows which
   * revision it loaded, so there is no reason to omit the guard and let a
   * second editor's work be overwritten silently.
   */
  save: (
    id: string,
    body: { draft: unknown; seo?: unknown; summary?: string; expectedRevisionId?: string },
  ) => api.patch<CmsContentDetail>(`${BASE}/${id}`, body),

  setState: (id: string, state: 'DRAFT' | 'IN_REVIEW') =>
    api.patch<CmsContentDetail>(`${BASE}/${id}/state`, { state }),

  previewToken: (id: string) =>
    api.post<{ token: string; expiresInSeconds: number }>(`${BASE}/${id}/preview-token`),

  publish: (id: string) => api.post<CmsContentDetail>(`${BASE}/${id}/publish`),

  unpublish: (id: string) => api.post<CmsContentDetail>(`${BASE}/${id}/unpublish`),

  restore: (id: string, revisionId: string) =>
    api.post<CmsContentDetail>(`${BASE}/${id}/revisions/${revisionId}/restore`),

  // ── Verification ────────────────────────────────────────────────────────
  //
  // Two methods for two capabilities. `setFact` needs EDIT and invalidates any
  // existing verification; `verifyFact` needs VERIFY and signs for the value
  // as it currently stands. Neither can do the other's job, which is what
  // makes SELF_VERIFIED meaningful rather than decorative.

  factHistory: (id: string, field?: string) =>
    api.get<FactAuditEntry[]>(
      `${BASE}/${id}/facts/history${field ? `?field=${encodeURIComponent(field)}` : ''}`,
    ),

  setFact: (
    id: string,
    field: string,
    body: { value: unknown; sourceId?: string; sourceReference?: string; note?: string },
  ) => api.patch<CmsContentDetail>(`${BASE}/${id}/facts/${encodeURIComponent(field)}`, body),

  verifyFact: (
    id: string,
    field: string,
    body: { sourceId?: string; sourceReference?: string; note?: string; requiresSecondReview?: boolean } = {},
  ) => api.post<CmsContentDetail>(`${BASE}/${id}/facts/${encodeURIComponent(field)}/verify`, body),

  // ── Project media ────────────────────────────────────────────────────────
  //
  // Bytes only, exactly like the document library's own upload. The
  // reference itself (classification, alt text, caption, order) is edited
  // in-memory and persisted through the ordinary `save()` above.

  uploadMedia: (id: string, file: File, onProgress?: (percent: number | null) => void) => {
    const form = new FormData()
    form.append('file', file)
    return upload<{ storageKey: string; filename: string; mimeType: string }>(
      `${BASE}/${id}/media/upload`, form, onProgress,
    )
  },

  mediaUrl: (id: string, mediaId: string) =>
    api.get<{ url: string }>(`${BASE}/${id}/media/${mediaId}/url`),

  // ── Feasibility ─────────────────────────────────────────────────────────
  //
  // Its own tier on the server (`CMS_FEASIBILITY_ROLES`), and its own routes.
  // There is no publish call here and there will not be one: the projection
  // never reads feasibility, so there is nothing to publish.
  //
  // An edit is an OPERATION, not a document. A client that PUT the whole
  // workspace could write `calculatedValue`, and a calculated field the
  // browser can write is not a calculated field.

  feasibility: (id: string) =>
    api.get<FeasibilityResponse>(`${BASE}/${id}/feasibility`),

  saveFeasibility: (id: string, edit: FeasibilityEdit) =>
    api.patch<{ contentId: string; workspace: FeasibilityWorkspace; revisionId: string }>(
      `${BASE}/${id}/feasibility`, edit,
    ),
}

// ── Feasibility wire types ────────────────────────────────────────────────
//
// Mirrors `services/api-gateway/src/cms/feasibility-model.ts`. Numbers are
// STRINGS on purpose, all the way to the screen: parsing one into a JS number
// anywhere on this path would reintroduce exactly the drift the server is
// storing decimal strings to avoid.

export type NumericKind =
  | 'AREA_SQM' | 'CURRENCY_ILS' | 'PERCENT' | 'COUNT' | 'DECIMAL' | 'BOOLEAN' | 'TEXT'
export type FieldCategory = 'SOURCE_DATA' | 'ASSUMPTION' | 'OUTPUT' | 'ECONOMICS'
export type FieldRole = 'INPUT' | 'FORMULA'
export type EffectiveRole = 'INPUT' | 'FORMULA' | 'MANUAL_OVERRIDE'
export type CalcStatus = 'OK' | 'MISSING_INPUTS' | 'NOT_CALCULATED'
export type FeasReviewState = 'UNREVIEWED' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED'

export interface FeasibilityField {
  key: string
  label: string
  category: FieldCategory
  role: FieldRole
  kind: NumericKind
  value?: string
  unit?: string
  note?: string
  sourceRef?: string
  reviewState?: FeasReviewState
  importedFrom?: string
  formulaId?: string
  calculatedValue?: string
  calculatedAt?: string
  calcStatus?: CalcStatus
  missingInputs?: string[]
  override?: { value: string; reason: string; userId: string; at: string }
  warnings?: string[]
}

export interface FeasibilityScenario {
  id: string
  label: string
  kind: 'BASELINE' | 'ALTERNATIVE_PLANNING' | 'DEVELOPER_PROPOSAL' | 'OWNER_PREFERRED'
  note?: string
  fields: Record<string, FeasibilityField>
  createdAt?: string
  updatedAt?: string
}

export interface FeasibilityWorkspace {
  version: 2
  scenarios: FeasibilityScenario[]
  activeScenarioId: string
  sourceWarnings?: { id: string; label: string; detail: string }[]
}

export interface FeasibilityResponse {
  contentId: string
  slug: string
  dataQualityFlags: { id: string; label: string; detail: string; severity: string }[]
  workspace: FeasibilityWorkspace | null
  updatedAt: string
}

export type FeasibilityEdit =
  | { op: 'setValue'; scenarioId: string; key: string; value: string }
  | { op: 'setMeta'; scenarioId: string; key: string; note?: string; sourceRef?: string; reviewState?: FeasReviewState }
  | { op: 'setOverride'; scenarioId: string; key: string; value: string; reason: string }
  | { op: 'clearOverride'; scenarioId: string; key: string }
  | {
      op: 'addField'; scenarioId: string; key: string
      category: FieldCategory; label?: string; kind?: NumericKind
      value?: string; unit?: string; note?: string
    }
