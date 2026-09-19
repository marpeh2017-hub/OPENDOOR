/**
 * Upload policy for the Excel import endpoint.
 *
 * WHY A SEPARATE POLICY FROM `document-upload.constants.ts`
 * ---------------------------------------------------------
 * The document library deliberately accepts a broad set of types (PDF, images,
 * Word, CSV, plain text) because it is a filing cabinet. The import endpoint is
 * not a filing cabinet — it hands the bytes to a parser. Its allow-list is
 * therefore as narrow as the parser: two spreadsheet formats and nothing else.
 * Reusing the document list here would let a `.docx` reach the workbook parser.
 *
 * The structure, the sanitiser and the Hebrew error strings follow the document
 * module's established pattern so both endpoints behave identically from the
 * CRM's point of view.
 */

/**
 * 25 MB, matching `MAX_DOCUMENT_BYTES`, and overridable per deployment.
 *
 * A 5,000-row owner sheet is roughly 300 KB, so this is generous by two orders
 * of magnitude; the cap exists to stop a decompression bomb reaching exceljs,
 * not to constrain legitimate sheets.
 */
export const MAX_IMPORT_BYTES = Number(process.env.MAX_IMPORT_BYTES ?? 25 * 1024 * 1024)

/**
 * Hard ceiling on rows accepted from one workbook.
 *
 * Validation holds every row in memory to produce the preview, so this bounds
 * the request's memory rather than the file's size. 20,000 rows is far beyond
 * any real פינוי-בינוי project (the largest are a few hundred apartments).
 */
export const MAX_IMPORT_ROWS = Number(process.env.MAX_IMPORT_ROWS ?? 20_000)

/**
 * Accepted MIME types. Deny-by-default.
 *
 * `.xlsm` (`...sheet.macroEnabled.12`) is DELIBERATELY ABSENT. A macro-enabled
 * workbook has no legitimate use as an import source, and accepting one would
 * mean storing an executable payload in the bucket under a filename staff are
 * later encouraged to download from the history view.
 *
 * `application/octet-stream` is included because several browsers and Windows
 * configurations send it for `.xlsx`; the extension check below still applies,
 * and so does the ZIP magic-number check in the parser, so this is not a hole.
 */
export const ALLOWED_IMPORT_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                          // .xls (legacy senders)
  'application/octet-stream',
] as const

/** Extension allow-list, checked in addition to the MIME type. */
export const ALLOWED_IMPORT_EXTENSIONS = ['.xlsx'] as const

/**
 * Extensions refused with a SPECIFIC message rather than the generic one, so a
 * user who exported a macro workbook is told what to do instead of guessing.
 */
export const REFUSED_IMPORT_EXTENSIONS: Record<string, string> = {
  '.xlsm': 'קבצי אקסל עם פקודות מאקרו (xlsm.) אינם נתמכים מטעמי אבטחה. שמרו את הקובץ כ-xlsx. ונסו שוב',
  '.xlsb': 'פורמט xlsb. אינו נתמך. שמרו את הקובץ כ-xlsx. ונסו שוב',
  '.xls':  'פורמט xls. הישן אינו נתמך. שמרו את הקובץ כ-xlsx. ונסו שוב',
  '.csv':  'קובצי CSV אינם נתמכים בייבוא זה. שמרו את הקובץ כ-xlsx. ונסו שוב',
}

/** Hebrew, user-facing — the CRM surfaces these verbatim. */
export const IMPORT_ERRORS = {
  missingFile: 'לא נבחר קובץ',
  tooLarge:    `הקובץ גדול מדי — הגודל המרבי הוא ${Math.round(MAX_IMPORT_BYTES / (1024 * 1024))} מגה-בייט`,
  badType:     'ניתן להעלות קובץ אקסל בפורמט xlsx. בלבד',
  emptyFile:   'הקובץ ריק',
  notAZip:     'הקובץ אינו קובץ אקסל תקין (xlsx.)',
  noSheets:    'לא נמצא גיליון בקובץ',
  noRows:      'לא נמצאו שורות נתונים בגיליון',
  noHeaders:   'לא נמצאה שורת כותרות בגיליון',
  tooManyRows: `הקובץ מכיל יותר מ-${MAX_IMPORT_ROWS} שורות`,
  corrupt:     'לא ניתן לקרוא את הקובץ. ודאו שמדובר בקובץ אקסל תקין',
} as const

/**
 * The first four bytes of every `.xlsx` (it is a ZIP container).
 *
 * Checked before the buffer reaches exceljs so a file that merely CLAIMS to be
 * a spreadsheet is rejected by us, with a Hebrew message, rather than by the
 * parser's own error path.
 */
export const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]) // "PK\x03\x04"

export function looksLikeXlsx(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(XLSX_MAGIC)
}

/** Lower-cased extension including the dot, or `''`. */
export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  return i === -1 ? '' : fileName.slice(i).toLowerCase()
}

/**
 * Strip any path component and anything that could confuse a storage key.
 * Mirrors `sanitizeFileName` in the documents module — `StorageService.upload`
 * interpolates the name into the S3 key, so `../` must never reach it.
 */
export function sanitizeImportFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'import.xlsx'
  const safe = base.replace(/[^\w.\-֐-׿ ]+/g, '_').replace(/^\.+/, '').trim()
  return (safe || 'import.xlsx').slice(0, 120)
}
