import type { Locale, LocalizedText, LocalizedTextOptional } from '@urban-renewal/api-contracts'
import { resolveLocalized } from '@urban-renewal/api-contracts'

/**
 * Binds `resolveLocalized` to one locale for a whole page render.
 *
 * Called ONCE at the page boundary. Everything below receives plain strings, so
 * no block component ever imports a locale, reads `LocalizedText`, or branches
 * on language — which is the rule that keeps component logic from being
 * duplicated per language.
 */
export function makeLocalizer(locale: Locale) {
  return (value: LocalizedText | LocalizedTextOptional | undefined): string =>
    resolveLocalized(value, locale)
}

export type Localizer = ReturnType<typeof makeLocalizer>
