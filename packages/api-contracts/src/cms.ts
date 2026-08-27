import type { IsoDateTime, Locale, MediaAsset, PublishState, SeoMetadata } from './common'

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
  | 'WHY_ORGANIZER'
  | 'SERVICES'
  | 'HOW_WE_WORK'
  | 'PROJECTS'
  | 'PROJECT_TRANSPARENCY'
  | 'TRUST_CENTER'
  | 'KNOWLEDGE'
  | 'FAQ'
  | 'EXTERNAL_RESOURCES'
  | 'CTA'
  | 'RICH_TEXT'
  | 'MEDIA'

export interface BlockBase {
  id: string
  type: BlockType
  order: number
  /** Hidden blocks stay in the page and keep their content (§31 hide/show). */
  hidden: boolean
}

export interface HeroBlock extends BlockBase {
  type: 'HERO'
  heading: string
  subheading?: string
  primaryCtaLabel: string
  primaryCtaHref: string
  secondaryCtaLabel?: string
  secondaryCtaHref?: string
  media?: MediaAsset
}

export interface RichTextBlock extends BlockBase {
  type: 'RICH_TEXT'
  heading?: string
  /** Constrained markup: headings, paragraphs, lists, links, emphasis.
   *  No inline styles, no raw HTML, no script. */
  body: string
}

export interface CtaBlock extends BlockBase {
  type: 'CTA'
  heading: string
  body?: string
  ctaLabel: string
  ctaHref: string
}

export interface MediaBlock extends BlockBase {
  type: 'MEDIA'
  heading?: string
  assets: MediaAsset[]
}

/**
 * Blocks that render server-driven collections.
 *
 * The editor chooses WHICH and HOW MANY, never the markup — a "featured
 * projects" block reads real projects rather than duplicating their content
 * into the page, so a project edited once is correct everywhere.
 */
export interface CollectionBlock extends BlockBase {
  type: 'PROJECTS' | 'KNOWLEDGE' | 'FAQ' | 'EXTERNAL_RESOURCES'
  heading?: string
  intro?: string
  limit?: number
  /** Explicit slugs, or empty for "latest/featured". */
  itemSlugs?: string[]
}

/** Blocks whose content is editorial prose over a fixed layout. */
export interface NarrativeBlock extends BlockBase {
  type: 'WHY_ORGANIZER' | 'SERVICES' | 'HOW_WE_WORK' | 'PROJECT_TRANSPARENCY' | 'TRUST_CENTER'
  heading: string
  intro?: string
  items: NarrativeItem[]
}

export interface NarrativeItem {
  id: string
  title: string
  body: string
  /** Icon name from a fixed set — not an arbitrary upload, so the visual
   *  language stays consistent. */
  icon?: string
}

export type PageBlock =
  | HeroBlock | RichTextBlock | CtaBlock | MediaBlock
  | CollectionBlock | NarrativeBlock

/* ── Pages ─────────────────────────────────────────────────────────────── */

export interface CmsPage {
  id: string
  slug: string
  title: string
  locale: Locale
  publishState: PublishState
  blocks: PageBlock[]
  seo: SeoMetadata
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
  label: string
  href: string
  order: number
  children?: NavItem[]
}

export interface FooterGroup {
  id: string
  title: string
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
