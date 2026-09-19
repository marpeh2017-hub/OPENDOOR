import type {
  IsoDateTime, Locale, LocalizedText, LocalizedTextOptional,
  MediaAsset, PublishState, SeoMetadata,
} from './common'

/**
 * Website content management (§31–§33, §54).
 *
 * Requirement §31: the entire public website must be editable without touching
 * source code.
 *
 * ── CONTROLLED BLOCKS, NOT A PAGE BUILDER ──────────────────────────────────
 *
 * §32 is explicit that this must not become an unrestricted builder that can
 * destroy the design system. So a page is an ORDERED LIST OF TYPED BLOCKS, each
 * with a fixed schema and no styling controls. An editor changes words, images,
 * order and visibility — never spacing, colour or typography. Those come from
 * the design tokens, which is the only way a site stays coherent after a year
 * of edits by people who did not design it.
 */

/* ── Blocks ────────────────────────────────────────────────────────────── */

/**
 * Every block type the website supports. Closed union by design: adding a block
 * is a code change plus a design review, which is the point.
 */
export type BlockType =
  | 'HERO'
  | 'PAGE_HEADER'
  | 'STATEMENT'
  | 'PROSE'
  | 'TEXT_SECTION'
  | 'COMPARISON'
  | 'ROLE_MAP'
  | 'JOURNEY'
  | 'FEATURE_GRID'
  | 'PROCESS'
  | 'PROJECTS'
  | 'PROJECT_TRANSPARENCY'
  | 'TRUST'
  | 'PORTAL'
  | 'KNOWLEDGE'
  | 'FAQ'
  | 'EXTERNAL_RESOURCES'
  | 'CTA'
  | 'MEDIA'

/**
 * Ordered for the block picker. A closed list, deliberately: adding a block is
 * a code change plus a design review, which is what stops this becoming an
 * unrestricted builder that can break the design system.
 */
export const BLOCK_TYPES: readonly BlockType[] = [
  // Openings
  'HERO', 'PAGE_HEADER',
  // Editorial
  'STATEMENT', 'PROSE', 'TEXT_SECTION', 'COMPARISON', 'ROLE_MAP',
  // Process
  'JOURNEY', 'PROCESS', 'PROJECT_TRANSPARENCY',
  // Lists and collections
  'FEATURE_GRID', 'TRUST', 'PROJECTS', 'KNOWLEDGE', 'FAQ', 'EXTERNAL_RESOURCES',
  // Other
  'PORTAL', 'MEDIA', 'CTA',
] as const

export interface BlockBase {
  /** Stable across edits and reorders, so a deep link to a section survives. */
  id: string
  type: BlockType
  order: number
  /** Hidden blocks stay in the page and keep their content (§31 hide/show). */
  hidden: boolean
}

/**
 * ── EVERY EDITORIAL STRING IS LOCALIZED ────────────────────────────────────
 *
 * Text fields are `LocalizedText`, not `string`. Two reasons, and the second is
 * the one that would be expensive to retrofit:
 *
 *   1. A CMS editor needs both languages side by side to translate at all.
 *   2. If blocks stored a single resolved string, adding English later would
 *      mean migrating every stored page rather than filling in a key.
 *
 * The UI resolves once at the page boundary via `resolveLocalized`, so
 * components below receive plain strings and never branch on language.
 *
 * Hrefs, ids and icon names are NOT localized — they are addresses, not copy.
 */

export interface HeroBlock extends BlockBase {
  type: 'HERO'
  /** Short qualifier above the headline. Company messaging, so it is content —
   *  not a string a component owns. */
  eyebrow?: LocalizedTextOptional
  heading: LocalizedText
  subheading?: LocalizedTextOptional
  primaryCtaLabel: LocalizedText
  primaryCtaHref: string
  secondaryCtaLabel?: LocalizedTextOptional
  secondaryCtaHref?: string
  /** A single reassurance under the buttons (e.g. that the service carries no
   *  direct cost). Content, for the same reason as `eyebrow`. */
  note?: LocalizedTextOptional
  media?: MediaAsset
}

