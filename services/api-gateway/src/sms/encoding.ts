/**
 * Which alphabet an SMS has to be sent in, and what that costs in segments.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * An SMS is not UTF-8. The default alphabet is GSM 03.38 ("GSM-7"), a 128-plus-
 * 10 character set that contains Latin letters, a handful of accents and some
 * Greek capitals — and no Hebrew at all. A provider handed Hebrew while the
 * message is typed as GSM-7 does not fail: it substitutes, and every Hebrew
 * character arrives as `?`.
 *
 * That is exactly what happened to the first real OTP this system sent. The
 * code reached the phone; the Hebrew around it did not.
 *
 * The alternative alphabet is UCS-2 (UTF-16), which represents Hebrew fine but
 * is not free: a segment holds 70 characters instead of 160, so the same
 * message costs more to send. Choosing UCS-2 unconditionally would make every
 * English message cost roughly twice what it should, so the choice is made per
 * message from its actual content.
 *
 * ── SEGMENTS ───────────────────────────────────────────────────────────────
 *
 * A message longer than one segment is split and billed per part, and the
 * per-segment allowance DROPS when it splits (153 instead of 160; 67 instead
 * of 70) because each part carries a concatenation header. Callers get the
 * segment count so a message that silently costs triple can be noticed.
 */

/**
 * GSM 03.38 basic set — one septet each.
 *
 * Written out in full rather than derived from a range, because it is not a
 * range: it interleaves Latin, currency, Greek capitals and accented vowels in
 * an order fixed by the spec.
 */
const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'

/**
 * The extension table — reachable only via an ESC prefix, so each of these
 * costs TWO septets, not one. Forgetting that undercounts a message full of
 * braces or euro signs and lets it split unexpectedly.
 */
const GSM7_EXTENDED = '^{}\[~]|€\f'

const BASIC = new Set(GSM7_BASIC)
const EXTENDED = new Set(GSM7_EXTENDED)

export type SmsAlphabet = 'text' | 'unicode'

export interface SmsEncodingPlan {
  /** The value Vonage's `type` parameter needs. */
  type: SmsAlphabet
  /** Billable parts this message will be split into. */
  segments: number
  /** Characters (or septets) one segment holds, given the split above. */
  perSegment: number
  /** Length in the unit that matters for this alphabet. */
  length: number
}

/** True when every character survives the GSM-7 alphabet intact. */
export function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!BASIC.has(ch) && !EXTENDED.has(ch)) return false
  }
  return true
}

/**
 * Decide the alphabet and count the segments.
 *
 * The two-pass shape (measure, then re-measure once we know it split) is
 * deliberate: the per-segment allowance depends on whether it splits, and
 * whether it splits depends on the allowance.
 */
export function planSmsEncoding(text: string): SmsEncodingPlan {
  const gsm7 = isGsm7(text)

  // GSM-7 is counted in septets, where an extension character costs two.
  // UCS-2 is counted in UTF-16 code units, so a character outside the BMP
  // (an emoji, say) correctly costs two.
  const length = gsm7
    ? [...text].reduce((n, ch) => n + (EXTENDED.has(ch) ? 2 : 1), 0)
    : text.length

  const single = gsm7 ? 160 : 70
  const concatenated = gsm7 ? 153 : 67

  if (length <= single) {
    return { type: gsm7 ? 'text' : 'unicode', segments: 1, perSegment: single, length }
  }
  return {
    type: gsm7 ? 'text' : 'unicode',
    segments: Math.ceil(length / concatenated),
    perSegment: concatenated,
    length,
  }
}
