import type {
  ImageClaim, IsoDateTime, Locale, LocalizedContent, SeoMetadata,
} from './common'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE SITE MANAGER'S DOMAIN. TYPES ONLY.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Nothing here is persisted yet. No table, no migration, no endpoint. This is
 * the vocabulary the CMS will be built from, written down first so the shell,
 * the website and the eventual API agree before any of them is implemented.
 *
 * The rule this file exists to hold: `PublicProject` is what a VISITOR
 * receives, and it is not the shape an EDITOR works with. An editor sees
 * publication state, revisions, verification records, internal data and
 * feasibility. A visitor sees none of that. Keeping the two apart at the type
 * level is what stops the second from leaking into the first.
 */

/* ── EXPOSURE ───────────────────────────────────────────────────────────── */

/**
 * How far a piece of information is allowed to travel.
 *
 * The three levels from the design gate, as a type rather than a convention.
 * Every editable region in the CMS declares one, and the UI derives its
 * background, its label and its icon from it — three signals, so the
 * distinction survives colourblindness and a black-and-white printout.
 */
export type ExposureLevel =
  /** May reach the website, once verified and once the item is published. */
  | 'PUBLIC'
  /** Real, and never published. Boundary, registry detail, internal notes. */
  | 'INTERNAL'
  /** A modelled scenario. Cannot become a public fact even after verification. */
  | 'FEASIBILITY'

/**
 * Publishing acts on `PUBLIC` regions only.
 *
 * Stated as a function rather than left implicit because the dangerous
 * operation is the generic one: any helper that maps "an item" to "its public
 * form" without consulting exposure is the accident this whole separation
 * exists to prevent. There is deliberately no `publishAll`.
 */
export function isPublishableExposure(level: ExposureLevel): boolean {
  return level === 'PUBLIC'
}

/* ── CONTENT ITEMS ──────────────────────────────────────────────────────── */

export type CmsContentKind = 'PAGE' | 'PROJECT' | 'ARTICLE' | 'FAQ_ITEM' | 'NAVIGATION' | 'SETTINGS'

/**
 * Where an item stands in the world.
 *
 * ── PUBLICATION IS NOT VERIFICATION ────────────────────────────────────────
 *
 * These four describe the ITEM. `VerificationStatus` describes a FIELD inside
 * it. A published project may contain an unverified figure; the figure simply
 * does not render. Conflating them would mean one unchecked number blocks a
 * whole page, which pushes people to verify carelessly to get unblocked.
 */
export type PublicationState = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED'

/** Reaches the public website. */
export function isLive(state: PublicationState): boolean {
  return state === 'PUBLISHED'
}

/**
 * The editorial envelope every CMS item carries.
 *
 * Generic over the item's own content so a page, a project and an article
 * share one state machine, one revision history and one audit trail without
 * sharing their fields.
 */
export interface CmsContentItem<TContent> {
  id: string
  kind: CmsContentKind
  /** URL segment. Shown to editors as "the address", never as "slug". */
  slug: string

  state: PublicationState
  content: TContent

  /** Per-locale. Absent for a locale means the item inherits site defaults. */
  seo?: Partial<Record<Locale, SeoMetadata>>

  createdAt: IsoDateTime
  createdByUserId: string
  updatedAt: IsoDateTime
  updatedByUserId: string
  /** Absent means never published, which is different from unpublished. */
  publishedAt?: IsoDateTime
  publishedByUserId?: string

  /** Points at the revision currently live, so "what does the public see" is
   *  answerable without replaying history. */
  publishedRevisionId?: string
  currentRevisionId: string
}

/* ── REVISIONS ──────────────────────────────────────────────────────────── */

/**
 * One saved state of an item.
 *
 * ── FULL SNAPSHOTS, NOT DELTAS ─────────────────────────────────────────────
 *
 * A page is a few kilobytes. A snapshot is read and restored without replaying
 * a chain, and it cannot be corrupted by one bad link in the middle. Deltas
 * would save storage nobody is short of and add a failure mode.
 *
 * `PUBLISH` revisions are never thinned. They are the record of what the
 * public could see at a given moment, which is the question an archived
 * revision exists to answer.
 */
export interface CmsRevision<TContent> {
  id: string
  itemId: string
  /** Monotonic per item. Human-facing as "version 14". */
  sequence: number

  reason: 'SAVE' | 'PUBLISH' | 'UNPUBLISH' | 'RESTORE'
  /** Complete content at this point. */
  snapshot: TContent
  stateAtRevision: PublicationState

  authorUserId: string
  createdAt: IsoDateTime
  /** Set when this revision was produced by restoring an earlier one. */
  restoredFromRevisionId?: string
  /** Short editor-facing summary, e.g. "נוסח מחדש משפט פתיחה". */
  summary?: string
}