export interface TextSectionBlock extends BlockBase {
  type: 'TEXT_SECTION'
  heading?: LocalizedTextOptional
  /**
   * Constrained markup: headings, paragraphs, lists, links, emphasis. No inline
   * styles, no raw HTML, no script — the design system supplies appearance, and
   * an editor who can inject style can break every page.
   */
  body: LocalizedText
  /**
   * Optional relationship map explaining who is who in the process.
   *
   * ADDITIVE and OPTIONAL: a TEXT_SECTION without it renders as plain prose,
   * exactly as before. It lives in the content model rather than in the
   * component because every string in it is company messaging — the roles and
   * what each one does — and components must not own messaging.
   */
  roleMap?: RoleMap
}

/**
 * Who sits where in an urban-renewal process.
 *
 * ── WHAT THIS MAY AND MAY NOT SAY ──────────────────────────────────────────
 *
 * It explains ROLES. It must not be used to imply that the listed
 * professionals work for OpenDoor, or that any partnership exists — no named
 * firms, no logos, no "our team". `side` states only which side of the table a
 * party sits on, which is a description of the structure and not a claim about
 * any particular lawyer or developer.
 */
export interface RoleMap {
  /** Who OpenDoor stands with. Rendered as the top of the relationship. */
  principal: RoleNode
  /** OpenDoor's own node — kept explicit so its position is content, not code. */
  organiser: RoleNode
  /** The parties the process brings to the table. */
  parties: RoleNode[]
}

export interface RoleNode {
  id: string
  label: LocalizedText
  /** One line, revealed on hover or focus. Never the only place a fact lives. */
  detail: LocalizedText
  /** Which side of the table. Used for grouping and colour, not for a claim. */
  side?: 'owners' | 'process'
}

export interface CtaBlock extends BlockBase {
  type: 'CTA'
  heading: LocalizedText
  body?: LocalizedTextOptional
  ctaLabel: LocalizedText
  ctaHref: string
}

/* ── Internal-page blocks (Pass 3A) ────────────────────────────────────── */

/**
 * The opening of an internal page.
 *
 * ── WHY THIS IS NOT `HERO` ─────────────────────────────────────────────────
 *
 * A hero holds someone who has just arrived and decided nothing: it carries a
 * portrait image slot, display-scale type and a pair of calls to action. A
 * visitor on /about has already chosen to be there. Reusing HERO would cost a
 * screen of scrolling before the page begins, and would make every internal
 * page look like a shorter homepage.
 *
 * Same grammar, quieter volume: one h1, one supporting line, no CTA pair.
 */
export interface PageHeaderBlock extends BlockBase {
  type: 'PAGE_HEADER'
  eyebrow?: LocalizedTextOptional
  heading: LocalizedText
  /** One or two sentences. Sets the page up; never restates the heading. */
  standfirst?: LocalizedTextOptional
}

/**
 * One large editorial sentence.
 *
 * The "אתם בעלי הדירות" moment, generalised. Rendered at display scale beside
 * the content it introduces rather than above it, which is what makes it read
 * as a position rather than as a section heading.
 */
export interface StatementBlock extends BlockBase {
  type: 'STATEMENT'
  statement: LocalizedText
  /** Optional supporting line under the rule. Keep it short. */
  support?: LocalizedTextOptional
}

/**
 * Long-form body copy.
 *
 * ── PLAIN TEXT, SPLIT ON BLANK LINES ───────────────────────────────────────
 *
 * Not markup. The body is editor-supplied, and interpreting HTML in it would
 * be an injection surface for whoever edits the CMS later. `lead` is rendered
 * one step larger as a standfirst, because the first paragraph of an
 * explanation is doing more work than the ones after it.
 */
export interface ProseBlock extends BlockBase {
  type: 'PROSE'
  heading?: LocalizedTextOptional
  /** Set larger than the body. Optional: not every prose block needs one. */
  lead?: LocalizedTextOptional
  body: LocalizedText
}

