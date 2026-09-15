import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, upload } from '@/lib/api-client'

/**
 * Mirrors DocumentsController.findAll — a bare array of metadata.
 * `s3Key` is deliberately never returned; downloads go through
 * GET /documents/:id/download which issues a short-lived signed URL.
 */
export interface DocumentMeta {
  id:        string
  title:     string
  category:  string
  status:    string
  fileSize:  number | null
  mimeType:  string | null
  projectId: string | null
  version:   number
  /** Root of this document's version chain; null on the root itself. */
  parentId:  string | null
  /** Exactly one row per chain is true. The list shows only these by default. */
  isLatest:  boolean
  createdAt: string
  updatedAt: string
}

/** One entry in a version history, with its uploader. */
export interface DocumentVersion extends DocumentMeta {
  fileName:  string | null
  createdBy?: { id: string; firstName: string; lastName: string }
}

export interface DocumentVersionHistory {
  documentId:    string
  latestVersion: number
  count:         number
  versions:      DocumentVersion[]
}

export const documentKeys = {
  all:      ()           => ['documents'] as const,
  lists:    ()           => [...documentKeys.all(), 'list'] as const,
  list:     (f: object)  => [...documentKeys.lists(), f] as const,
  versions: (id: string) => [...documentKeys.all(), 'versions', id] as const,
}

export function useDocuments(params?: { projectId?: string; category?: string }) {
  const q = new URLSearchParams()
  if (params?.projectId) q.set('projectId', params.projectId)
  if (params?.category)  q.set('category',  params.category)

  return useQuery({
    queryKey: documentKeys.list(params ?? {}),
    queryFn:  () => api.get<DocumentMeta[]>(`/documents?${q.toString()}`),
    staleTime: 30_000,
  })
}

/**
 * Resolve a short-lived (15 min) signed download URL.
 *
 * This is the ONLY way the CRM may reach a file: the storage key (`s3Key`) is
 * never sent to the browser. Called imperatively on click rather than as a
 * query, so no URL is minted until the user actually asks for the file.
 */
export async function fetchDownloadUrl(id: string): Promise<string> {
  const { url } = await api.get<{ url: string; expiresIn: number }>(`/documents/${id}/download`)
  return url
}

export interface UploadDocumentInput {
  file:         File
  title:        string
  category:     string
  /** Required — an uploaded file is always filed under a project. */
  projectId:    string
  status?:      string
  description?: string
}

/**
 * POST /documents/upload (multipart).
 *
 * Note the path has no `api/v1` prefix: the same-origin BFF proxy prepends it.
 * Never call http://localhost:4000 from the browser — the access token is an
 * httpOnly cookie on the CRM origin and would not be sent.
 *
 * `onProgress` gets 0–100 while bytes are in flight, then null while the server
 * stores the object and writes the row. On success the documents list query is
 * invalidated so the new row appears without a manual reload.
 */
export function useUploadDocument(onProgress?: (p: number | null) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => {
      const form = new FormData()
      form.append('file', input.file, input.file.name)
      form.append('title', input.title)
      form.append('category', input.category)
      form.append('projectId', input.projectId)
      if (input.status)      form.append('status', input.status)
      if (input.description) form.append('description', input.description)
      return upload<DocumentMeta>('/documents/upload', form, onProgress)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.lists() }),
  })
}

/**
 * The version chain for a document, newest first.
 *
 * Every entry has its own `id`, so viewing or downloading an earlier version
 * uses the ordinary `fetchDownloadUrl(version.id)` — there is no separate
 * per-version download route and no storage key in any of this.
 */
export function useDocumentVersions(id: string | null) {
  return useQuery({
    queryKey: documentKeys.versions(id ?? ''),
    queryFn:  () => api.get<DocumentVersionHistory>(`/documents/${id}/versions`),
    enabled:  Boolean(id),
  })
}

/**
 * POST /documents/:id/versions (multipart) — upload a replacement.
 *
 * The previous version's bytes are NEVER overwritten: the server gives each
 * version its own storage key, so an earlier נסח טאבו stays downloadable.
 * `projectId` and `category` are inherited server-side and cannot be sent — a
 * new version cannot relocate or re-classify a document.
 */
export function useUploadDocumentVersion(onProgress?: (p: number | null) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      documentId: string
      file: File
      title?: string
      status?: string
      description?: string
    }) => {
      const form = new FormData()
      form.append('file', input.file, input.file.name)
      if (input.title)       form.append('title', input.title)
      if (input.status)      form.append('status', input.status)
      if (input.description) form.append('description', input.description)
      return upload<DocumentMeta>(`/documents/${input.documentId}/versions`, form, onProgress)
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: documentKeys.lists() })
      qc.invalidateQueries({ queryKey: documentKeys.versions(v.documentId) })
    },
  })
}

/**
 * DELETE /documents/:id is MANAGER_ROLES-only — non-managers get a 403.
 *
 * On a multi-version document this deletes only the CURRENT version and
 * promotes the previous one. Deleting a superseded version is refused by the
 * server (400) — version history is preserved.
 */
export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<DocumentMeta>(`/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.lists() })
      // The chain may have shrunk and a previous version promoted.
      qc.invalidateQueries({ queryKey: [...documentKeys.all(), 'versions'] })
    },
  })
}
