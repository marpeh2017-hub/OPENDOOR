/**
 * The shape of a project inside the CMS, and the ALLOWLIST that projects it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHY THE DOCUMENT IS SPLIT AT THE TOP LEVEL
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A project is the one content type where the private half is larger and more
 * dangerous than the public half. Tchernichovsky carries ten candidate
 * addresses nobody has confirmed, a block and parcel whose address is unknown,
 * eight data-quality flags, and a workbook of scenario figures precise to two
 * decimal places that would read as a plan if they ever escaped.
 *
 * So the split is STRUCTURAL and at the top:
 *
 *   public       may reach the website, once verified
 *   internal     never reaches the website, at any verification level
 *   feasibility  never reaches the website, EVER, verified or not
 *   milestones   public-eligible, per entry
 *   media        public-eligible, per entry
 *   seo          public-eligible
 *   sources      internal provenance, referenced by facts
 *
 * The projection reads `public`, `milestones`, `media` and `seo`. It does not
 * "skip" internal and feasibility; it never looks at them. A field added to
 * `internal` cannot leak, because no code path carries `internal` toward the
 * public payload.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  ALLOWLIST, NOT DENY-LIST
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Pass 4B's page projection rebuilds content and drops unrecognised keys,
 * which is already fail-safe. For projects that is not enough: the payload is
 * a fixed, known set of fields rather than an open-ended block tree, so it can
 * be built by NAMING each public field. `projectProjection` therefore
 * enumerates what goes out. A new field appears on the website only when
 * somebody adds it to this file on purpose.
 *
 * The difference matters in one specific way. A deny-list has to be right
 * about every future field; an allowlist only has to be right about the fields
 * that exist. The first is a promise about code nobody has written yet.
 */

/*
 * ── WHY THE STAGE IS PUBLISHED BUT THE PHASE IS NOT ────────────────────────
 *
 * `ProjectStage` has eleven internal values; the website shows four public
 * phases derived from it by `STAGE_PHASE` in @urban-renewal/api-contracts.
 * That map is NOT duplicated here.
 *
 * The gateway cannot import the contracts package: it publishes raw ESM
 * TypeScript from `src/`, and this is a CommonJS Nest build. Copying eleven
 * entries across that boundary would create exactly the drift the shared
 * package exists to prevent — a stage that means one thing to the website and
 * another to the CMS.
 *
 * So the projection publishes the STAGE, which is the verified fact, and the
 * consumers derive the PHASE, which is presentation. Both the website and the
 * CRM already import the contracts and already do this. The phase and the
 * stage therefore cannot disagree, because only one of them is stored.
 */
type ProjectStage = string

// ── Localised text ───────────────────────────────────────────────────────
export interface LocalizedContent {
  he: string
  en?: string
}

export type VerificationStatus =
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'SELF_VERIFIED'
  | 'SECOND_REVIEW_REQUIRED'

/** Only these two may reach the public. Mirrors `isPublishable` in contracts. */
const PUBLISHABLE = new Set<VerificationStatus>(['VERIFIED', 'SELF_VERIFIED'])

/**
 * A material factual claim, with everything needed to say who stands behind it.
 *
 * `verifiedValue` sits beside `value` so invalidation is a MECHANISM: when the
 * two differ, nobody has signed for what the field currently says, and no flag
 * has to be remembered and cleared. Editing a verified value therefore
 * invalidates it by arithmetic rather than by intention.
 */
export interface ProjectFact<T = unknown> {
  value: T
  /** The value that was actually signed for. Absent means never verified. */
  verifiedValue?: T
  status: VerificationStatus
  editedByUserId?: string
  editedAt?: string
  verifiedByUserId?: string
  verifiedAt?: string
  /** Points into `sources[]`. Internal vocabulary; never public. */
  sourceId?: string
  sourceReference?: string
  /** Ids of data-quality flags that BLOCK verification of this fact. */
  blockedBy?: string[]
}