/**
 * Two columns, side by side.
 *
 * ── THE POSITIONING RULE THIS TYPE ENCODES ─────────────────────────────────
 *
 * Built for "without an organised process / with one". Note what the shape
 * does NOT provide: no `negative` flag, no severity, no colour control. The
 * renderer styles the second column as the emphasised one and leaves the first
 * entirely neutral, so the comparison cannot become an accusation. The
 * developer is a necessary partner who represents themselves; that is a
 * description of a structure, not a warning about a villain.
 */
export interface ComparisonBlock extends BlockBase {
  type: 'COMPARISON'
  heading?: LocalizedTextOptional
  intro?: LocalizedTextOptional
  /** Rendered first, neutrally. */
  baseline: ComparisonColumn
  /** Rendered second, with the teal rule. */
  organised: ComparisonColumn
  /** A closing line under the two columns. Used to state that the comparison
   *  describes a structure rather than assigning blame. */
  note?: LocalizedTextOptional
}

export interface ComparisonColumn {
  label: LocalizedText
  points: { id: string; title: LocalizedText; body: LocalizedText }[]
}

/**
 * Who is who in the process.
 *
 * Promoted from a field on `TextSectionBlock` to a block of its own, because
 * /why-organizer makes it the subject of a section rather than an aside.
 *
 * ── WHAT THE SHAPE FORBIDS ─────────────────────────────────────────────────
 *
 * `side` records which side of the table a party sits on. It is NOT a rank,
 * and the renderer must not draw an arrow from OpenDoor to any other party:
 * OpenDoor neither employs nor directs the lawyer, appraiser, architect or
 * developer, and a directional line would say it does.
 *
 * There is no field for a firm name, a logo or a link, because none of those
 * can appear without implying a relationship that does not exist.
 */
export interface RoleMapBlock extends BlockBase {
  type: 'ROLE_MAP'
  heading?: LocalizedTextOptional
  intro?: LocalizedTextOptional
  /** The owners and their representation. Rendered above the table line. */
  ownersSide: RoleNode[]
  /** OpenDoor. Rendered on the line itself. */
  organiser: RoleNode
  /** The other parties. Rendered below, as peers of one another. */
  parties: RoleNode[]
  /** Required note stating that OpenDoor does not replace independent
   *  professional advice. Not optional: the map invites exactly that
   *  misreading, and the correction belongs beside it rather than in a
   *  policy nobody opens. */
  independenceNote: LocalizedText
}

/**
 * One stage of the process, at page scale.
 *
 * ── `asks` IS WHY THIS TYPE EXISTS ─────────────────────────────────────────
 *
 * A process page that only says what the company does reads as a service
 * brochure. What an apartment owner actually wants to know is what THEY will
 * have to do. Every stage can state it, and the ones that ask nothing say so
 * by omitting the field rather than by inventing a task.
 *
 * ── NO PROGRESS, EVER ──────────────────────────────────────────────────────
 *
 * There is no `state` field. This is the company's process, not any project's
 * status, and marking a stage "current" here would be a claim about a real
 * building that nobody verified.
 */
export interface JourneyBlock extends BlockBase {
  type: 'JOURNEY'
  heading?: LocalizedTextOptional
  intro?: LocalizedTextOptional
  /**
   * REQUIRED. Stated before the stages, saying that projects differ in
   * planning route, ownership structure and timing, and that stages overlap.
   * Without it a numbered list of eight reads as a fixed statutory sequence.
   */
  variabilityNote: LocalizedText
  stages: JourneyStage[]
}

export interface JourneyStage {
  id: string
  title: LocalizedText
  body: LocalizedText
  /** What is asked of the owners at this stage. Absent where nothing is. */
  asks?: LocalizedTextOptional
  /** Slot id for a per-stage graphic. Falls back to the architectural mark. */
  slotId?: string
}

export interface MediaBlock extends BlockBase {
  type: 'MEDIA'
  heading?: LocalizedTextOptional
  assets: MediaAsset[]
  /**
   * Reference to a named slot in the site's image inventory.
   *
   * ── WHY A SLOT REFERENCE AND NOT JUST AN ASSET ─────────────────────────
   *
   * A slot carries the specification — ratio, crops, minimum resolution, what
   * the image may claim, what to avoid — independently of whether an asset
   * exists yet. That lets the page be designed, reviewed and shipped before
   * the photography is commissioned, and it means the eventual asset is
   * checked against a written brief rather than dropped in and hoped for.
   *
   * `assets` stays the direct-attachment path for images an editor uploads.
   * When both are present the slot wins, because the slot is the one with the
   * claim rules attached.
   */
  slotId?: string
  /** A short line rendered beside the band. Editorial framing for the image —
   *  never a caption substitute; the caption belongs to the asset. */
  caption?: LocalizedTextOptional
}

