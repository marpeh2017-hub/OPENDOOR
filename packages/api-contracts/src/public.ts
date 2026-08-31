import type {
  GeoContext, IsoDate, IsoDateTime, Locale, LocalizedText, MediaAsset,
  Paginated, PublishState, SeoMetadata, Visibility,
} from './common'
import type { VerifiedFact } from './verification'

/**
 * Unauthenticated surface: everything odg.co.il serves to a visitor.
 *
 * Nothing here may carry resident-identifying data. That is not a policy note —
 * it is the reason several fields below are deliberately absent (see
 * `PublicProject`).
 */

/* ── Urban-renewal process ─────────────────────────────────────────────── */

/**
 * The eleven stages from §11, in order.
 *
 * Kept as a union rather than free text because the public timeline, the
 * resident timeline and the representation milestones all render the same
 * sequence, and a typo in one would silently produce a different process.
 */
export type ProjectStage =
  | 'INITIAL_REVIEW'        // בדיקה ראשונית
  | 'FEASIBILITY'           // בדיקת היתכנות
  | 'OWNER_ORGANIZATION'    // התארגנות בעלי הדירות
  | 'REPRESENTATION_FORMED' // הקמת נציגות
  | 'PROFESSIONAL_SELECTION'// בחירת אנשי מקצוע
  | 'DEVELOPER_TENDER'      // בחינת חלופות / מכרז יזמים
  | 'DEVELOPER_SELECTED'    // בחירת יזם וניהול משא ומתן
  | 'AGREEMENTS'            // הסכמים וחתימות
  | 'PLANNING'              // תכנון וקידום הפרויקט
  | 'PERMIT_AND_BUILD'      // היתר וביצוע
  | 'DELIVERY'              // מסירה ואכלוס

export const PROJECT_STAGE_ORDER: readonly ProjectStage[] = [
  'INITIAL_REVIEW', 'FEASIBILITY', 'OWNER_ORGANIZATION', 'REPRESENTATION_FORMED',
  'PROFESSIONAL_SELECTION', 'DEVELOPER_TENDER', 'DEVELOPER_SELECTED',
  'AGREEMENTS', 'PLANNING', 'PERMIT_AND_BUILD', 'DELIVERY',
] as const

/** Renewal track. Affects which stages apply and how the timeline reads. */
export type ProjectType = 'PINUY_BINUY' | 'TAMA_38_1' | 'TAMA_38_2' | 'COMBINED' | 'OTHER'

export interface TimelineStage {
  stage: ProjectStage
  state: 'completed' | 'current' | 'upcoming'
  /** Only where the date is already public. Absent is normal and expected. */
  completedAt?: IsoDate
  /** Plain-language explanation of what this stage means for residents. */
  description?: string
}

/* ── Projects ──────────────────────────────────────────────────────────── */

/**
 * A project as an unauthenticated visitor sees it.
 *
 * NOTE WHAT IS NOT HERE, and note that the absence is deliberate rather than
 * an oversight: no unit count, no signature percentage, no developer name, no
 * financial figure, no municipal approval, no resident names. Those are either
 * unverified, commercially sensitive, or resident data. The public card and
 * detail page are designed to be complete without them — a layout that needs
 * "87% signed" to look finished creates pressure to invent the number.
 */
export interface PublicProject {
  /* ── Identity and editorial content ──────────────────────────────────────
   * These carry no factual assertion a reader could be misled by, so they use
   * the ordinary DRAFT → REVIEW → PUBLISHED workflow rather than structured
   * verification. See `verification.ts` for why the two are kept apart. */
  id: string
  slug: string
  name: string
  type: ProjectType
  location: GeoContext
  /** One or two sentences, for cards and search results. */
  summary: string
  /** Full body, for the detail page. May contain safe inline markup. */
  description?: string
  /** How organised the owners are. Editorial rather than verified: it
   *  describes OpenDoor's own working relationship with the complex, which
   *  OpenDoor is the authority on, not a fact about the building. */
  organizingStatus?: OrganizingStatus

  /* ── Media ───────────────────────────────────────────────────────────────
   * Only an asset whose `imageType` is VERIFIED_PROJECT_PHOTO may be used as
   * this project's own image. The renderer enforces it; see `EditorialImage`. */
  heroImage?: MediaAsset
  gallery?: MediaAsset[]
  /** The complex as it stands today. Distinct from `gallery` because a
   *  "before" image makes a claim about a moment in time. */
  beforeImages?: MediaAsset[]
  videos?: MediaAsset[]
  documents?: ProjectDocument[]

