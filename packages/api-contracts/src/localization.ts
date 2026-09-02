import type { Locale, LocalizedContent } from './common'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE LOCALISATION POLICY FOR EDITOR-AUTHORED CONTENT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `LocalizedContent` itself is declared in `common.ts` (the base module cannot
 * import upward). Everything that decides what to DO with a missing English
 * value lives here: the fallback vocabulary, the resolver, and the per-field
 * policy the CMS drives its own warnings from.
 */

/**
 * What to do when an English value is missing and English is being rendered.
 *
 * ── WHY THIS IS PER FIELD AND NOT ONE GLOBAL RULE ──────────────────────────
 *
 * Both answers are wrong somewhere:
 *
 * Always falling back to Hebrew turns a long untranslated article into a page
 * that claims to be English and is not, which is worse than not offering it.
 *
 * Always omitting drops a project's name and city from the English site, which
 * leaves a card with no title. A Hebrew name on an English page is not a
 * defect — it is what the complex is actually called.
 *
 * So the policy travels with the field.
 */
export type LocalizationFallback =
  /**
   * Render the Hebrew. Correct for short, identifying or structural values:
   * a name, a city, a one-line summary, an image caption. The reader sees a
   * Hebrew phrase in an English sentence, understands it is untranslated, and
   * loses nothing.
   */
  | 'SOURCE'
  /**
   * Render nothing, and let the section disappear. Correct for long-form
   * editorial: a project overview, an article body, an FAQ answer. A reader
   * who wanted English is better served by an absent section than by three
   * paragraphs of Hebrew under an English heading.
   */
  | 'OMIT'

/**
 * Resolve authored text for display.
 *
 * Returns `undefined` only under `OMIT`, and the caller is expected to drop
 * the surrounding element when it does. `SOURCE` never returns undefined for a
 * value that exists, because `he` is required.
 */
export function resolveContent(
  value: LocalizedContent | undefined,
  locale: Locale,
  fallback: LocalizationFallback,
): string | undefined {
  if (!value) return undefined
  if (locale === 'he') return value.he
  if (value.en !== undefined && value.en !== '') return value.en
  return fallback === 'SOURCE' ? value.he : undefined
}

/** Does this value have an approved English rendering? */
export function hasEnglish(value: LocalizedContent | undefined): boolean {
  return Boolean(value && value.en !== undefined && value.en !== '')
}

/**
 * The fallback policy for every localised field on a project.
 *
 * ── EXPORTED AS DATA, NOT AS DOCUMENTATION ─────────────────────────────────
 *
 * The CMS reads this to decide what to tell an editor: which fields will show
 * Hebrew on the English site if left untranslated, and which will simply
 * vanish. Restating the policy in a form would create two definitions, and the
 * one that drifts is always the one nobody looks at.
 *
 * ── FIELDS DELIBERATELY ABSENT FROM THIS MAP ───────────────────────────────
 *
 * `location.street`, `ProjectParty.name` and `MediaAsset.credit` stay plain
 * strings. A street address, a company's registered name and a photographer's
 * name are written once and are not translated. Giving them a language pair
 * would invite somebody to fill the English side with a transliteration, which
 * is precisely what the brief forbids: "HaHida 26" is a spelling nobody uses,
 * that matches no municipal record and that no resident would search for.
 */
export const PROJECT_TEXT_FALLBACK = {
  name: 'SOURCE',
  'location.city': 'SOURCE',
  'location.neighborhood': 'SOURCE',
  summary: 'SOURCE',
  description: 'OMIT',
  role: 'OMIT',
  timelineNote: 'OMIT',
  'media.alt': 'SOURCE',
  'media.caption': 'SOURCE',
  'approval.label': 'SOURCE',
  'approval.authority': 'SOURCE',
  'milestone.title': 'SOURCE',
  'milestone.note': 'OMIT',
  'dateRecord.label': 'SOURCE',
} as const satisfies Record<string, LocalizationFallback>

export type LocalizedProjectField = keyof typeof PROJECT_TEXT_FALLBACK