/**
 * Blocks that render server-driven collections.
 *
 * The editor chooses WHICH and HOW MANY, never the markup. A featured-projects
 * block REFERENCES projects rather than copying their content into the page, so
 * a project edited once is correct everywhere it appears.
 */
export interface CollectionBlock extends BlockBase {
  type: 'PROJECTS' | 'KNOWLEDGE' | 'FAQ' | 'EXTERNAL_RESOURCES'
  heading?: LocalizedTextOptional
  intro?: LocalizedTextOptional
  limit?: number
  /** Explicit slugs, or empty for "latest / featured". */
  itemSlugs?: string[]
}

/**
 * Editorial prose over a fixed layout.
 *
 * One interface for four block types because they differ only in how the items
 * are arranged — a grid, a numbered process, a stage timeline, a trust list.
 * Four near-identical interfaces would drift, and the layout belongs to the
 * renderer rather than to the content.
 */
export interface FeatureGridBlock extends BlockBase {
  type: 'FEATURE_GRID' | 'PROCESS' | 'PROJECT_TRANSPARENCY' | 'TRUST'
  heading: LocalizedText
  intro?: LocalizedTextOptional
  items: NarrativeItem[]
}

export interface NarrativeItem {
  id: string
  title: LocalizedText
  body: LocalizedText
  /**
   * Icon name from a fixed set, not an arbitrary upload. An editor who can
   * upload an icon per item produces a page with eight visual languages.
   */
  icon?: string
}

/**
 * Two audiences, side by side.
 *
 * Its own type rather than a FEATURE_GRID because the content is genuinely
 * two GROUPS of short items, not a flat list — every resident gets one set,
 * representatives get an additional set. Flattening it into a grid would lose
 * the distinction that is the entire point of the section.
 */
export interface PortalBlock extends BlockBase {
  type: 'PORTAL'
  heading: LocalizedText
  intro?: LocalizedTextOptional
  groups: PortalAudienceGroup[]
  ctaLabel?: LocalizedTextOptional
  ctaHref?: string
  /** Rendered as a qualifier near the heading when the capability is not yet
   *  live, so the section can describe what is being built without claiming it
   *  already works. */
  buildNotice?: LocalizedTextOptional
  /**
   * Content for the interface DEMONSTRATION rendered beside the two audience
   * groups. Optional and additive.
   *
   * ── WHY THE DEMO IS CONTENT, NOT A COMPONENT CONSTANT ──────────────────
   *
   * Every string a visitor sees inside the preview is copy an editor must be
   * able to change and translate, so it belongs here. It also has to be
   * possible to audit the demo's honesty by reading the content file — which
   * is impossible if the strings are buried in JSX.
   *
   * ── WHAT IT MUST NOT CONTAIN ────────────────────────────────────────────
   *
   * No real project name, no real address, no real resident. The demo shows a
   * SHAPE. `label` is required and must mark it as a demonstration wherever it
   * is rendered, so the frame can never be mistaken for a live account.
   */
  demo?: PortalDemo
}

export interface PortalDemo {
  /** Rendered as a persistent badge on the preview, e.g. "תצוגה לדוגמה". */
  label: LocalizedText
  /** Generic stand-in for the project name inside the demo, e.g. "הפרויקט שלי". */
  projectLabel: LocalizedText
  /** The demo timeline. `state` drives the shared MilestoneMarker. */
  stages: { id: string; title: LocalizedText; state: 'completed' | 'current' | 'upcoming' }[]
  /** Named panels — what changed, what is next, what is asked. */
  panels: { id: string; label: LocalizedText; value: LocalizedText }[]
  /** Tabs along the bottom of the frame. Labels only; the demo is not clickable
   *  through to anything, and must not pretend to be. */
  tabs: LocalizedText[]
  /** The representation layer, shown as a second view of the same frame. */
  representation?: {
    label: LocalizedText
    items: { id: string; label: LocalizedText; value: LocalizedText }[]
  }
}

