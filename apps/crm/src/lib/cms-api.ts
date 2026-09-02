import { api } from './api-client'

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
  blockers: { code: string; message: string }[]
  warnings: { code: string; message: string }[]
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
}
