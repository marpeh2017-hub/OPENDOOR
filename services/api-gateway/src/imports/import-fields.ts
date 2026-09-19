import { ImportEntityType } from '@prisma/client'

/**
 * The catalogue of importable fields, and the header-matching dictionary.
 *
 * This file is DATA, not rules. Every field here maps onto a property the
 * manual CRUD DTOs already accept (`CreateOwnerDto`, `CreateResidentDto`) —
 * import cannot introduce a field that manual entry does not have, because it
 * has to hand the value to the same service.
 */

export type ImportFieldKey =
  // Owner identity
  | 'fullName'
  // Resident identity
  | 'firstName' | 'lastName'
  // Shared identity / contact
  | 'nationalId' | 'phone' | 'phone2' | 'email' | 'notes'
  // Owner-only
  | 'addressAbroad' | 'isEstate'
  // Placement
  | 'buildingAddress' | 'apartmentNumber'
  // Ownership (owner import only)
  | 'share' | 'viaInheritance'

export interface ImportFieldDef {
  key: ImportFieldKey
  /** Hebrew label shown in the mapping UI. */
  label: string
  /** A row missing this cannot be imported at all. */
  required: boolean
  /** True where the value is PII and must be masked in previews and reports. */
  sensitive?: boolean
  /**
   * Header spellings we recognise. Matched after `normaliseHeader`, so these
   * are written in their normalised form (lower-cased, punctuation stripped).
   */
  aliases: string[]
}

/**
 * Header aliases.
 *
 * Hebrew first — that is what real tabu extracts and מנהלי פרויקט spreadsheets
 * actually contain. English variants follow for sheets produced by a developer
 * or exported from another system. Note that `normaliseHeader` strips dots and
 * quotes, so `ת.ז.`, `ת"ז` and `תז` all arrive here as `תז` and only the one
 * entry is needed.
 */
const OWNER_FIELDS: ImportFieldDef[] = [
  {
    key: 'fullName', label: 'שם מלא', required: true,
    aliases: [
      'שם', 'שם מלא', 'שם בעלים', 'שם הבעלים', 'שם בעל הדירה', 'שם הבעל',
      'בעלים', 'בעל הזכויות', 'שם בעל זכויות', 'שם רשום', 'שם הרשום בטאבו',
      'name', 'full name', 'fullname', 'owner', 'owner name', 'ownername',
      'registered owner',
    ],
  },
  {
    key: 'nationalId', label: 'תעודת זהות', required: false, sensitive: true,
    aliases: [
      'תז', 'תעודת זהות', 'מספר זהות', 'מס זהות', 'זהות', 'מזהה',
      'ת ז', 'מספר תז', 'מס תז', 'תעודת הזהות',
      'id', 'national id', 'nationalid', 'id number', 'idnumber',
      'identity', 'identity number', 'passport',
    ],
  },
  {
    key: 'phone', label: 'טלפון', required: false,
    aliases: [
      'טלפון', 'נייד', 'טלפון נייד', 'סלולרי', 'מספר טלפון', 'טל', 'פלאפון',
      'טלפון ראשי', 'phone', 'mobile', 'cell', 'cellphone', 'telephone',
      'phone number', 'phonenumber', 'tel',
    ],
  },
  {
    key: 'phone2', label: 'טלפון נוסף', required: false,
    aliases: [
      'טלפון 2', 'טלפון נוסף', 'טלפון שני', 'טלפון בית', 'נייד 2',
      'phone 2', 'phone2', 'secondary phone', 'alternate phone', 'home phone',
    ],
  },
  {
    key: 'email', label: 'דואר אלקטרוני', required: false,
    aliases: [
      'אימייל', 'מייל', 'דואר אלקטרוני', 'דוא ל', 'דואל', 'כתובת מייל',
      'email', 'e mail', 'mail', 'email address', 'emailaddress',
    ],
  },
  {
    key: 'buildingAddress', label: 'כתובת / בניין', required: false,
    aliases: [
      'כתובת', 'בניין', 'כתובת בניין', 'רחוב', 'מבנה', 'כתובת הבניין',
      'שם הבניין', 'address', 'building', 'street', 'building address',
    ],
  },
  {
    key: 'apartmentNumber', label: 'מספר דירה', required: true,
    aliases: [
      'דירה', 'מספר דירה', 'מס דירה', 'מספר הדירה', 'דירה מספר', 'יחידה',
      'מספר יחידה', 'apartment', 'apt', 'apartment number', 'apartmentnumber',
      'unit', 'unit number', 'flat',
    ],
  },
  {
    key: 'share', label: 'חלק בבעלות', required: false,
    aliases: [
      'אחוז בעלות', 'אחוזי בעלות', 'חלק', 'חלק בבעלות', 'חלקים', 'שיעור בעלות',
      'אחוז', 'בעלות', 'חלק ברכוש', 'שיעור', 'חלק יחסי',
      'share', 'ownership', 'ownership share', 'ownership percentage',
      'percent', 'percentage', 'ownershippercentage', 'fraction', 'portion',
    ],
  },
  {
    key: 'viaInheritance', label: 'בירושה', required: false,
    aliases: [
      'ירושה', 'בירושה', 'התקבל בירושה', 'יורש',
      'inheritance', 'via inheritance', 'inherited', 'heir',
    ],
  },
  {
    key: 'isEstate', label: 'עיזבון', required: false,
    aliases: ['עיזבון', 'עזבון', 'עיזבון לא מוסדר', 'estate', 'is estate'],
  },
  {
    key: 'addressAbroad', label: 'כתובת בחו״ל', required: false,
    aliases: [
      'כתובת בחו ל', 'כתובת בחול', 'חו ל', 'מען בחו ל', 'כתובת למשלוח',
      'address abroad', 'foreign address', 'mailing address',
    ],
  },
  {
    key: 'notes', label: 'הערות', required: false,
    aliases: ['הערות', 'הערה', 'notes', 'note', 'comments', 'remarks'],
  },
]

