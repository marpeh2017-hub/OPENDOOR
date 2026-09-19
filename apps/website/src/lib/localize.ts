import type {
  Locale, LocalizedContent, LocalizedText, LocalizedTextOptional,
} from '@urban-renewal/api-contracts'
import { resolveContent, resolveLocalized } from '@urban-renewal/api-contracts'

/**
 * Binds the localisation policy to one locale for a whole page render.
 *
 * Called ONCE at the page boundary. Everything below receives plain strings, so
 * no block component ever imports a locale, reads a localised value, or
 * branches on language — the rule that keeps component logic from being
 * duplicated per language.
 *
 * ── TWO KINDS OF TEXT, TWO METHODS ─────────────────────────────────────────
 *
 * `t(value)` resolves `LocalizedText`: the site's own fixed copy, where both
 * languages were written by us and a missing half is a bug.
 *
 * `t.text()` and `t.translated()` resolve `LocalizedContent`: editor-authored
 * text where Hebrew is the source and English is optional. They differ only in
 * what happens when English is missing, and the choice is per field rather than
 * global, because both answers are wrong somewhere:
 *
 *   t.text()        SOURCE. Returns the Hebrew. For a name, a city, a card
 *                   summary, an image caption. A Hebrew phrase in an English
 *                   sentence reads as untranslated; an empty card reads as
 *                   broken.
 *
 *   t.translated()  OMIT. Returns undefined, and the caller drops the section.
 *                   For a project overview or an article body. Three Hebrew
 *                   paragraphs under an English heading serve nobody.
 *
 * `PROJECT_TEXT_FALLBACK` in the contracts package records which field takes
 * which, and the CMS reads the same map to warn its editors.
 */
export function makeLocalizer(locale: Locale) {
  const t = (value: LocalizedText | LocalizedTextOptional | undefined): string =>
    resolveLocalized(value, locale)

  /** SOURCE policy. Always a string for a value that exists. */
  t.text = (value: LocalizedContent | undefined): string =>
    resolveContent(value, locale, 'SOURCE') ?? ''

  /** OMIT policy. Undefined when no approved English exists. */
  t.translated = (value: LocalizedContent | undefined): string | undefined =>
    resolveContent(value, locale, 'OMIT')

  return t
}

export type Localizer = ReturnType<typeof makeLocalizer>
