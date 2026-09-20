/**
 * The project document, as the editor sees it.
 *
 * Mirrors `services/api-gateway/src/cms/project-document.ts`. It is a mirror
 * rather than a shared import because the gateway is a CommonJS Nest build and
 * cannot export types into a Next app without a build-integration change that
 * is not worth making for a handful of interfaces.
 *
 * The duplication is bounded and safe in one direction: the gateway's copy is
 * authoritative and enforces the boundary. If this file drifts, the editor
 * shows a field wrong — annoying. The projection would still refuse to publish
 * anything the gateway does not allow, because the gateway never trusts this
 * shape. That asymmetry is why the mirror is acceptable here and would not be
 * acceptable in the other direction.
 */

export interface LocalizedContent {
  he: string
  en?: string
}

export type VerificationStatus =
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'SELF_VERIFIED'
  | 'SECOND_REVIEW_REQUIRED'

export interface ProjectFact<T = unknown> {
  value: T
  verifiedValue?: T
  status: VerificationStatus
  editedByUserId?: string
  editedAt?: string
  verifiedByUserId?: string
  verifiedAt?: string
  sourceId?: string
  sourceReference?: string
  blockedBy?: string[]
}

export interface ProjectMilestone {
  id: string
  title: LocalizedContent
  note?: LocalizedContent
  state: 'completed' | 'current' | 'upcoming'
  order: number
  occurredAt?: string
  periodLabel?: LocalizedContent
  fact?: ProjectFact<boolean>
  hidden?: boolean
}

export type ImageClaim = 'VERIFIED_PROJECT_PHOTO' | 'EDITORIAL_CONTEXT' | 'ARCHITECTURAL_PATTERN'

export interface ProjectMedia {
  id: string
  storageKey: string
  filename: string
  mimeType?: string
  width?: number
  height?: number
  classification: ImageClaim
  alt: LocalizedContent
  caption?: LocalizedContent
  credit?: string
  order: number
  hidden?: boolean
}

export interface ProjectSource {
  id: string
  type: 'FEASIBILITY_WORKBOOK' | 'USER_VERIFIED' | 'TABU' | 'MUNICIPAL_RECORD' | 'SURVEY' | 'OTHER'
  label: string
  reference?: string
  quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
  reviewState: 'UNREVIEWED' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED'
  issues?: string[]
  note?: string
}

export interface DataQualityFlag {
  id: string
  label: string
  detail: string
  severity: 'BLOCKING' | 'WARNING' | 'INFO'
  blocks?: string[]
  resolved?: boolean
}

export interface FeasibilityEntry {
  value: number | string
  unit?: string
  note?: string
  reviewState?: string
}

export interface ProjectDocument {
  public: {
    name: LocalizedContent
    location: {
      city: LocalizedContent
      neighborhood?: LocalizedContent
      street?: LocalizedContent
    }
    summary?: LocalizedContent
    description?: LocalizedContent
    role?: LocalizedContent
    currentStage?: ProjectFact<string>
    facts?: Record<string, ProjectFact>
    cta?: { label: LocalizedContent; href: string }
  }
  internal?: {
    candidateAddresses?: { address: string; note?: string; inWorkbook: boolean }[]
    boundaryNote?: string
    blocks?: { block: string; parcel?: string; note?: string; needsInvestigation?: boolean }[]
    existingConditions?: Record<string, unknown>
    observations?: string[]
    notes?: string
    dataQualityFlags?: DataQualityFlag[]
  }
  feasibility?: {
    sourceData?: Record<string, FeasibilityEntry>
    assumptions?: Record<string, FeasibilityEntry>
    outputs?: Record<string, FeasibilityEntry>
    economics?: Record<string, FeasibilityEntry>
  }
  milestones?: ProjectMilestone[]
  media?: ProjectMedia[]
  seo?: Record<string, { title?: string; description?: string }>
  sources?: ProjectSource[]
}

// ── Vocabulary, in Hebrew, in one place ─────────────────────────────────

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  UNVERIFIED: 'לא מאומת',
  VERIFIED: 'מאומת',
  SELF_VERIFIED: 'מאומת עצמית',
  SECOND_REVIEW_REQUIRED: 'ממתין לבדיקה נוספת',
}

/** What each status MEANS for the website, which is the part people get wrong. */
export const STATUS_EFFECT: Record<VerificationStatus, string> = {
  UNVERIFIED: 'לא יופיע באתר.',
  VERIFIED: 'יופיע באתר. אדם אחד ערך ואדם אחר אישר.',
  SELF_VERIFIED: 'יופיע באתר. אותו אדם ערך ואישר, וזה נרשם ככזה.',
  SECOND_REVIEW_REQUIRED: 'לא יופיע באתר עד לבדיקה של אדם נוסף.',
}

