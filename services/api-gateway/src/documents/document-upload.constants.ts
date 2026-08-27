/**
 * Upload policy for POST /documents/upload and POST /documents/:id/versions.
 *
 * These are the SERVER-side limits — they are the enforcement point. The CRM
 * mirrors them in `apps/crm/src/lib/document-upload.ts` purely so the user gets
 * an instant Hebrew error instead of a round-trip; a client that skips the
 * check still gets a 400 from here.
 *
 * WHY THIS IS A REGISTRY AND NOT TWO FLAT ARRAYS
 * ---------------------------------------------
 * The previous shape was a bare list of MIME strings, which had two problems:
 * it trusted the CLIENT-DECLARED `Content-Type` (so an executable renamed to
 * `.pdf` and sent as `application/pdf` passed), and adding a professional
 * format such as DWG/DXF meant editing several disconnected constants plus the
 * error strings. Each accepted format is now ONE entry describing its MIME
 * type, its extensions and its byte signature; adding a format is adding an
 * entry, and everything else — the allow-list, the `accept` attribute, the
 * signature check and the Hebrew error text — is derived from the registry.
 */

/**
 * Maximum document size. Configurable per deployment; 100 MB default.
 *
 * WHY 100 MB
 * ----------
 * The cap exists to bound request memory, not to constrain legitimate
 * documents, and the binding case is CAD. A scanned נסח טאבו is a few hundred
 * KB and a signed PDF set is single-digit MB — those never came close to the
 * old 25 MB ceiling. A typical architectural DWG runs 2–50 MB, and a
 * multi-building פינוי-בינוי set that carries its xrefs (site plan, each
 * building, survey overlays) reaches the high tens of MB. 25 MB rejected real
 * drawings; 100 MB accepts the realistic upper end of that distribution with
 * headroom, while still being far below "arbitrary payload" territory — it is
 * a bound a reviewer can reason about, not an open door.
 *
 * MEMORY COST OF THIS NUMBER — see the two buffering points noted below.
 * A 100 MB upload is buffered ONCE by the CRM's BFF proxy
 * (`apps/crm/src/app/api/proxy/[...path]/route.ts`, `req.arrayBuffer()`) and
 * AGAIN by NestJS multer here, so a single in-flight CAD upload costs roughly
 * 200 MB resident across the two processes. Concurrent CAD uploads multiply
 * that and can exhaust memory. The proper fix is a presigned direct-to-S3
 * upload that bypasses the proxy entirely; it is deliberately not built yet.
 * Deployments that cannot afford the headroom should lower
 * `MAX_DOCUMENT_BYTES` rather than assume this default is free.
 */
export const MAX_DOCUMENT_BYTES = Number(process.env.MAX_DOCUMENT_BYTES ?? 100 * 1024 * 1024)

/**
 * One byte signature ("magic number").
 *
 * `bytes` is compared at `offset`. A `null` entry in `bytes` is a wildcard, for
 * containers whose header has a variable-length field in the middle (RIFF/WEBP
 * carries a 4-byte little-endian size between the two literals).
 */
export interface FileSignature {
  offset: number
  bytes: (number | null)[]
}

/** One accepted file format. */
export interface FileTypeSpec {
  /** Canonical MIME type. */
  mime: string
  /** Additional MIME types browsers are known to send for this format. */
  aliases?: string[]
  /** Lower-case, dot-prefixed. */
  extensions: string[]
  /** Hebrew, for the user-facing "supported types" message. */
  label: string
  /**
   * Accepted signatures; ANY match passes.
   *
   * An EMPTY array means the format genuinely has no magic number — plain text
   * and CSV. Those are validated by `looksLikeText` instead, which is what
   * actually stops a renamed binary, since every real executable image starts
   * with NUL-heavy bytes that are not valid UTF-8 text.
   */
  signatures: FileSignature[]
  /**
   * Content probe for formats whose real structure is textual, so no byte
   * signature can express it. Runs ONLY when no `signatures` entry matched.
   *
   * This is not the same thing as `signatures: []`. An empty signature list
   * means "any plain text is acceptable" (txt, csv). A probe means "this
   * format has a definite structure that happens to be spelled in ASCII, and
   * the file must actually have it" — which is what keeps DXF from degrading
   * into a second `text/plain` slot that accepts any text file at all.
   */
  probe?: (buffer: Buffer) => boolean
}

const ASCII = (s: string): number[] => [...s].map((c) => c.charCodeAt(0))