/* ── MEDIA ──────────────────────────────────────────────────────────────── */

/**
 * A file in the media library.
 *
 * `classification` reuses `ImageClaim` rather than introducing a parallel
 * vocabulary: the truth system the website already enforces is the same one
 * the CMS must present, and a second enum would let them disagree.
 *
 * `classification` and `alt` are both REQUIRED. An unclassified image has no
 * safe default — guessing `EDITORIAL_CONTEXT` captions a real project photo as
 * not-the-project, and guessing the other way is worse — so an image without
 * one is simply not publishable.
 */
export interface CmsMediaItem {
  id: string
  /** Storage key. Never a public URL, and never constructible by a client. */
  storageKey: string
  filename: string
  mimeType: string
  sizeBytes: number
  width?: number
  height?: number

  classification: ImageClaim
  alt: LocalizedContent
  caption?: LocalizedContent
  /** Photographer or licence holder. A name; not translated. */
  credit?: string
  takenOn?: string
  focalPoint?: { x: number; y: number }

  uploadedByUserId: string
  uploadedAt: IsoDateTime
}

/**
 * Where a media item is in use.
 *
 * Computed, never stored: a stale usage list is worse than none, because it is
 * consulted precisely when somebody is about to delete something. It exists so
 * the CMS can answer "what breaks if I remove this" before the removal, rather
 * than after.
 */
export interface CmsMediaUsage {
  mediaId: string
  usages: { itemId: string; itemLabel: string; where: string }[]
}

/* ── PERMISSIONS ────────────────────────────────────────────────────────── */

/**
 * CMS roles, deliberately separate from `UserRole`.
 *
 * ── WHY NOT EXTEND `UserRole` ──────────────────────────────────────────────
 *
 * That enum has thirteen values describing roles in an urban-renewal project:
 * lawyer, architect, municipality user, resident. They answer "what is this
 * person to the project", not "may this person publish to the company's public
 * website". Adding four more values would mix two unrelated authority models
 * in one field, and the first accident is a consultant inheriting edit rights
 * because somebody widened a check.
 *
 * A CMS role is granted per user, mapped from the existing role as a default.
 */
export type CmsRole = 'ADMIN' | 'EDITOR' | 'VERIFIER' | 'VIEWER'

export type CmsCapability =
  | 'content.read'
  | 'content.edit'
  | 'content.submitForReview'
  | 'content.publish'
  | 'content.restoreRevision'
  | 'internal.read'
  | 'internal.edit'
  | 'feasibility.read'
  | 'feasibility.readEconomics'
  | 'fact.review'
  | 'fact.verify'
  | 'media.manage'
  | 'settings.manage'

/**
 * What each role may do.
 *
 * ── THE AMENDED SELF-VERIFICATION POLICY ───────────────────────────────────
 *
 * `content.edit` and `fact.verify` remain SEPARATE capabilities, and most
 * editors will not hold the second. But a user who holds both may verify a
 * value they edited: the result is recorded as `SELF_VERIFIED` rather than
 * refused.
 *
 * The earlier design forbade it outright. That was wrong for a small
 * organisation, where the rule's practical effect would be a shared login —
 * which destroys the audit trail rather than merely annotating it. Recording
 * what happened beats prohibiting what will happen anyway.
 */
export const CMS_ROLE_CAPABILITIES: Record<CmsRole, readonly CmsCapability[]> = {
  ADMIN: [
    'content.read', 'content.edit', 'content.submitForReview', 'content.publish',
    'content.restoreRevision', 'internal.read', 'internal.edit',
    'feasibility.read', 'feasibility.readEconomics',
    'fact.review', 'fact.verify', 'media.manage', 'settings.manage',
  ],
  EDITOR: [
    'content.read', 'content.edit', 'content.submitForReview',
    'content.restoreRevision', 'internal.read', 'internal.edit',
    'fact.review', 'media.manage',
  ],
  VERIFIER: ['content.read', 'fact.review', 'fact.verify'],
  VIEWER: ['content.read'],
}

export function can(role: CmsRole, capability: CmsCapability): boolean {
  return CMS_ROLE_CAPABILITIES[role].includes(capability)
}

/**
 * Fact categories that may later demand a second signature.
 *
 * Empty in V1, and that is the point: the mechanism exists, nothing uses it,
 * and switching it on for a category is a change to this list rather than a
 * change to the verification logic. See `deriveVerificationStatus`.
 */
export const SECOND_REVIEW_FIELDS: readonly string[] = []

export function requiresSecondReview(field: string): boolean {
  return SECOND_REVIEW_FIELDS.includes(field)
}
