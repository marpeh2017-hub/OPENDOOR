import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, upload } from '@/lib/api-client'

/**
 * Excel import.
 *
 * Every path here is relative to the same-origin BFF proxy, which PREPENDS
 * `/api/v1/` — so no path in this file contains `api/v1`, and nothing ever
 * addresses http://localhost:4000 directly (the access token is an httpOnly
 * cookie on the CRM origin and would not be sent cross-origin).
 *
 * No national ID ever appears in any of these payloads. The API returns
 * `hasNationalId` on preview rows and a fixed mask on issue values; there is no
 * field here that could carry one.
 */

export type ImportEntityType = 'OWNER' | 'RESIDENT'
export type ImportMode = 'ADD_ONLY' | 'UPDATE_ONLY' | 'ADD_AND_UPDATE'
export type ImportJobStatus =
  | 'UPLOADED' | 'MAPPED' | 'PREVIEWED' | 'IMPORTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type ImportRowOutcome =
  | 'CREATE' | 'UPDATE' | 'SKIP_DUPLICATE' | 'SKIP_MODE' | 'INVALID' | 'NEEDS_REVIEW'

export interface ImportJob {
  id: string
  projectId: string
  entityType: ImportEntityType
  mode: ImportMode
  status: ImportJobStatus
  fileName: string
  fileSize: number
  sheetName: string | null
  sheetHeaders: string[]
  totalRows: number
  createdRows: number
  updatedRows: number
  skippedRows: number
  failedRows: number
  errorSummary: { code: string; message: string; count: number }[] | null
  failureReason: string | null
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  createdById: string
  createdAt: string
  updatedAt: string
  project?: { id: string; name: string; code: string }
  createdBy?: { id: string; firstName: string; lastName: string }
  _count?: { issues: number }
  // storageKey is deliberately absent from every API response.
}

export interface MappingSuggestion {
  index: number
  column: string
  field: string | null
  label: string | null
  confidence: number
  alternatives: { field: string; label: string }[]
  /** True when the UI must make the user confirm or override before proceeding. */
  needsConfirmation: boolean
}

export interface ImportFieldDef {
  key: string
  label: string
  required: boolean
  sensitive: boolean
}

export interface UploadImportResult {
  job: ImportJob
  sheet: {
    sheetName: string
    availableSheets: string[]
    headers: string[]
    totalRows: number
  }
  mapping: MappingSuggestion[]
  fields: ImportFieldDef[]
  /** First rows, with any PII column already masked server-side. */
  sample: { rowNumber: number; values: string[] }[]
}

export interface PreviewRowIssue {
  severity: 'ERROR' | 'WARNING'
  field: string | null
  column: string | null
  code: string
  message: string
  currentValue: string | null
  suggestion: string | null
}

export interface PreviewRow {
  rowNumber: number
  outcome: ImportRowOutcome
  apartmentId: string | null
  apartmentLabel: string | null
  imported: {
    name: string
    phone: string | null
    email: string | null
    hasNationalId: boolean
    share: string | null
  }
  match: {
    entityId: string
    reason: string
    ambiguous: boolean
    candidateCount: number
    existing: { name: string; phone: string | null; email: string | null } | null
    recommendedAction: string
  } | null
  issues: PreviewRowIssue[]
}

export interface PreviewCounts {
  total: number
  create: number
  update: number
  skipped: number
  needsReview: number
  invalid: number
  warnings: number
}

export interface PreviewResult {
  jobId: string
  status: ImportJobStatus
  mode: ImportMode
  entityType: ImportEntityType
  totalRows: number
  counts: PreviewCounts
  page: number
  pageSize: number
  rows: PreviewRow[]
}

export const importKeys = {
  all: () => ['imports'] as const,
  lists: () => [...importKeys.all(), 'list'] as const,
  list: (f: object) => [...importKeys.lists(), f] as const,
  detail: (id: string) => [...importKeys.all(), 'detail', id] as const,
  issues: (id: string) => [...importKeys.all(), 'issues', id] as const,
  review: (id: string) => [...importKeys.all(), 'review', id] as const,
}

export function useImportHistory(params: { projectId?: string } = {}) {
  const q = new URLSearchParams()
  if (params.projectId) q.set('projectId', params.projectId)
  return useQuery({
    queryKey: importKeys.list(params),
    queryFn: () => api.get<ImportJob[]>(`/imports?${q.toString()}`),
    staleTime: 15_000,
  })
}

export function useImportJob(id: string | null) {
  return useQuery({
    queryKey: importKeys.detail(id ?? ''),
    queryFn: () => api.get<ImportJob>(`/imports/${id}`),
    enabled: Boolean(id),
  })
}

export interface StartImportInput {
  file: File
  projectId: string
  entityType: ImportEntityType
  mode: ImportMode
}

