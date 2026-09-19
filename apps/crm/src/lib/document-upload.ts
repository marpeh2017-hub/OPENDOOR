/**
 * CLIENT-SIDE MIRROR of the upload policy enforced by the API Gateway in
 * `services/api-gateway/src/documents/document-upload.constants.ts`.
 *
 * This exists only so the user gets an instant Hebrew error instead of waiting
 * for a round-trip and, for oversize files, instead of uploading megabytes that
 * are going to be rejected. It is NOT the enforcement point — a client that
 * skips these checks still gets a 400/413 from the server.
 *
 * Keep the two lists in sync; the e2e tests assert the server side.
 */

/**
 * Mirrors MAX_DOCUMENT_BYTES on the API, which reads `MAX_DOCUMENT_BYTES` from
 * its own environment. This copy reads the NEXT_PUBLIC_ twin because only
 * NEXT_PUBLIC_ variables are inlined into browser code — a deployment that
 * raises the server limit (for CAD drawings, say) must set BOTH, or the client
 * will keep rejecting large files the server would have accepted. Getting it
 * wrong is fail-safe in the annoying direction, never the unsafe one: the
 * server limit is the enforcement point regardless of what this says.
 */
export const MAX_DOCUMENT_BYTES = Number(
  process.env.NEXT_PUBLIC_MAX_DOCUMENT_BYTES ?? 100 * 1024 * 1024,
)

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  // CAD. Browsers are inconsistent about what they report for .dwg/.dxf —
  // often an empty string — which is why `validateDocumentFile` falls back to
  // the extension below rather than rejecting on `file.type` alone.
  'image/vnd.dwg',
  'application/acad',
  'image/x-dwg',
  'application/x-dwg',
  'application/dwg',
  'image/vnd.dxf',
  'application/dxf',
  'image/x-dxf',
  'application/x-dxf',
  'drawing/x-dxf',
] as const

/** Extensions accepted by the server registry, lower-case with the dot. */
export const ALLOWED_DOCUMENT_EXTENSIONS: readonly string[] = [
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif',
  '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.dwg', '.dxf',
]

/** `accept` attribute for the file input — extensions included because some
 *  browsers report an empty or generic MIME type for Office files. */
export const DOCUMENT_ACCEPT_ATTR =
  '.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv,.txt,.dwg,.dxf,' +
  ALLOWED_DOCUMENT_MIME_TYPES.join(',')

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

/** Returns a Hebrew error message, or null when the file is acceptable. */
export function validateDocumentFile(file: File): string | null {
  if (file.size === 0) return 'הקובץ ריק'
  if (file.size > MAX_DOCUMENT_BYTES) {
    return `הקובץ גדול מדי (${formatBytes(file.size)}) — הגודל המרבי הוא ${
      Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))
    } מגה-בייט`
  }
  // Extension fallback: browsers commonly report `''` (and occasionally
  // `application/octet-stream`) for .dwg/.dxf, so a MIME-only check would
  // reject valid CAD files before they ever reach the server. Accepting on
  // extension here is safe because this file is not an enforcement point — the
  // server re-derives the type from the actual bytes and rejects a mismatch.
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  const mimeOk = (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)
  const extOk = ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)
  if (!mimeOk && !extOk) {
    return 'סוג הקובץ אינו נתמך. ניתן להעלות PDF, תמונות, Word, Excel, CSV, טקסט או שרטוטי CAD‏ (DWG/DXF)'
  }
  // NOTE: the server ALSO validates the file's actual byte signature, which the
  // browser cannot do without reading the file. A file that passes here can
  // still be rejected with "תוכן הקובץ אינו תואם את סוג הקובץ שהוצהר" — that is
  // the disguised-file check doing its job, not a bug in this mirror.
  return null
}