export interface ProjectMilestone {
  id: string
  title: LocalizedContent
  note?: LocalizedContent
  state: 'completed' | 'current' | 'upcoming'
  order: number
  /**
   * Deliberately optional and deliberately separate from `state`. A milestone
   * with no date is a complete milestone; an invented date is not.
   */
  occurredAt?: string
  periodLabel?: LocalizedContent
  /** A milestone is a material claim: it says something happened. */
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

/** Where a fact came from. Internal vocabulary: never leaves the gateway. */
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
  /** Dotted paths of the facts this flag blocks, e.g. `public.facts.lotArea`. */
  blocks?: string[]
  resolved?: boolean
}

export interface ProjectDocument {
  public: {
    name: LocalizedContent
    location: {
      city: LocalizedContent
      neighborhood?: LocalizedContent
      /** Only ever set when an address is verified. See `addressFact`. */
      street?: LocalizedContent
    }
    summary?: LocalizedContent
    description?: LocalizedContent
    role?: LocalizedContent
    /** Material: the process stage. The public PHASE is derived, never stored. */
    currentStage?: ProjectFact<ProjectStage>
    /** Material claims keyed by field name. */
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
    sourceData?: Record<string, { value: number | string; unit?: string; note?: string; reviewState?: string }>
    assumptions?: Record<string, { value: number | string; unit?: string; note?: string }>
    outputs?: Record<string, { value: number | string; unit?: string; note?: string }>
    economics?: Record<string, { value: number | string; unit?: string; note?: string }>
  }
  milestones?: ProjectMilestone[]
  media?: ProjectMedia[]
  seo?: Record<string, { title?: string; description?: string }>
  sources?: ProjectSource[]
}

// ══════════════════════════════════════════════════════════════════════════
//  THE PROJECTION
// ══════════════════════════════════════════════════════════════════════════

export interface PublicFact<T = unknown> {
  value: T
  verified: true
  verifiedAt?: string
}

export interface PublicProjectProjection {
  name: LocalizedContent
  location: { city: LocalizedContent; neighborhood?: LocalizedContent; street?: LocalizedContent }
  summary?: LocalizedContent
  description?: LocalizedContent
  role?: LocalizedContent
  currentStage?: PublicFact<ProjectStage>
  facts?: Record<string, PublicFact>
  cta?: { label: LocalizedContent; href: string }
  milestones?: {
    id: string
    title: LocalizedContent
    note?: LocalizedContent
    state: 'completed' | 'current' | 'upcoming'
    occurredAt?: string
    periodLabel?: LocalizedContent
  }[]
  media?: {
    id: string
    storageKey: string
    classification: ImageClaim
    alt: LocalizedContent
    caption?: LocalizedContent
    credit?: string
    width?: number
    height?: number
  }[]
  seo?: Record<string, { title?: string; description?: string }>
}

/** Carry the badge, never the identity or the provenance vocabulary. */
function publicFact<T>(fact: ProjectFact<T> | undefined): PublicFact<T> | undefined {
  if (!fact || !PUBLISHABLE.has(fact.status)) return undefined
  // Signed for a DIFFERENT value than the one now displayed: not verified.
  if (fact.verifiedValue !== undefined &&
      JSON.stringify(fact.verifiedValue) !== JSON.stringify(fact.value)) {
    return undefined
  }
  return fact.verifiedAt
    ? { value: fact.value, verified: true, verifiedAt: fact.verifiedAt }
    : { value: fact.value, verified: true }
}

function text(v: LocalizedContent | undefined): LocalizedContent | undefined {
  if (!v || !v.he) return undefined
  return v.en ? { he: v.he, en: v.en } : { he: v.he }
}

/**
 * Build the public payload by NAMING every field that may travel.
 *
 * `internal`, `feasibility` and `sources` are never read. Not filtered, not
 * stripped — never read. That is the difference between this and a deny-list,
 * and it is the reason a new internal field cannot leak by being forgotten.
 */
