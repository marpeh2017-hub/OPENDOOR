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

/**
 * Publication state, independent of visibility: a public page can be a draft.
 *
 * ── THE EDITORIAL WORKFLOW ─────────────────────────────────────────────────
 *
 *   draft  →  review  →  published        (and published → archived)
 *
 * `review` exists so that "somebody other than the author has read this"
 * is a recorded state rather than a habit. It is the mechanism for ordinary
 * editorial correctness — typos, clumsy sentences, bad crops — and it is
 * deliberately the ONLY mechanism most fields need.
 *
 * Material factual claims do not use this workflow. They carry their own
 * verification, which the type system enforces separately; see
 * `VerifiedFact` in `verification.ts` for why the two are kept apart.
 *
 * ── ONLY `published` IS PUBLIC ─────────────────────────────────────────────
 *
 * `draft`, `review` and `archived` all render nowhere on the public site.
 * A record in `review` is finished content awaiting a second pair of eyes,
 * not a soft-launched one.
 */
export type PublishState = 'draft' | 'review' | 'published' | 'archived'

/** The states that never reach a public page. Exported so the filter that
 *  enforces it cannot drift from the type. */
export const NON_PUBLIC_STATES: readonly PublishState[] = ['draft', 'review', 'archived']

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
 * Editor-authored text, where Hebrew is the source and English is optional.
 *
 * Distinct from `LocalizedText`, which requires BOTH languages and is correct
 * for the site's own fixed copy: we wrote it twice, so a missing half is a bug.
 *
 * It is wrong for anything an editor types. Requiring English there means a
 * Hebrew sentence cannot be SAVED until somebody translates it, and the real
 * outcomes are a blocked editor or a machine translation nobody approved.
 *
 * The per-field fallback policy, and the resolver that applies it, live in
 * `localization.ts`. The type lives here because `common.ts` is the base module
 * and importing upward would make the dependency circular.
 */
export interface LocalizedContent {
  /** The source. Always present. */
  he: string
  /** An approved English rendering. Never derived, never transliterated. */
  en?: string
}

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

/**
 * What an image is ALLOWED TO CLAIM.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THIS IS A TRUTH CONTROL, NOT A STYLE HINT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A photograph placed under a project's name asserts, in pictures, that the
 * photograph IS that project. It is the easiest untrue claim to publish by
 * accident and the hardest for a reader to detect — nobody fact-checks a
 * picture. So the claim an image makes is made explicit and required, and the
 * renderer treats each value differently:
 *
 *   VERIFIED_PROJECT_PHOTO   Depicts the specific project it appears with, and
 *                            somebody has confirmed that. ONLY this value may
 *                            be shown as a project's own image.
 *   EDITORIAL_CONTEXT        A real photograph of a real place that is NOT the
 *                            subject it appears beside — city fabric, the
 *                            Chords Bridge, the light rail. It must never sit
 *                            inside a project card, and it is always rendered
 *                            with a visible caption saying what it actually
 *                            shows, so the reader is never left to assume.
 *   ARCHITECTURAL_PATTERN    A generated OpenDoor graphic. Claims nothing,
 *                            because it is visibly not a photograph.
 *
 * A missing `imageType` is not a default — it is a bug, and the renderer
 * refuses to present such an image as project-specific.
 */
export type ImageClaim = 'VERIFIED_PROJECT_PHOTO' | 'EDITORIAL_CONTEXT' | 'ARCHITECTURAL_PATTERN'

export interface MediaAsset {
  id: string
  kind: 'image' | 'video'
  url: string
  /** REQUIRED for images — WCAG 2.1 AA. An empty `he` is the correct value
   *  for purely decorative media, and is different from omitting the field.
   *  Localised with a `SOURCE` fallback: a Hebrew description read aloud by a
   *  screen reader on the English site is far better than silence. */
  alt: LocalizedContent
  caption?: LocalizedContent
  width?: number
  height?: number
  /** Poster frame for video. Videos must never autoplay with sound. */
  posterUrl?: string
  /**
   * What this image is permitted to claim. See `ImageClaim`.
   *
   * Optional on the type only because `MediaAsset` predates it and video has
   * no use for it; every IMAGE the website renders must carry one, and the
   * renderer degrades to the non-claiming presentation when it is absent.
   */
  imageType?: ImageClaim
  /** Photographer or licence attribution, rendered wherever the licence
   *  requires it. Separate from `caption`: a credit is a legal obligation,
   *  a caption is editorial.
   *
   *  A plain string, not localised: it is a person's or an agency's name. */
  credit?: string
  /**
   * Subject position as percentages, for `object-position`. Urban photography
   * cropped to a wide band loses its subject to a centre crop far more often
   * than not — a building's entrance is rarely in the middle of the frame.
   */
  focalPoint?: { x: number; y: number }
  /**
   * Position within a gallery. A NUMBER, not the array index.
   *
   * Array order is an accident of however the data was assembled; an editor
   * who drags an image to the front is expressing an intent that has to
   * survive a re-fetch, a partial update and a different sort upstream.
   * Renderers sort by this and fall back to array order when it is absent.
   */
  order?: number
  /**
   * When the photograph was taken.
   *
   * Separate from anything editorial because it is the field that makes a
   * project photo honest: a facade shot from four years ago is not evidence
   * of what the complex looks like now, and a caption cannot be trusted to
   * carry that on its own.
   */
  takenOn?: IsoDate
}

/** A place, used by projects and by local SEO. */
export interface GeoContext {
  /**
   * ── LOCALISED, BECAUSE A CITY GENUINELY HAS TWO NAMES ────────────────
   *
   * ירושלים has an established English form that a reader of the English
   * site expects. The fallback is `SOURCE`: with no English supplied the
   * Hebrew renders, which reads as untranslated rather than as missing.
   */
  city: LocalizedContent
  neighborhood?: LocalizedContent
  /**
   * The street line, in the source language only.
   *
   * NOT localised, deliberately. An address is written once, it matches a
   * municipal record, and the only thing an English field here would attract
   * is a transliteration nobody uses and nothing matches.
   */
  street?: string
  /** גוש/חלקה. Present only where already public. */
  block?: string
  parcel?: string
  lat?: number
  lng?: number
}
