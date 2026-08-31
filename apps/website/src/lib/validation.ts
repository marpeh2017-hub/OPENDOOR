/**
 * Form validation.
 *
 * ── VALIDATION RUNS ON SUBMIT, NEVER ON KEYSTROKE ──────────────────────────
 *
 * These functions are called once, when a submit is attempted. Validating
 * while someone types tells them their phone number is invalid after the third
 * digit, which is both true and useless. The forms re-validate a field once it
 * has already failed, so a correction clears the error immediately — that is
 * the one case where live feedback helps.
 */

export type ValidationErrors<T extends string> = Partial<Record<T, string>>

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  PHONE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── THE RULE: NEVER REJECT A VALID NUMBER FOR ITS FORMATTING ───────────────
 *
 * People write Israeli numbers as `050-123-4567`, `050 1234567`, `0501234567`,
 * `+972 50 123 4567` and `972501234567`. Every one of those is the same
 * number, and a form that accepts only one of them is broken in a way its
 * author never notices because they type it the way they built it.
 *
 * So: strip everything that is not a digit or a leading `+`, then check the
 * digit count. Formatting is discarded before it is ever judged.
 *
 * ── WHAT IS DELIBERATELY NOT CHECKED ───────────────────────────────────────
 *
 * No prefix whitelist (`050`, `052`, `054`...). Carrier prefixes change, and a
 * whitelist that falls behind rejects real customers with new numbers. Length
 * and shape are enough to catch the mistakes that actually happen — a missing
 * digit or a half-typed number — and the rest is the CRM's problem when
 * somebody dials it.
 */

/** Digits only, with an international prefix normalised to a leading `0`. */
export function normalisePhone(input: string): string {
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, '')

  // +972 50 123 4567 / 00972... / 972... → 050 123 4567
  if (trimmed.startsWith('+972') || digits.startsWith('972')) {
    const national = digits.replace(/^(00)?972/, '')
    return national.startsWith('0') ? national : `0${national}`
  }

  return digits
}

export function isValidPhone(input: string): boolean {
  const normalised = normalisePhone(input)

  // Israeli numbers are 9 digits (landline, e.g. 02-1234567) or 10 (mobile,
  // e.g. 050-1234567), and both start with 0 once normalised.
  if (!/^0\d{8,9}$/.test(normalised)) return false
  return true
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  EMAIL
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A deliberately loose check: something, an `@`, something with a dot. The
 * strict RFC pattern is famously enormous and rejects addresses that work,
 * and email is OPTIONAL on both forms — the cost of wrongly rejecting a valid
 * address is losing a lead, while the cost of accepting a typo is one bounced
 * message. The asymmetry decides it.
 */
export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim())
}

/** Trimmed, and non-empty after trimming. Whitespace is not an answer. */
export function isPresent(input: string): boolean {
  return input.trim().length > 0
}

/**
 * An approximate apartment count.
 *
 * Optional, so an empty value is valid. When present it must be a positive
 * whole number within a range that is plausible for a residential complex —
 * wide enough not to argue with a real answer, narrow enough to catch a
 * mistyped phone number in the wrong box.
 */
export function isValidApartmentCount(input: string): boolean {
  if (!isPresent(input)) return true
  const value = Number(input.trim())
  return Number.isInteger(value) && value > 0 && value <= 2000
}
