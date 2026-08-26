/**
 * Scrubbing for anything that comes back from a messaging provider.
 *
 * WHY THIS EXISTS. A provider error is the single most likely place for a
 * secret to leak into a log file. Twilio echoes the request body back inside
 * `error.response.data`; Inforu returns the API key in its XML fault; an
 * outbound OTP or signing link is sitting right there in the message text. None
 * of that may reach `Logger`, and none of it may reach `Message.failureReason`,
 * which the CRM renders and support staff read.
 *
 * So the rule here is allow-list, not deny-list: we extract a status code and a
 * short, redacted human string, and throw the rest away. Nothing recursive,
 * nothing "best effort".
 */

/** Substrings that mark a key as carrying a secret. Case-insensitive. */
const SECRET_KEY_MARKERS = [
  'auth', 'token', 'secret', 'password', 'passwd', 'apikey', 'api_key',
  'key', 'credential', 'signature', 'sig', 'otp', 'code', 'pin',
  'nationalid', 'national_id', 'teudat', 'ssn', 'iban', 'card',
  'bearer', 'cookie', 'session',
]

const REDACTED = '[redacted]'

/** Patterns scrubbed out of any free-text fragment we keep. */
const VALUE_PATTERNS: readonly { re: RegExp; with: string }[] = [
  // Bearer / Basic auth headers.
  { re: /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, with: '$1 [redacted]' },
  // JWTs.
  { re: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g, with: REDACTED },
  // key=value / "key": "value" where the key looks secret.
  {
    re: new RegExp(
      `("?\\b\\w*(?:${SECRET_KEY_MARKERS.join('|')})\\w*"?\\s*[:=]\\s*)"?[^"',;&\\s]{3,}"?`,
      'gi',
    ),
    with: `$1${REDACTED}`,
  },
  // Bare 4–8 digit runs — an OTP, and never useful in a failure reason.
  { re: /\b\d{4,8}\b/g, with: '[digits]' },
  // Israeli / E.164 phone numbers.
  { re: /\+?\d[\d\s-]{7,}\d/g, with: '[phone]' },
  // Anything that looks like a signing/invitation URL: keep the origin, drop
  // the path, because the path IS the token.
  { re: /\b(https?:\/\/[^\s/]+)\/\S*/gi, with: '$1/[path]' },
  // Long opaque blobs (base64url tokens, 48-byte → 64 chars).
  { re: /\b[A-Za-z0-9_-]{32,}\b/g, with: REDACTED },
]

const MAX_DETAIL_LENGTH = 240

/**
 * Turns anything a provider (or a thrown Error) gives us into a short string
 * that is safe to log AND safe to persist in `Message.failureReason`.
 *
 * Deliberately lossy. If you need the full provider payload to debug, reproduce
 * it against the provider's own dashboard — it does not belong in our database.
 */
export function sanitiseProviderDetail(input: unknown): string {
  let raw: string

  if (input === null || input === undefined) {
    raw = 'unknown error'
  } else if (typeof input === 'string') {
    raw = input
  } else if (input instanceof Error) {
    // `message` only. Not `stack` (file paths), not the attached response body.
    raw = input.message || input.name || 'error'
  } else if (typeof input === 'object') {
    // Extract only the fields that are meaningful and non-sensitive by name.
    const o = input as Record<string, unknown>
    const parts: string[] = []
    for (const k of ['status', 'statusCode', 'code', 'errorCode', 'message', 'error']) {
      const v = o[k]
      if (typeof v === 'string' || typeof v === 'number') parts.push(`${k}=${v}`)
    }
    raw = parts.length ? parts.join(' ') : 'provider error'
  } else {
    raw = String(input)
  }

  let out = raw.replace(/\s+/g, ' ').trim()
  for (const p of VALUE_PATTERNS) out = out.replace(p.re, p.with)
  if (out.length > MAX_DETAIL_LENGTH) out = `${out.slice(0, MAX_DETAIL_LENGTH - 1)}…`
  return out || 'provider error'
}

/**
 * A message body is never logged verbatim — it can contain a signing link, an
 * OTP, or a resident's personal details. Only its shape is loggable.
 */
export function describeBody(body: string): string {
  return `${body.length} chars`
}
