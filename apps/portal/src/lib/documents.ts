/**
 * The shape of `GET /api/v1/portal/documents`.
 *
 * Written out rather than inferred, for the same reason as `dashboard.ts`: it
 * is a contract with a service in another package, and a field the gateway
 * renames should break the build here rather than render as `undefined`.
 */

export interface PortalDocument {
  id: string
  title: string
  category: string
  categoryLabel: string
  fileName: string
  mimeType: string
  fileSize: number
  sharedAt: string
  /** Why this resident can see it: attached by staff, or sent to them to sign. */
  sources: ('SHARED' | 'SIGNATURE')[]
  signature: {
    required: boolean
    signed: boolean
    signedAt: string | null
    status: string
  } | null
  downloadable: boolean
}

export interface PortalDocuments {
  counts: {
    total: number
    awaitingSignature: number
    signed: number
  }
  categories: {
    category: string
    label: string
    documents: PortalDocument[]
  }[]
}

/** Bytes as a person would say them. */
export function formatFileSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