export const SOURCE_TYPE_LABEL: Record<ProjectSource['type'], string> = {
  FEASIBILITY_WORKBOOK: 'קובץ בדיקת היתכנות',
  USER_VERIFIED: 'אישור הלקוח',
  TABU: 'טאבו',
  MUNICIPAL_RECORD: 'רישום עירוני',
  SURVEY: 'מדידה',
  OTHER: 'אחר',
}

export const QUALITY_LABEL: Record<ProjectSource['quality'], string> = {
  HIGH: 'איכות גבוהה',
  MEDIUM: 'איכות בינונית',
  LOW: 'איכות נמוכה',
  UNKNOWN: 'איכות לא ידועה',
}

export const REVIEW_STATE_LABEL: Record<ProjectSource['reviewState'], string> = {
  UNREVIEWED: 'טרם נבדק',
  IN_REVIEW: 'בבדיקה',
  ACCEPTED: 'התקבל',
  REJECTED: 'נדחה',
}

/**
 * The image classifications, explained in normal Hebrew.
 *
 * The words matter more than the enum: whoever attaches an image is deciding
 * whether the site may say "this is the project", and a label like
 * EDITORIAL_CONTEXT does not tell them that.
 */
export const CLAIM_LABEL: Record<ImageClaim, { label: string; detail: string }> = {
  VERIFIED_PROJECT_PHOTO: {
    label: 'צילום מהפרויקט',
    detail: 'התמונה מראה את המתחם הזה בפועל. נבדק שזה נכון.',
  },
  EDITORIAL_CONTEXT: {
    label: 'תצלום הקשר',
    detail: 'תמונה כללית שמלווה את הטקסט. אינה מראה את המתחם, והאתר יאמר זאת.',
  },
  ARCHITECTURAL_PATTERN: {
    label: 'איור אדריכלי',
    detail: 'איור שנוצר בקוד. אינו צילום ואינו מתיימר להראות מבנה קיים.',
  },
}

export const MILESTONE_STATE_LABEL: Record<ProjectMilestone['state'], string> = {
  completed: 'הושלם',
  current: 'מתקיים כעת',
  upcoming: 'לפנינו',
}

/** Field labels for the material facts the editor knows about. */
export const FACT_LABEL: Record<string, string> = {
  address: 'כתובת',
  unitCount: 'מספר יחידות',
  existingUnits: 'יחידות קיימות',
  plannedUnits: 'יחידות מתוכננות',
  lotArea: 'שטח מגרש',
  builtArea: 'שטח בנוי',
  planningStatus: 'מצב תכנוני',
  approvalDate: 'תאריך אישור',
  permitDate: 'תאריך היתר',
  developerName: 'שם היזם',
  startDate: 'תאריך התחלה',
  completionDate: 'תאריך סיום',
}

export function factLabel(field: string): string {
  if (field === 'public.currentStage') return 'שלב התהליך'
  if (field.startsWith('milestones.')) return 'אבן דרך'
  const key = field.replace('public.facts.', '')
  return FACT_LABEL[key] ?? key
}

/**
 * The eleven internal stages and the four public phases.
 *
 * Mirrors `STAGE_PHASE` in @urban-renewal/api-contracts, which the CRM already
 * depends on. Kept as data here so the editor can SHOW the derivation — an
 * editor who picks a stage should see immediately which public phase it
 * produces, because the phase is what a resident reads.
 */
export const STAGE_LABEL: Record<string, string> = {
  INITIAL_REVIEW: 'בדיקה ראשונית',
  FEASIBILITY: 'בדיקת היתכנות',
  OWNER_ORGANIZATION: 'התארגנות בעלי דירות',
  REPRESENTATION_FORMED: 'הוקמה נציגות',
  PROFESSIONAL_SELECTION: 'בחירת אנשי מקצוע',
  DEVELOPER_TENDER: 'בחינת ובחירת יזם',
  DEVELOPER_SELECTED: 'נבחר יזם',
  AGREEMENTS: 'הסכמים',
  PLANNING: 'תכנון',
  PERMIT_AND_BUILD: 'היתר ובנייה',
  DELIVERY: 'מסירה',
}

export const PHASE_LABEL: Record<string, string> = {
  ORGANISING: 'התארגנות',
  EVALUATION: 'גיבוש ובחירה',
  PLANNING: 'תכנון',
  EXECUTION: 'ביצוע',
}
