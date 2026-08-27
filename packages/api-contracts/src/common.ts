/**
 * Shared vocabulary for every OpenDoor surface.
 *
 * ── WHAT THIS PACKAGE IS ───────────────────────────────────────────────────
 *
 * TYPES, plus exactly one runtime value. No fetch, no Zod, no third-party
 * dependency. It exists so the website, the resident portal and (eventually)
 * the CRM describe the same data with the same words — not so they share a
 * client. Each app keeps its own transport, because their auth models genuinely
 * differ.
 *
 * THE ONE RUNTIME EXPORT is `PROJECT_STAGE_ORDER` in `./public`. The order of
 * the eleven urban-renewal stages is domain truth, not presentation: the public
 * timeline, the resident timeline and the representation milestones all render
 * that sequence, and three private copies would drift. It is a frozen array of
 * string literals — a few bytes, no imports.
 *
 * ── RELATIONSHIP TO THE BACKEND ────────────────────────────────────────────
 *
 * These contracts describe the SHAPE the frontend needs. Several describe data
 * the API Gateway does not expose yet; those carry `@phase2`. Nothing here
 * obliges a schema change, and nothing here is authorisation.
 */

/** Supported locales. Hebrew is the default and the only complete one today. */
export type Locale = 'he' | 'en'

/**
 * Who may see a thing.
 *
 * ⚠ THIS IS PRESENTATION, NOT AUTHORISATION.
 *
 * The frontend uses it to decide what to RENDER. It never decides what a user
 * is entitled to: a field the browser hides is a field the browser still
 * received. Every one of these levels is enforced server-side in Phase 2, and
 * the frontend must be written so that a wrong value here produces an ugly
 * screen, never a leak.
 *
 * Ordered from least to most restricted.
 */
export type Visibility =
  | 'public'
  | 'residents_only'
  | 'representatives_only'
  | 'internal'

/** Audience the current viewer belongs to. Mirrors Visibility, minus 'public'. */
export type ViewerRole = 'guest' | 'resident' | 'representative' | 'internal'

/** Publication state, independent of visibility: a public page can be a draft. */
export type PublishState = 'draft' | 'published' | 'archived'

/**
 * A string that exists in every supported locale.
 *
 * ── WHY A MAP RATHER THAN ONE FIELD PER LANGUAGE ───────────────────────────
 *
 * The alternative shapes both fail. `titleHe` / `titleEn` sibling fields mean
 * every consumer writes a conditional, and adding a locale edits every model.
 * A single `title` resolved server-side means the CMS cannot show an editor
 * both languages side by side, which is exactly what translating requires.
 *
 * A map keyed by locale keeps both languages together in the content model and
 * lets the UI resolve once, at the edge, via `resolveLocalized`. Components
 * below that point receive plain strings and never branch on language — which
 * is the requirement that component logic must not be duplicated per language.
 */
export type LocalizedText = Record<Locale, string>

/** Optional localized text: absent means "not supplied in any language". */
export type LocalizedTextOptional = Partial<Record<Locale, string>>

/**
 * Resolve a localized value for display.
 *
 * Falls back to Hebrew — the primary language — rather than to an empty string,
 * so a page missing an English translation shows Hebrew rather than a blank
 * region. A blank region reads as a broken page; Hebrew reads as untranslated,
 * which is the truth.
 */
export function resolveLocalized(
  value: LocalizedText | LocalizedTextOptional | undefined,
  locale: Locale,
  fallbackLocale: Locale = 'he',
): string {
  if (!value) return ''
  return value[locale] ?? value[fallbackLocale] ?? ''
}

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

/**
 * Error envelope.
 *
 * `code` is the stable, machine-readable discriminator; `message` is
 * user-facing Hebrew and may change without notice. Frontends branch on `code`
 * and never on `message` — the existing gateway already answers this way
 * (`TEMPLATE_IN_USE`, `WEBHOOK_HOST_INTERNAL`, and so on).
 */
export interface ApiError {
  code: string
  message: string
  /** Field-level errors, keyed by form field path. */
  fields?: Record<string, string>
}

/** ISO-8601 timestamp. Kept as a string: JSON has no date type, and parsing
 *  belongs at the edge of the app, not in the contract. */
export type IsoDateTime = string
export type IsoDate = string

export interface SeoMetadata {
  title: string
  description: string
  /** Absolute or root-relative. Used for Open Graph and Twitter cards. */
  socialImageUrl?: string
  canonicalUrl?: string
  noIndex?: boolean
}

export interface MediaAsset {
  id: string
  kind: 'image' | 'video'
  url: string
  /** REQUIRED for images — WCAG 2.1 AA. An empty string is the correct value
   *  for purely decorative media, and is different from omitting it. */
  alt: string
  caption?: string
  width?: number
  height?: number
  /** Poster frame for video. Videos must never autoplay with sound. */
  posterUrl?: string
}

/** A place, used by projects and by local SEO. */
export interface GeoContext {
  city: string
  neighborhood?: string
  street?: string
  /** גוש/חלקה. Present only where already public. */
  block?: string
  parcel?: string
  lat?: number
  lng?: number
}