/**
 * Content probe for ASCII DXF — the one accepted format with no magic number
 * but a real structure.
 *
 * An ASCII DXF is a flat sequence of group-code / value line PAIRS. A
 * well-formed file opens with group code `0` on its own line and `SECTION` on
 * the next. Two things may legitimately precede it:
 *
 *   - leading whitespace, and
 *   - `999` comment records (group code `999`, then an arbitrary comment line),
 *     which some exporters emit as a provenance banner.
 *
 * Group codes are written right-aligned in a 3-character field by AutoCAD
 * itself and flush-left by nearly everything else, so surrounding whitespace is
 * tolerated on the code line. Line endings may be CRLF or LF.
 *
 * The header must appear NEAR THE START: after skipping comments, the
 * `0`/`SECTION` pair has to be the next thing. That is what distinguishes this
 * from "search the file for the word SECTION", which a crafted text file — or
 * an unrelated document that merely contains the word — would satisfy.
 *
 * Only the first 8 KB is decoded, matching `looksLikeText`; a real DXF header
 * is well inside the first few hundred bytes, and a file that needs more than
 * 8 KB to reach it is not one we want to accept.
 */
export function looksLikeDxf(buffer: Buffer): boolean {
  // A DXF that is not text is not an ASCII DXF. This also rejects the
  // NUL-heavy leading bytes of every executable format before any parsing.
  if (!looksLikeText(buffer)) return false

  // latin1 decodes byte-for-byte and never fails, which is what we want for a
  // structural probe — the file's own encoding is irrelevant to the header.
  const head = buffer.subarray(0, Math.min(buffer.length, 8192)).toString('latin1')
  const lines = head.split(/\r\n|\n|\r/)

  let i = 0
  // Skip blank lines and `999` comment records (code line + its value line).
  while (i < lines.length) {
    const code = lines[i].trim()
    if (code === '') { i++; continue }
    if (code === '999') { i += 2; continue } // the comment text line too
    break
  }

  if (i + 1 >= lines.length) return false
  return lines[i].trim() === '0' && lines[i + 1].trim().toUpperCase() === 'SECTION'
}

/** OLE2 compound-file header — legacy .doc and .xls. */
const OLE2: FileSignature = { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }

/**
 * ZIP local file header — .docx and .xlsx are ZIP containers.
 *
 * NOTE, deliberately: this cannot tell a .docx from a .xlsx, because at the
 * byte level in the first four bytes they are the same thing. Both are on the
 * allow-list, so a mislabelled one of the two is a cosmetic wrong-icon problem,
 * not a security one. What the check DOES guarantee is that neither slot can
 * carry an executable, a script or an HTML file.
 */
const ZIP: FileSignature = { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }
/** Empty and spanned ZIP variants, which Office occasionally emits. */
const ZIP_EMPTY: FileSignature = { offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] }
const ZIP_SPANNED: FileSignature = { offset: 0, bytes: [0x50, 0x4b, 0x07, 0x08] }

/**
 * THE REGISTRY. To support a new format, add an entry here — nothing else in
 * the codebase needs to change.
 *
 * DWG and DXF are now ENABLED (they were previously documented-but-absent).
 * Both are validated on their real bytes: DWG on its `AC10xx` version tag,
 * binary DXF on its magic string, and ASCII DXF — which genuinely has no magic
 * number — through the `looksLikeDxf` structural probe rather than through the
 * permissive plain-text path.
 */