  /* ── MATERIAL FACTUAL CLAIMS ─────────────────────────────────────────────
   *
   * Every field below is a statement a resident might act on, and every one
   * is wrapped so it cannot exist without a name and a date attached.
   * ABSENT IS THE NORMAL STATE and the UI must be complete without any of
   * them. Absent never means zero, unknown or pending — it means nobody has
   * checked, and so the site says nothing. */

  /**
   * OPTIONAL, and this is a product rule rather than a data convenience.
   *
   * A project's stage is a factual claim about a real building's process.
   * Where it has not been verified it must be ABSENT — not guessed, not
   * defaulted to the first stage, not shown as "unknown". The card and detail
   * page are required to look complete without it.
   */
  currentStage?: VerifiedFact<ProjectStage>
  existingUnits?: VerifiedFact<number>
  proposedUnits?: VerifiedFact<number>
  buildingCount?: VerifiedFact<number>
  planningStatus?: VerifiedFact<PlanningStatus>
  /** A named commercial party. Never rendered without verification, because
   *  naming the wrong developer is both a factual error and a commercial one. */
  developer?: VerifiedFact<ProjectParty>
  /** Lawyers, appraisers, architects. Same rule as `developer`, and never
   *  rendered in a way that implies they work for OpenDoor. */
  professionals?: VerifiedFact<ProjectParty[]>
  approvals?: VerifiedFact<ProjectApproval[]>
  permits?: VerifiedFact<ProjectApproval[]>
  /** Dates a resident might plan around. Wrapped for the same reason as the
   *  counts: a wrong date here is not a typo, it is a broken expectation. */
  materialDates?: VerifiedFact<ProjectDateRecord[]>

  /* ── Progress ────────────────────────────────────────────────────────────
   * Milestones carry their own per-entry verification: a project can have
   * three confirmed milestones and two unconfirmed ones, and only the
   * confirmed ones render. */
  milestones?: ProjectMilestone[]
  /** Absent when no stage is verified — a timeline without a stage would be an
   *  invented sequence. Empty and absent both mean "no verified progress". */
  timeline?: TimelineStage[]

  /* ── Control ─────────────────────────────────────────────────────────── */
  /** Whether residents of this project see updates in the portal. Not public
   *  information; it governs the portal, not this page. */
  residentUpdatesVisible?: boolean
  featured: boolean
  visibility: Visibility
  publishState: PublishState
  seo?: SeoMetadata
  updatedAt: IsoDateTime
}

/** How far the owners have organised themselves. Editorial, not verified. */
export type OrganizingStatus =
  | 'NOT_STARTED'
  | 'EARLY_CONVERSATION'
  | 'REPRESENTATION_FORMED'
  | 'PROCESS_ACTIVE'

/** Where the project stands with the planning system. A material claim. */
export type PlanningStatus =
  | 'PRE_PLANNING'
  | 'PLAN_SUBMITTED'
  | 'PLAN_DEPOSITED'
  | 'PLAN_APPROVED'
  | 'PERMIT_STAGE'
  | 'UNDER_CONSTRUCTION'

/**
 * A named party in the process.
 *
 * Deliberately carries no logo, no link and no description. This type exists
 * to state a role and a name; anything richer starts to read as an endorsement
 * or a partnership, and §16 forbids implying either.
 */
export interface ProjectParty {
  role: 'DEVELOPER' | 'LAWYER' | 'APPRAISER' | 'ARCHITECT' | 'SUPERVISOR' | 'OTHER'
  name: string
}

/** An approval or permit granted by an authority. */
export interface ProjectApproval {
  id: string
  /** What was granted, in plain language. */
  label: LocalizedText
  /** Which body granted it. */
  authority?: string
  grantedOn?: IsoDate
  /** Public decision or file number, where one exists and is already public. */
  reference?: string
}

/** A date that matters to a resident's planning. */
export interface ProjectDateRecord {
  id: string
  label: LocalizedText
  occursOn: IsoDate
  /** True when the date is a target rather than a commitment. The UI must
   *  render the distinction; an estimate shown as a commitment is the most
   *  common way a timeline becomes a broken promise. */
  isEstimate: boolean
}

/**
 * One step in a project's history.
 *
 * `verification` is per-milestone rather than on the whole list, because a
 * project realistically has some confirmed history and some pending entries.
 * The renderer shows only the verified ones.
 */
export interface ProjectMilestone {
  id: string
  title: LocalizedText
  state: 'completed' | 'current' | 'upcoming'
  note?: LocalizedText
  occurredAt?: IsoDate
  verification?: VerifiedFact<true>
}

/**
 * A document attached to a project.
 *
 * `url` is a signed, expiring URL issued per request. It is NEVER a storage
 * key: the frontend must not be able to construct a path into object storage,
 * which is a rule this codebase already holds elsewhere.
 */