export function projectProjection(doc: ProjectDocument): PublicProjectProjection {
  const p = doc.public ?? ({} as ProjectDocument['public'])

  const out: PublicProjectProjection = {
    name: text(p.name) ?? { he: '' },
    location: { city: text(p.location?.city) ?? { he: '' } },
  }

  const neighborhood = text(p.location?.neighborhood)
  if (neighborhood) out.location.neighborhood = neighborhood

  /*
   * A street is a MATERIAL claim about where the project is, so it travels
   * only when a fact backs it. Tchernichovsky has ten candidate addresses and
   * no confirmed boundary, so it publishes a city and no street — settling
   * that by presentation is exactly the mistake the candidate list exists to
   * prevent.
   */
  const addressFact = p.facts?.['address']
  if (p.location?.street && publicFact(addressFact)) {
    const street = text(p.location.street)
    if (street) out.location.street = street
  }

  const summary = text(p.summary); if (summary) out.summary = summary
  const description = text(p.description); if (description) out.description = description
  const role = text(p.role); if (role) out.role = role

  // The stage travels; the phase is derived by the consumer from the contract's
  // STAGE_PHASE, so the two cannot disagree because only one is stored.
  const stage = publicFact(p.currentStage)
  if (stage) out.currentStage = stage

  if (p.facts) {
    const facts: Record<string, PublicFact> = {}
    for (const [key, fact] of Object.entries(p.facts)) {
      // `address` is consumed above as a gate on location.street rather than
      // published as a bare fact of its own.
      if (key === 'address') continue
      const pub = publicFact(fact)
      if (pub) facts[key] = pub
    }
    if (Object.keys(facts).length > 0) out.facts = facts
  }

  if (p.cta && p.cta.href && text(p.cta.label)) {
    out.cta = { label: text(p.cta.label)!, href: p.cta.href }
  }

  if (doc.milestones?.length) {
    const ms = doc.milestones
      .filter((m) => !m.hidden)
      // A milestone that asserts something happened needs somebody behind it.
      // One with no fact at all is editorial ordering, and travels.
      .filter((m) => (m.fact ? Boolean(publicFact(m.fact)) : true))
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((m) => {
        const entry: NonNullable<PublicProjectProjection['milestones']>[number] = {
          id: m.id,
          title: text(m.title) ?? { he: '' },
          state: m.state,
        }
        const note = text(m.note); if (note) entry.note = note
        if (m.occurredAt) entry.occurredAt = m.occurredAt
        const period = text(m.periodLabel); if (period) entry.periodLabel = period
        return entry
      })
    if (ms.length > 0) out.milestones = ms
  }

  if (doc.media?.length) {
    const media = doc.media
      .filter((m) => !m.hidden)
      // Alt text is not decoration: an image without it cannot be published,
      // and this is the last place that can still be true cheaply.
      .filter((m) => Boolean(m.alt?.he))
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((m) => {
        const entry: NonNullable<PublicProjectProjection['media']>[number] = {
          id: m.id,
          storageKey: m.storageKey,
          // Carried deliberately: the website renders a different caption for
          // an editorial photograph than for a project photograph, and it
          // cannot do that if the claim is dropped at the boundary.
          classification: m.classification,
          alt: text(m.alt) ?? { he: '' },
        }
        const caption = text(m.caption); if (caption) entry.caption = caption
        if (m.credit) entry.credit = m.credit
        if (m.width) entry.width = m.width
        if (m.height) entry.height = m.height
        return entry
      })
    if (media.length > 0) out.media = media
  }

  /*
   * SEO is built ONLY from `doc.seo`, which the editor populates from public
   * content. There is no path here from `internal` or `feasibility` into a
   * meta description, because this function cannot see them.
   */
  if (doc.seo) {
    const seo: Record<string, { title?: string; description?: string }> = {}
    for (const [locale, entry] of Object.entries(doc.seo)) {
      if (!entry) continue
      const e: { title?: string; description?: string } = {}
      if (entry.title) e.title = entry.title
      if (entry.description) e.description = entry.description
      if (e.title || e.description) seo[locale] = e
    }
    if (Object.keys(seo).length > 0) out.seo = seo
  }

  return out
}