const RESIDENT_FIELDS: ImportFieldDef[] = [
  {
    key: 'firstName', label: 'שם פרטי', required: true,
    aliases: [
      'שם פרטי', 'פרטי', 'first name', 'firstname', 'given name',
      // A sheet with a single "שם" column is handled by the splitter in the
      // validator; we still recognise it here so the mapping UI can offer it.
      'שם', 'name',
    ],
  },
  {
    key: 'lastName', label: 'שם משפחה', required: true,
    aliases: [
      'שם משפחה', 'משפחה', 'last name', 'lastname', 'surname', 'family name',
    ],
  },
  { key: 'nationalId', label: 'תעודת זהות', required: false, sensitive: true, aliases: OWNER_FIELDS.find(f => f.key === 'nationalId')!.aliases },
  { key: 'phone',  label: 'טלפון',            required: false, aliases: OWNER_FIELDS.find(f => f.key === 'phone')!.aliases },
  { key: 'phone2', label: 'טלפון נוסף',       required: false, aliases: OWNER_FIELDS.find(f => f.key === 'phone2')!.aliases },
  { key: 'email',  label: 'דואר אלקטרוני',    required: false, aliases: OWNER_FIELDS.find(f => f.key === 'email')!.aliases },
  { key: 'buildingAddress',  label: 'כתובת / בניין', required: false, aliases: OWNER_FIELDS.find(f => f.key === 'buildingAddress')!.aliases },
  { key: 'apartmentNumber',  label: 'מספר דירה',     required: true,  aliases: OWNER_FIELDS.find(f => f.key === 'apartmentNumber')!.aliases },
  { key: 'notes',  label: 'הערות',            required: false, aliases: OWNER_FIELDS.find(f => f.key === 'notes')!.aliases },
]

export function fieldsFor(entityType: ImportEntityType): ImportFieldDef[] {
  return entityType === ImportEntityType.RESIDENT ? RESIDENT_FIELDS : OWNER_FIELDS
}

export function fieldDef(
  entityType: ImportEntityType,
  key: ImportFieldKey,
): ImportFieldDef | undefined {
  return fieldsFor(entityType).find((f) => f.key === key)
}

/** True when the field must be masked wherever it is displayed. */
export function isSensitiveField(key: string): boolean {
  return key === 'nationalId'
}

// ─── Header matching ────────────────────────────────────────────────────────

/**
 * Canonicalises a sheet header for comparison.
 *
 * Real headers arrive as `"  ת.ז.  "`, `"ת\"ז"`, `"Owner_Name"`, `"שם בעלים *"`.
 * We lower-case, strip the Hebrew niqqud range, replace every run of
 * punctuation/underscore/whitespace with a single space, and trim. Hebrew
 * letters and ASCII letters/digits survive; everything else becomes a
 * separator, so `ת.ז.` and `ת"ז` both collapse to `תז`.
 */
export function normaliseHeader(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')          // Hebrew points/cantillation
    .replace(/[^0-9a-zא-ת]+/g, ' ') // anything else is a separator
    .trim()
    .replace(/\s+/g, ' ')
}

