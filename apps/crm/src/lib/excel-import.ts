/**
 * Client-side mirror of the import upload policy.
 *
 * `services/api-gateway/src/imports/excel-import.constants.ts` is the
 * ENFORCEMENT point — everything here exists only so the user gets an instant
 * Hebrew error instead of a round-trip. A client that skips these checks still
 * gets a 400 or a 413 from the API, and the server additionally verifies the
 * file's ZIP magic number, which a browser cannot do before upload.
 */

/** Keep in step with `MAX_IMPORT_BYTES` (25 MB default). */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024

export const IMPORT_ACCEPT_ATTR =
  '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Extensions we refuse with a specific message. Mirrors
 * `REFUSED_IMPORT_EXTENSIONS`; `.xlsm` is refused for security (macros), not
 * for convenience, so the wording says so.
 */
const REFUSED: Record<string, string> = {
  '.xlsm': 'קבצי אקסל עם פקודות מאקרו (xlsm.) אינם נתמכים מטעמי אבטחה. שמרו את הקובץ כ-xlsx. ונסו שוב',
  '.xlsb': 'פורמט xlsb. אינו נתמך. שמרו את הקובץ כ-xlsx. ונסו שוב',
  '.xls':  'פורמט xls. הישן אינו נתמך. שמרו את הקובץ כ-xlsx. ונסו שוב',
  '.csv':  'קובצי CSV אינם נתמכים בייבוא זה. שמרו את הקובץ כ-xlsx. ונסו שוב',
}

export function validateImportFile(file: File): string | null {
  if (file.size === 0) return 'הקובץ ריק'
  if (file.size > MAX_IMPORT_BYTES) {
    return `הקובץ גדול מדי — הגודל המרבי הוא ${Math.round(MAX_IMPORT_BYTES / (1024 * 1024))} מגה-בייט`
  }
  const dot = file.name.lastIndexOf('.')
  const ext = dot === -1 ? '' : file.name.slice(dot).toLowerCase()
  if (REFUSED[ext]) return REFUSED[ext]
  if (ext !== '.xlsx') return 'ניתן להעלות קובץ אקסל בפורמט xlsx. בלבד'
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export const ENTITY_LABELS: Record<string, string> = {
  OWNER: 'בעלים',
  RESIDENT: 'דיירים',
}

export const MODE_LABELS: Record<string, string> = {
  ADD_ONLY: 'הוספה בלבד',
  UPDATE_ONLY: 'עדכון בלבד',
  ADD_AND_UPDATE: 'הוספה ועדכון',
}

export const MODE_HINTS: Record<string, string> = {
  ADD_ONLY: 'רשומות שכבר קיימות ידולגו ולא ישונו.',
  UPDATE_ONLY: 'רק רשומות קיימות יעודכנו; שורות חדשות ידולגו.',
  ADD_AND_UPDATE: 'רשומות חדשות ייווצרו, רשומות קיימות יעודכנו.',
}

export const STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'הועלה',
  MAPPED: 'מופה',
  PREVIEWED: 'תצוגה מקדימה',
  IMPORTING: 'בייבוא',
  COMPLETED: 'הושלם',
  FAILED: 'נכשל',
  CANCELLED: 'בוטל',
}

export const OUTCOME_LABELS: Record<string, string> = {
  CREATE: 'יצירה',
  UPDATE: 'עדכון',
  SKIP_DUPLICATE: 'דילוג — כפילות',
  SKIP_MODE: 'דילוג — מצב ייבוא',
  INVALID: 'שגיאה',
  NEEDS_REVIEW: 'דורש בדיקה',
}

export const OUTCOME_TONE: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-sky-50 text-sky-700 border-sky-200',
  SKIP_DUPLICATE: 'bg-muted text-muted-foreground border-border',
  SKIP_MODE: 'bg-muted text-muted-foreground border-border',
  INVALID: 'bg-red-50 text-red-700 border-red-200',
  NEEDS_REVIEW: 'bg-amber-50 text-amber-800 border-amber-200',
}

/**
 * The three rulings available on an ambiguous duplicate.
 *
 * There is deliberately no "merge" option — the API has no such action. Two
 * existing records are never combined; the sheet row either updates ONE named
 * record, becomes a second separate record, or is left out entirely.
 */
export const DECISION_LABELS: Record<string, string> = {
  UPDATE_EXISTING: 'עדכון הרשומה הקיימת',
  CREATE_NEW: 'יצירת רשומה חדשה ונפרדת',
  SKIP: 'דילוג — לא לייבא',
}

export const DECISION_HINTS: Record<string, string> = {
  UPDATE_EXISTING: 'הנתונים מהגיליון יוחלו על הרשומה שתבחרו. שאר המועמדים לא ישתנו.',
  CREATE_NEW: 'תיווצר רשומה נוספת. אף אחת מהרשומות הקיימות לא תשתנה.',
  SKIP: 'השורה לא תיובא כלל, ואף רשומה קיימת לא תשתנה.',
}

export const MATCH_REASON_LABELS: Record<string, string> = {
  NATIONAL_ID: 'לפי תעודת זהות',
  OWNER_ID: 'לפי מזהה',
  PHONE: 'לפי טלפון',
  NAME_AND_APARTMENT: 'לפי שם ודירה',
}