// ══════════════════════════════════════════════════════════════════════════
//  PUBLICATION CHECK
// ══════════════════════════════════════════════════════════════════════════

export interface ProjectCheckEntry {
  code: string
  message: string
  field?: string
}

export interface ProjectPublicationCheck {
  canPublish: boolean
  /** Named fields that WILL become public if this is published. */
  willBecomePublic: { field: string; label: string }[]
  /** Named areas that stay private no matter what. Reassurance, in writing. */
  staysPrivate: { area: string; label: string; detail: string }[]
  blockers: ProjectCheckEntry[]
  warnings: ProjectCheckEntry[]
}

const PRIVATE_AREAS = [
  { area: 'internal.candidateAddresses', label: 'כתובות מועמדות',
    detail: 'רשימת הכתובות שנבדקות אינה מתפרסמת. גבול המתחם אינו סופי.' },
  { area: 'internal.blocks', label: 'גוש וחלקה',
    detail: 'פרטי גוש וחלקה נשמרים לעבודה פנימית ואינם מופיעים באתר.' },
  { area: 'internal.existingConditions', label: 'מצב קיים',
    detail: 'נתוני המצב הקיים אינם מתפרסמים.' },
  { area: 'feasibility', label: 'בדיקת היתכנות',
    detail: 'תרחיש ההיתכנות אינו מתפרסם, גם לא אחרי אימות. תרחיש אינו עובדה.' },
  { area: 'feasibility.economics', label: 'תוצאות כלכליות',
    detail: 'מכירות, רווח ותשואה הם מידע פנימי מובהק ואינם יוצאים מהמערכת.' },
  { area: 'verification.audit', label: 'יומן האימותים',
    detail: 'מי אימת ומתי נשמר לביקורת פנימית. הציבור רואה שנתון אומת, לא מי אימת אותו.' },
  { area: 'sources', label: 'מקורות',
    detail: 'סוגי המקורות והאסמכתאות הם אוצר מילים פנימי ואינם מתפרסמים.' },
] as const

const FACT_LABELS: Record<string, string> = {
  address: 'כתובת', unitCount: 'מספר יחידות', existingUnits: 'יחידות קיימות',
  plannedUnits: 'יחידות מתוכננות', lotArea: 'שטח מגרש', builtArea: 'שטח בנוי',
  planningStatus: 'מצב תכנוני', approvalDate: 'תאריך אישור', permitDate: 'תאריך היתר',
  developerName: 'שם היזם', startDate: 'תאריך התחלה', completionDate: 'תאריך סיום',
}