export interface MappingSuggestion {
  field: ImportFieldKey
  /** Index of the sheet column (0-based). */
  index: number
  /** The header text exactly as it appeared. */
  column: string
  /**
   * `1` exact alias hit, `0.8` alias-contains, `0.6` token overlap.
   * Anything below `AMBIGUOUS_BELOW` must be confirmed by the user before the
   * job can leave the mapping step.
   */
  confidence: number
  /**
   * Other fields this header also plausibly matched. Non-empty means the
   * suggestion is a guess between real alternatives and the UI must say so.
   */
  alternatives: ImportFieldKey[]
}

/**
 * Below this, a suggestion is offered but the mapping step will not accept the
 * job until the user has explicitly confirmed or overridden it. This is the
 * mechanism behind "never silently map an ambiguous column".
 */
export const AMBIGUOUS_BELOW = 1

/**
 * Proposes a field for every column.
 *
 * Deliberately conservative:
 *   - Only an EXACT normalised alias hit scores 1. `"שם בעלים"` → `fullName`.
 *   - A header that CONTAINS an alias as a whole word scores 0.8
 *     (`"טלפון של הבעלים"` → `phone`).
 *   - Shared tokens score 0.6, capped, and always carry `alternatives`.
 *   - A column matching nothing is returned with no suggestion at all rather
 *     than being force-fitted to the nearest field.
 *   - When two columns both claim one field, the higher-confidence column keeps
 *     it and the other is downgraded to a suggestion with alternatives — never
 *     silently dropped.
 */
export function suggestMapping(
  headers: readonly string[],
  entityType: ImportEntityType,
): (MappingSuggestion | { index: number; column: string; field: null })[] {
  const defs = fieldsFor(entityType)

  const scored = headers.map((raw, index) => {
    const h = normaliseHeader(raw)
    const candidates: { field: ImportFieldKey; confidence: number }[] = []

    if (h) {
      for (const def of defs) {
        let best = 0
        for (const alias of def.aliases) {
          const a = normaliseHeader(alias)
          if (!a) continue
          if (h === a) { best = Math.max(best, 1); continue }
          // Whole-word containment, either direction.
          if (wordContains(h, a) || wordContains(a, h)) { best = Math.max(best, 0.8); continue }
          const overlap = tokenOverlap(h, a)
          if (overlap > 0) best = Math.max(best, Math.min(0.6, overlap))
        }
        if (best > 0) candidates.push({ field: def.key, confidence: best })
      }
    }

    candidates.sort((a, b) => b.confidence - a.confidence)
    return { index, column: raw, candidates }
  })

  // Resolve competition for the same field: highest confidence wins the field,
  // the loser keeps it only as an alternative.
  const claimed = new Map<ImportFieldKey, { index: number; confidence: number }>()
  for (const s of scored) {
    const top = s.candidates[0]
    if (!top) continue
    const held = claimed.get(top.field)
    if (!held || top.confidence > held.confidence) {
      claimed.set(top.field, { index: s.index, confidence: top.confidence })
    }
  }

  return scored.map((s) => {
    const viable = s.candidates.filter((c) => {
      const held = claimed.get(c.field)
      return !held || held.index === s.index
    })
    const top = viable[0]
    if (!top) return { index: s.index, column: s.column, field: null }

    const alternatives = s.candidates
      .filter((c) => c.field !== top.field && c.confidence >= 0.5)
      .map((c) => c.field)

    return {
      field: top.field,
      index: s.index,
      column: s.column,
      // A header that also plausibly means something else is never fully
      // confident, however well it matched.
      confidence: alternatives.length ? Math.min(top.confidence, 0.8) : top.confidence,
      alternatives,
    }
  })
}

/** True when `needle` appears in `haystack` on whole-word boundaries. */
function wordContains(haystack: string, needle: string): boolean {
  if (needle.length < 2) return false
  const hw = haystack.split(' ')
  const nw = needle.split(' ')
  if (nw.length > hw.length) return false
  for (let i = 0; i + nw.length <= hw.length; i++) {
    if (nw.every((w, j) => hw[i + j] === w)) return true
  }
  return false
}

/** Jaccard overlap of the two headers' word sets. */
function tokenOverlap(a: string, b: string): number {
  const A = new Set(a.split(' ').filter((w) => w.length > 1))
  const B = new Set(b.split(' ').filter((w) => w.length > 1))
  if (!A.size || !B.size) return 0
  let shared = 0
  for (const w of A) if (B.has(w)) shared++
  if (!shared) return 0
  return shared / new Set([...A, ...B]).size
}
