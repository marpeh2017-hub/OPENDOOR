/**
 * Israeli phone normalisation to E.164.
 *
 * A resident's phone is typed by a field agent into a CRM, imported from an
 * Excel sheet a lawyer maintained, or copied off a signed form. It arrives as
 * `050-123-4567`, `+972 50 1234567`, `972501234567`, `0501234567 (בן)`. Every
 * one of those is the same number and every provider wants exactly one of them.
 *
 * Normalising at SEND time rather than at import time is deliberate: rewriting
 * the stored value would destroy what the resident actually wrote down, which
 * matters when someone later disputes which number they gave.
 */

const IL_COUNTRY = '972'

/** Israeli mobile prefixes (national form, after the leading 0). */
const IL_MOBILE_PREFIXES = ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59']

export interface NormalisedPhone {
  /** E.164, e.g. `+972501234567`. Null when the input is unusable. */
  e164: string | null
  /** True when the number is an Israeli MOBILE line (SMS/WhatsApp capable). */
  isMobile: boolean
  reason?: string
}

export function normaliseIsraeliPhone(raw: string | null | undefined): NormalisedPhone {
  if (!raw) return { e164: null, isMobile: false, reason: 'empty' }

  // Keep a leading + if present, drop every other non-digit (spaces, dashes,
  // parentheses, and the Hebrew annotations people put in these fields).
  const trimmed = raw.trim()
  const hadPlus = trimmed.startsWith('+')
  let digits = trimmed.replace(/\D/g, '')

  if (!digits) return { e164: null, isMobile: false, reason: 'no digits' }

  // 00 international prefix → +
  if (!hadPlus && digits.startsWith('00')) digits = digits.slice(2)

  let national: string
  if (digits.startsWith(IL_COUNTRY) && digits.length >= 11) {
    national = digits.slice(IL_COUNTRY.length)
  } else if (digits.startsWith('0')) {
    national = digits.slice(1)
  } else if (hadPlus) {
    // A genuine foreign number. Pass it through — some owners live abroad —
    // but we cannot judge whether it is a mobile.
    return {
      e164: `+${digits}`,
      isMobile: false,
      reason: 'non-Israeli number; mobile capability unknown',
    }
  } else {
    national = digits
  }

  /*
   * Israeli national numbers are NOT a single length:
   *   - mobile        9 digits, `5X` + 7   → 050-123-4567
   *   - landline      8 digits, `X` + 7    → 03-123-4567
   *   - 07X VoIP/other 9 digits
   * Accepting only 9 would silently discard every landline, which matters
   * because a landline is a perfectly good number to store and display — it is
   * only SMS and WhatsApp that need it to be a mobile, and that is what
   * `isMobile` is for. Conflating "unparseable" with "not textable" would make
   * `ResidentContactService` report NO_VALID_PHONE for residents whose number
   * is on file and correct.
   */
  if (national.length !== 8 && national.length !== 9) {
    return {
      e164: null,
      isMobile: false,
      reason: `expected 8 or 9 national digits, got ${national.length}`,
    }
  }

  // Mobile is a 9-digit number whose first two digits are a mobile prefix. An
  // 8-digit landline can never match, and is not tested against the list.
  const isMobile =
    national.length === 9 && IL_MOBILE_PREFIXES.includes(national.slice(0, 2))

  return { e164: `+${IL_COUNTRY}${national}`, isMobile }
}
