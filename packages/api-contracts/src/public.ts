import type {
  GeoContext, IsoDate, IsoDateTime, Locale, MediaAsset,
  Paginated, PublishState, SeoMetadata, Visibility,
} from './common'

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
  id: string
  slug: string
  name: string
  type: ProjectType
  location: GeoContext
  /** One or two sentences, for cards and search results. */
  summary: string
  /** Full body, for the detail page. May contain safe inline markup. */
  description?: string
  currentStage: ProjectStage
  heroImage?: MediaAsset
  gallery?: MediaAsset[]
  videos?: MediaAsset[]
  timeline: TimelineStage[]
  featured: boolean
  visibility: Visibility
  publishState: PublishState
  seo?: SeoMetadata
  updatedAt: IsoDateTime
}

/** Card projection. Everything a grid needs and nothing it does not. */
export interface PublicProjectSummary {
  id: string
  slug: string
  name: string
  type: ProjectType
  location: GeoContext
  summary: string
  currentStage: ProjectStage
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