/** Step 1 — multipart upload. `onProgress` drives the real byte-level bar. */
export function useStartImport(onProgress?: (p: number | null) => void) {
  return useMutation({
    mutationFn: (input: StartImportInput) => {
      const form = new FormData()
      form.append('file', input.file, input.file.name)
      form.append('projectId', input.projectId)
      form.append('entityType', input.entityType)
      form.append('mode', input.mode)
      return upload<UploadImportResult>('/imports/upload', form, onProgress)
    },
  })
}

/** Step 2 — confirm the column mapping. */
export function useConfirmMapping() {
  return useMutation({
    mutationFn: (input: {
      jobId: string
      mapping: { field: string; index: number }[]
      mode?: ImportMode
    }) =>
      api.post<ImportJob>(`/imports/${input.jobId}/mapping`, {
        mapping: input.mapping,
        ...(input.mode ? { mode: input.mode } : {}),
      }),
  })
}

/**
 * Step 3 — validate and preview.
 *
 * A mutation rather than a query: it re-validates against live data and
 * persists the resulting issue rows, so it must not be replayed by a cache
 * refetch or a window refocus.
 */
export function usePreviewImport() {
  return useMutation({
    mutationFn: (input: { jobId: string; page?: number; pageSize?: number }) => {
      const q = new URLSearchParams()
      if (input.page) q.set('page', String(input.page))
      if (input.pageSize) q.set('pageSize', String(input.pageSize))
      return api.post<PreviewResult>(`/imports/${input.jobId}/preview?${q.toString()}`)
    },
  })
}

/** Step 4 — commit, in one transaction. */
export function useCommitImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { jobId: string; mode?: ImportMode }) =>
      api.post<{ job: ImportJob; counts: PreviewCounts }>(
        `/imports/${input.jobId}/commit`,
        input.mode ? { mode: input.mode } : {},
      ),
    onSuccess: () => {
      // Owners, residents and the project's own counters may all have moved.
      qc.invalidateQueries({ queryKey: importKeys.all() })
      qc.invalidateQueries({ queryKey: ['owners'] })
      qc.invalidateQueries({ queryKey: ['residents'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// ── Ambiguous-duplicate resolution queue ────────────────────────────────────

export type ImportDecisionAction = 'UPDATE_EXISTING' | 'CREATE_NEW' | 'SKIP'

export interface ReviewCandidate {
  entityId: string
  name: string | null
  phone: string | null
  email: string | null
  isActive: boolean | null
}

export interface ReviewRow {
  rowNumber: number
  apartmentLabel: string | null
  matchReason: string
  imported: {
    name: string
    phone: string | null
    email: string | null
    hasNationalId: boolean
    share: string | null
  }
  candidates: ReviewCandidate[]
  decision: { action: ImportDecisionAction; targetEntityId: string | null } | null
}

export interface ReviewQueue {
  jobId: string
  entityType: ImportEntityType
  mode: ImportMode
  totalAmbiguous: number
  undecided: number
  rows: ReviewRow[]
}

/**
 * The rows awaiting a duplicate ruling.
 *
 * A query, not a mutation: the endpoint persists nothing. It re-validates in
 * memory so the candidate list reflects live data — which is also why the
 * result is not cached for long, and is invalidated after every ruling.
 */
export function useImportReview(jobId: string | null, enabled = true) {
  return useQuery({
    queryKey: importKeys.review(jobId ?? ''),
    queryFn: () => api.get<ReviewQueue>(`/imports/${jobId}/review`),
    enabled: Boolean(jobId) && enabled,
    staleTime: 0,
  })
}

/**
 * Record per-row rulings.
 *
 * Writes no owner or resident data — the rulings are applied at the next
 * preview/commit and re-checked against live candidates there, so a target that
 * has since stopped matching fails its row rather than being written to.
 */
export function useResolveImportReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      jobId: string
      decisions: {
        rowNumber: number
        action: ImportDecisionAction
        targetEntityId?: string
        note?: string
      }[]
    }) => api.post<ReviewQueue>(`/imports/${input.jobId}/review`, { decisions: input.decisions }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: importKeys.review(v.jobId) }),
  })
}

/** Undo one ruling, returning the row to the queue. */
export function useClearImportDecision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { jobId: string; rowNumber: number }) =>
      api.delete<ReviewQueue>(`/imports/${input.jobId}/review/${input.rowNumber}`),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: importKeys.review(v.jobId) }),
  })
}

export function useCancelImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) => api.post<ImportJob>(`/imports/${jobId}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: importKeys.all() }),
  })
}

/**
 * Downloads the error report.
 *
 * Fetched through the proxy (so the httpOnly cookie is attached) and turned
 * into an object URL, rather than pointing an `<a href>` at the API — a plain
 * link would be a cross-origin GET with no credentials and would 401.
 */
export async function downloadErrorReport(jobId: string, fileName: string): Promise<void> {
  const res = await fetch(`/api/proxy/imports/${jobId}/errors.csv`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('הורדת דוח השגיאות נכשלה')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick — revoking synchronously can cancel the download
  // in some browsers before it has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
