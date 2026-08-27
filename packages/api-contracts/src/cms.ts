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
  | 'TEXT_SECTION'
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
  'HERO', 'TEXT_SECTION', 'FEATURE_GRID', 'PROCESS', 'PROJECTS',
  'PROJECT_TRANSPARENCY', 'TRUST', 'PORTAL', 'KNOWLEDGE', 'FAQ',
  'EXTERNAL_RESOURCES', 'CTA', 'MEDIA',
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
}

export interface CtaBlock extends BlockBase {
  type: 'CTA'
  heading: LocalizedText
  body?: LocalizedTextOptional
  ctaLabel: LocalizedText
  ctaHref: string
}

export interface MediaBlock extends BlockBase {
  type: 'MEDIA'
  heading?: LocalizedTextOptional
  assets: MediaAsset[]
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