export interface ProjectDocument {
  id: string
  title: LocalizedText
  kind: 'PLAN' | 'PERMIT' | 'SUMMARY' | 'OTHER'
  url: string
  visibility: Visibility
  mimeType?: string
  sizeBytes?: number
}

/** Card projection. Everything a grid needs and nothing it does not. */
export interface PublicProjectSummary {
  id: string
  slug: string
  name: string
  type: ProjectType
  location: GeoContext
  summary: string
  /** Optional for the same reason as on `PublicProject`, and verification
   *  travels with it: a card that renders a stage must be able to say who
   *  confirmed it, even though the card itself does not display that. */
  currentStage?: VerifiedFact<ProjectStage>
  heroImage?: MediaAsset
  featured: boolean
}

/** A dated, public-safe project update. */
export interface PublicProjectUpdate {
  id: string
  projectId: string
  title: string
  body: string
  publishedAt: IsoDateTime
  media?: MediaAsset[]
}

export interface PublicProjectQuery {
  city?: string
  type?: ProjectType
  stage?: ProjectStage
  featured?: boolean
  search?: string
  limit?: number
  offset?: number
  locale?: Locale
}

/* ── Knowledge centre ──────────────────────────────────────────────────── */

export interface KnowledgeCategory {
  id: string
  slug: string
  name: string
  description?: string
  articleCount: number
}

export interface KnowledgeArticle {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  category: KnowledgeCategory
  tags: string[]
  /** The company, not a person — residents are advised by an organisation. */
  attribution: string
  publishedAt: IsoDateTime
  updatedAt: IsoDateTime
  relatedArticleSlugs?: string[]
  relatedProjectSlugs?: string[]
  seo?: SeoMetadata
  locale: Locale
}

export type KnowledgeArticleSummary =
  Pick<KnowledgeArticle, 'id' | 'slug' | 'title' | 'summary' | 'category' | 'updatedAt'>

/* ── FAQ ───────────────────────────────────────────────────────────────── */

export interface FaqItem {
  id: string
  question: string
  answer: string
  category?: string
  order: number
}

/* ── External references (§16) ─────────────────────────────────────────── */

/**
 * A pointer to an authoritative outside source.
 *
 * These are NOT partners and must never be rendered as such — no logos, text
 * only, `target="_blank"`, no affiliate parameters.
 */
export interface ExternalResource {
  id: string
  label: string
  url: string
  description?: string
}

/* ── Contact ───────────────────────────────────────────────────────────── */

export interface ContactSubmission {
  fullName: string
  phone: string
  email?: string
  message: string
  /** Explicit, unticked-by-default consent. */
  consent: true
}

export interface ContactSubmissionResult {
  received: true
  reference?: string
}

/* ── Eligibility funnel (§18) ──────────────────────────────────────────── */

export type RepresentationStatus = 'NONE' | 'FORMING' | 'EXISTS' | 'UNKNOWN'
export type DeveloperApproachStatus = 'NONE' | 'APPROACHED' | 'IN_TALKS' | 'SIGNED' | 'UNKNOWN'
export type ApartmentCountBand = 'UNDER_10' | 'FROM_10_TO_24' | 'FROM_25_TO_49' | 'FROM_50_TO_99' | 'OVER_100'

/**
 * The primary conversion.
 *
 * Bands rather than an exact apartment count: a resident answering a website
 * form does not reliably know the exact number, and an invented precise figure
 * would flow into the CRM as though it were verified.
 */
export interface EligibilitySubmission {
  address: string
  location?: Pick<GeoContext, 'city' | 'neighborhood' | 'street'>
  apartmentCount: ApartmentCountBand
  representation: RepresentationStatus
  developerApproach: DeveloperApproachStatus
  /** Free text: whatever the resident wants to say about where things stand. */
  currentStatus?: string
  fullName: string
  phone: string
  email?: string
  consent: true
  locale?: Locale
}

/**
 * Deliberately says nothing about outcome.
 *
 * No score, no "your building qualifies", no estimated value. The company must
 * not imply a feasibility verdict from six form answers, and §3 forbids
 * inventing commercial claims. The honest response is an acknowledgement and a
 * clear next step.
 */
export interface EligibilitySubmissionResult {
  received: true
  reference: string
  /** What happens next, in plain Hebrew. Never a promise or a timeframe
   *  commitment unless the business supplies approved copy. */
  nextStep: string
}

/* ── Site-wide search (§48) ────────────────────────────────────────────── */

export type SearchResultKind = 'project' | 'article' | 'faq' | 'page'

export interface SearchResult {
  kind: SearchResultKind
  title: string
  excerpt: string
  href: string
}

export type SearchResults = Paginated<SearchResult>