export function projectPublicationCheck(
  doc: ProjectDocument,
  opts: { exposure: string },
): ProjectPublicationCheck {
  const blockers: ProjectCheckEntry[] = []
  const warnings: ProjectCheckEntry[] = []
  const willBecomePublic: { field: string; label: string }[] = []

  const projected = projectProjection(doc)

  if (opts.exposure !== 'PUBLIC') {
    blockers.push({
      code: 'NOT_PUBLIC_EXPOSURE',
      message: 'הפרויקט מסומן כפנימי ואינו יכול להתפרסם.',
    })
  }

  if (!projected.name?.he) {
    blockers.push({ code: 'NO_NAME', message: 'לפרויקט אין שם בעברית.', field: 'public.name' })
  } else {
    willBecomePublic.push({ field: 'public.name', label: `שם: ${projected.name.he}` })
  }

  if (!projected.location?.city?.he) {
    blockers.push({ code: 'NO_CITY', message: 'לפרויקט אין עיר.', field: 'public.location.city' })
  } else {
    willBecomePublic.push({ field: 'public.location.city', label: `עיר: ${projected.location.city.he}` })
  }

  if (projected.summary) willBecomePublic.push({ field: 'public.summary', label: 'תקציר' })
  if (projected.description) willBecomePublic.push({ field: 'public.description', label: 'תיאור' })
  if (projected.role) willBecomePublic.push({ field: 'public.role', label: 'תפקיד OpenDoor' })
  if (projected.currentStage) {
    willBecomePublic.push({ field: 'public.currentStage', label: `שלב התהליך, ומתוכו נגזר הפרק המוצג באתר` })
  }
  for (const key of Object.keys(projected.facts ?? {})) {
    willBecomePublic.push({ field: `public.facts.${key}`, label: FACT_LABELS[key] ?? key })
  }
  if (projected.milestones?.length) {
    willBecomePublic.push({ field: 'milestones', label: `${projected.milestones.length} אבני דרך` })
  }
  if (projected.media?.length) {
    willBecomePublic.push({ field: 'media', label: `${projected.media.length} תמונות` })
  }

  // ── Unverified material claims: a warning, not a blocker ────────────────
  // They simply do not travel. Blocking publication because a figure is
  // unverified would stop a correct page from going out over a field the
  // projection was going to drop anyway.
  for (const [key, fact] of Object.entries(doc.public?.facts ?? {})) {
    if (fact.status === 'UNVERIFIED') {
      warnings.push({
        code: 'UNVERIFIED_FACT', field: `public.facts.${key}`,
        message: `"${FACT_LABELS[key] ?? key}" אינו מאומת ולא יופיע באתר.`,
      })
    }
    if (fact.status === 'SECOND_REVIEW_REQUIRED') {
      blockers.push({
        code: 'SECOND_REVIEW_REQUIRED', field: `public.facts.${key}`,
        message: `"${FACT_LABELS[key] ?? key}" ממתין לבדיקה נוספת.`,
      })
    }
    if (fact.verifiedValue !== undefined &&
        JSON.stringify(fact.verifiedValue) !== JSON.stringify(fact.value) &&
        PUBLISHABLE.has(fact.status)) {
      warnings.push({
        code: 'VERIFICATION_STALE', field: `public.facts.${key}`,
        message: `"${FACT_LABELS[key] ?? key}" שונה מאז שאומת, ולכן לא יופיע באתר.`,
      })
    }
  }

  // ── Blocking data-quality flags ─────────────────────────────────────────
  for (const flag of doc.internal?.dataQualityFlags ?? []) {
    if (flag.resolved || flag.severity !== 'BLOCKING') continue
    // A blocking flag stops the FACTS IT NAMES, not the whole project. The
    // process facts OpenDoor verified about its own engagement are unaffected
    // by a discrepancy in the workbook's area figures.
    for (const path of flag.blocks ?? []) {
      const key = path.split('.').pop()!
      const fact = doc.public?.facts?.[key]
      if (fact && PUBLISHABLE.has(fact.status)) {
        blockers.push({
          code: 'BLOCKED_BY_DATA_QUALITY', field: path,
          message: `"${FACT_LABELS[key] ?? key}" מאומת אך חסום בגלל: ${flag.label}`,
        })
      }
    }
  }

  // ── Media without alt text ──────────────────────────────────────────────
  for (const m of doc.media ?? []) {
    if (!m.hidden && !m.alt?.he) {
      blockers.push({
        code: 'MEDIA_MISSING_ALT', field: `media.${m.id}`,
        message: `לתמונה "${m.filename}" אין טקסט חלופי בעברית.`,
      })
    }
  }

  // ── Localisation: warnings only, never blockers ─────────────────────────
  if (!projected.summary?.en) {
    warnings.push({ code: 'NO_ENGLISH_SUMMARY', message: 'אין תקציר באנגלית. האתר יציג את העברית.' })
  }
  if (!projected.seo?.['he']?.title) {
    warnings.push({ code: 'NO_SEO_TITLE', message: 'אין כותרת SEO בעברית. האתר ישתמש בשם הפרויקט.' })
  }

  return {
    canPublish: blockers.length === 0,
    willBecomePublic,
    staysPrivate: PRIVATE_AREAS.map((a) => ({ ...a })),
    blockers,
    warnings,
  }
}