export const DOCUMENT_FILE_TYPES: FileTypeSpec[] = [
  {
    mime: 'application/pdf',
    extensions: ['.pdf'],
    label: 'PDF',
    signatures: [{ offset: 0, bytes: ASCII('%PDF-') }],
  },
  {
    mime: 'image/jpeg',
    extensions: ['.jpg', '.jpeg'],
    label: 'JPEG',
    signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  {
    mime: 'image/png',
    extensions: ['.png'],
    label: 'PNG',
    signatures: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  {
    mime: 'image/webp',
    extensions: ['.webp'],
    label: 'WebP',
    // 'RIFF' + 4 size bytes (wildcards) + 'WEBP'.
    signatures: [{
      offset: 0,
      bytes: [...ASCII('RIFF'), null, null, null, null, ...ASCII('WEBP')],
    }],
  },
  {
    mime: 'image/heic',
    aliases: ['image/heif'],
    extensions: ['.heic', '.heif'],
    label: 'HEIC',
    // ISO base media format: 4 length bytes, then 'ftyp', then the brand.
    signatures: [
      { offset: 4, bytes: [...ASCII('ftyp'), ...ASCII('heic')] },
      { offset: 4, bytes: [...ASCII('ftyp'), ...ASCII('heix')] },
      { offset: 4, bytes: [...ASCII('ftyp'), ...ASCII('heim')] },
      { offset: 4, bytes: [...ASCII('ftyp'), ...ASCII('mif1')] },
      { offset: 4, bytes: [...ASCII('ftyp'), ...ASCII('msf1')] },
    ],
  },
  {
    mime: 'application/msword',
    extensions: ['.doc'],
    label: 'Word (doc.)',
    signatures: [OLE2],
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
    label: 'Word (docx.)',
    signatures: [ZIP, ZIP_EMPTY, ZIP_SPANNED],
  },
  {
    mime: 'application/vnd.ms-excel',
    extensions: ['.xls'],
    label: 'Excel (xls.)',
    signatures: [OLE2],
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['.xlsx'],
    label: 'Excel (xlsx.)',
    signatures: [ZIP, ZIP_EMPTY, ZIP_SPANNED],
  },
  {
    // AutoCAD drawing. Every modern release (R11 through 2018+) writes the
    // version tag `AC10xx` — AC1009, AC1012, AC1014, AC1015, AC1018, AC1021,
    // AC1024, AC1027, AC1032 — as the first six ASCII bytes, so matching the
    // shared `AC10` prefix at offset 0 covers all of them with one signature.
    // Pre-R11 files (`AC1.50`, `AC2.10`) are not matched and are not supported;
    // nobody is producing them.
    mime: 'image/vnd.dwg',
    aliases: ['application/acad', 'image/x-dwg', 'application/x-dwg', 'application/dwg'],
    extensions: ['.dwg'],
    label: 'AutoCAD (dwg.)',
    signatures: [{ offset: 0, bytes: ASCII('AC10') }],
  },
  {
    // Drawing eXchange Format. Two on-disk shapes:
    //
    //   Binary DXF — a real magic number, handled as a signature below.
    //   ASCII  DXF — no magic number at all. It is a flat list of
    //                group-code / value line pairs, and a well-formed file
    //                opens with group code `0` whose value is `SECTION`.
    //
    // The ASCII case is why `probe` exists: accepting it via the empty-
    // signature `looksLikeText` path would make `.dxf` a hole through which
    // ANY text file passes. `looksLikeDxf` requires the actual header.
    mime: 'image/vnd.dxf',
    aliases: ['application/dxf', 'image/x-dxf', 'application/x-dxf', 'drawing/x-dxf'],
    extensions: ['.dxf'],
    label: 'AutoCAD (dxf.)',
    signatures: [{ offset: 0, bytes: ASCII('AutoCAD Binary DXF') }],
    probe: looksLikeDxf,
  },
  {
    mime: 'text/csv',
    extensions: ['.csv'],
    label: 'CSV',
    signatures: [], // no magic number — see looksLikeText
  },
  {
    mime: 'text/plain',
    extensions: ['.txt'],
    label: 'טקסט',
    signatures: [], // no magic number — see looksLikeText
  },
]

/**
 * CAD formats are ENABLED — this constant is kept only because it is a public
 * export; the reference it used to hold now lives on the registry entries
 * themselves and on `looksLikeDxf`, next to the code that implements it.
 *
 * MALWARE SCANNING: format validation here establishes "these bytes really are
 * the format they claim to be". It says NOTHING about whether the content is
 * malicious — a DWG carrying an AutoLISP payload, or a macro-bearing .doc,
 * passes every check in this file.
 *
 * That gap is now closed by `MalwareScanService` (see `./malware/`), which the
 * controller calls immediately before storing bytes at BOTH upload sites. It
 * scans through clamd and, in production, fails CLOSED — an unscannable file is
 * refused rather than stored unexamined.
 *
 * The checks in THIS file remain the first gate, and deliberately so: they are
 * synchronous and cheap, and reject obviously wrong input before anything pays
 * for a network round trip to the scanner.
 *
 * Scanning is off by default outside production (MALWARE_SCAN_ENABLED), so a
 * contributor without a clamd container is not blocked. That is announced with
 * a warning on every boot rather than being silent.
 */
export const PROFESSIONAL_FORMATS_NOTE = 'DWG/DXF enabled; see looksLikeDxf'

// ─── Derived lookups ────────────────────────────────────────────────────────

/** Every MIME string the allow-list accepts, canonical names and aliases. */
export const ALLOWED_DOCUMENT_MIME_TYPES: readonly string[] =
  DOCUMENT_FILE_TYPES.flatMap((t) => [t.mime, ...(t.aliases ?? [])])

export const ALLOWED_DOCUMENT_EXTENSIONS: readonly string[] =
  DOCUMENT_FILE_TYPES.flatMap((t) => t.extensions)

/** Human list for the error message, built from the registry so it cannot drift. */
const TYPE_LIST_HE = DOCUMENT_FILE_TYPES.map((t) => t.label).join(', ')

export function specForMime(mime: string): FileTypeSpec | undefined {
  const m = (mime ?? '').toLowerCase().split(';')[0].trim()
  return DOCUMENT_FILE_TYPES.find(
    (t) => t.mime === m || (t.aliases ?? []).includes(m),
  )
}

/** Lower-cased extension including the dot, or `''`. */
export function extensionOf(fileName: string): string {
  const i = (fileName ?? '').lastIndexOf('.')
  return i === -1 ? '' : fileName.slice(i).toLowerCase()
}

// ─── Signature validation ───────────────────────────────────────────────────

function matchesSignature(buffer: Buffer, sig: FileSignature): boolean {
  if (buffer.length < sig.offset + sig.bytes.length) return false
  for (let i = 0; i < sig.bytes.length; i++) {
    const expected = sig.bytes[i]
    if (expected === null) continue // wildcard
    if (buffer[sig.offset + i] !== expected) return false
  }
  return true
}

/**
 * Heuristic for the two formats with no magic number (text/plain, text/csv).
 *
 * A NUL byte or a run of C0 control characters is the reliable tell: every
 * executable format begins with them (`MZ\x90\x00\x00\x00`, ELF's
 * `\x7fELF\x02\x01\x01\x00`, Mach-O's `\xcf\xfa\xed\xfe`), and no genuine text
 * file contains them. Only the first 8 KB is examined — enough to catch a
 * header, cheap on a large CSV.
 */
export function looksLikeText(buffer: Buffer): boolean {
  const window = buffer.subarray(0, Math.min(buffer.length, 8192))
  for (const byte of window) {
    if (byte === 0x00) return false
    // Allow tab (09), LF (0A), CR (0D), FF (0C) and everything from 0x20 up
    // (which includes all UTF-8 continuation bytes).
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d && byte !== 0x0c) {
      return false
    }
  }
  return true
}

export interface SignatureCheckResult {
  ok: boolean
  /** Hebrew, user-facing. Set only when `ok` is false. */
  message?: string
  /** Stable code for tests and logs. */
  code?: string
}

/**
 * Validates the ACTUAL bytes against the declared type.
 *
 * The client-declared MIME type and the filename extension are both treated as
 * claims to be checked, never as facts:
 *
 *   1. the declared MIME must be on the allow-list;
 *   2. the extension, if present, must belong to the SAME registry entry — so
 *      `payload.exe` cannot be sent as `application/pdf`;
 *   3. the leading bytes must match one of that entry's signatures, or, for the
 *      signature-less text formats, must look like text.
 *
 * Step 3 is the one that matters: it is what makes a renamed executable fail
 * even when the client sets every header correctly.
 */
export function validateFileSignature(
  mimetype: string,
  fileName: string,
  buffer: Buffer,
): SignatureCheckResult {
  const spec = specForMime(mimetype)
  if (!spec) {
    return { ok: false, code: 'DOCUMENT_MIME_NOT_ALLOWED', message: UPLOAD_ERRORS.badType }
  }

  const ext = extensionOf(fileName)
  if (ext && !spec.extensions.includes(ext)) {
    // The extension names a different format from the Content-Type. Either the
    // client is confused or the file is disguised; both are refused.
    return {
      ok: false,
      code: 'DOCUMENT_EXTENSION_MISMATCH',
      message: `סיומת הקובץ (${ext}) אינה תואמת את סוג הקובץ שהוצהר. ודאו שהקובץ תקין ונסו שוב`,
    }
  }

  if (spec.signatures.length === 0) {
    if (!looksLikeText(buffer)) {
      return {
        ok: false,
        code: 'DOCUMENT_CONTENT_NOT_TEXT',
        message: 'תוכן הקובץ אינו טקסט תקין. ייתכן שהקובץ פגום או שאינו מהסוג שהוצהר',
      }
    }
    return { ok: true }
  }

  if (!spec.signatures.some((sig) => matchesSignature(buffer, sig))) {
    // No signature matched. A format with a structural `probe` (ASCII DXF) gets
    // one more chance — but it must satisfy that probe, not merely be text.
    if (spec.probe?.(buffer)) return { ok: true }
    return {
      ok: false,
      code: 'DOCUMENT_SIGNATURE_MISMATCH',
      message: `תוכן הקובץ אינו תואם את סוג הקובץ שהוצהר (${spec.label}). ייתכן שהקובץ פגום או ששמו שונה`,
    }
  }

  return { ok: true }
}

/** Hebrew, user-facing — these strings are surfaced verbatim by the CRM. */
export const UPLOAD_ERRORS = {
  missingFile: 'לא נבחר קובץ',
  tooLarge:    `הקובץ גדול מדי — הגודל המרבי הוא ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} מגה-בייט`,
  badType:     `סוג הקובץ אינו נתמך. ניתן להעלות: ${TYPE_LIST_HE}`,
  emptyFile:   'הקובץ ריק',
} as const

/**
 * Strip any path component and anything that could confuse a storage key.
 * `StorageService.upload` interpolates the filename into the S3 key, so a
 * filename containing `../` or a `/` must never reach it.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  const safe = base.replace(/[^\w.\-֐-׿ ]+/g, '_').replace(/^\.+/, '').trim()
  return (safe || 'file').slice(0, 120)
}