export interface PortalAudienceGroup {
  id: string
  title: LocalizedText
  /** Who this group is for, e.g. "לכל בעלי הדירות". */
  audience: LocalizedText
  items: LocalizedText[]
}

export type PageBlock =
  | HeroBlock | TextSectionBlock | CtaBlock | MediaBlock
  | CollectionBlock | FeatureGridBlock | PortalBlock
  | PageHeaderBlock | StatementBlock | ProseBlock
  | ComparisonBlock | RoleMapBlock | JourneyBlock

/* ── Pages ─────────────────────────────────────────────────────────────── */

/**
 * A page is ONE record serving every locale, not one record per language.
 *
 * Its blocks carry `LocalizedText`, so translating is editing a key rather than
 * cloning a page — which also means the two languages cannot drift out of
 * structural sync, the usual failure of per-locale page rows.
 */
export interface CmsPage {
  id: string
  slug: string
  title: LocalizedText
  publishState: PublishState
  blocks: PageBlock[]
  /** SEO is per-locale: titles and descriptions are copy, and differ. */
  seo: Record<Locale, SeoMetadata>
  updatedAt: IsoDateTime
  updatedByName: string
}

/* ── Versioning (§54) ──────────────────────────────────────────────────── */

/**
 * A published version is never overwritten in place.
 *
 * §54 requires restore. That is impossible if publishing mutates the live row,
 * so each publish writes a new immutable version and moves a pointer. The cost
 * is storage; the benefit is that a bad edit is one click from being undone
 * rather than a request to reconstruct last week's copy from memory.
 */
export interface ContentVersion {
  id: string
  entityType: 'page' | 'project' | 'article' | 'faq'
  entityId: string
  versionNumber: number
  createdAt: IsoDateTime
  createdByName: string
  /** Editor-supplied note, e.g. "עדכון נוסח שלב 4". */
  label?: string
  isCurrent: boolean
}

export interface RestoreVersionInput {
  entityType: ContentVersion['entityType']
  entityId: string
  versionId: string
}

/* ── Navigation & footer (§33) ─────────────────────────────────────────── */

export interface NavItem {
  id: string
  label: LocalizedText
  href: string
  order: number
  children?: NavItem[]
}

export interface FooterGroup {
  id: string
  title: LocalizedText
  order: number
  links: NavItem[]
}

/* ── Forms (§50) ───────────────────────────────────────────────────────── */

export type FormFieldType =
  | 'text' | 'phone' | 'email' | 'number' | 'textarea'
  | 'select' | 'radio' | 'checkbox' | 'date' | 'file' | 'consent'

export interface FormField {
  id: string
  name: string
  type: FormFieldType
  label: string
  placeholder?: string
  helpText?: string
  required: boolean
  order: number
  /** For select/radio/checkbox. */
  options?: { value: string; label: string }[]
  /** Declarative only — regex/min/max. Validation runs on BOTH sides; the
   *  client copy is for immediate feedback, never for trust. */
  validation?: { pattern?: string; min?: number; max?: number; maxLength?: number }
}

export interface CmsForm {
  id: string
  slug: string
  title: string
  description?: string
  fields: FormField[]
  submitLabel: string
  successMessage: string
}

/* ── Media library (§34) ───────────────────────────────────────────────── */

export interface MediaLibraryItem extends MediaAsset {
  fileName: string
  fileSizeBytes: number
  mimeType: string
  uploadedAt: IsoDateTime
  /** Free-form grouping used by GalleryManagerDnd's project/category
   *  association. */
  tags: string[]
  projectSlug?: string
}

/** Order is content, so reordering is a first-class operation. @phase2 */
export interface ReorderMediaInput {
  galleryId: string
  /** Full ordered id list, not a delta — a delta cannot express the result of
   *  a drag that crossed several positions, and two concurrent deltas produce
   *  an order neither editor intended. */
  orderedIds: string[]
}
