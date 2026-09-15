import type { IsoDateTime, Locale, ViewerRole } from './common'

/**
 * Resident authentication: phone + OTP.
 *
 * ⚠ PHASE 1 DEFINES THE CONTRACT ONLY. The production implementation
 * (`services/api-gateway/src/auth`) is not modified, and the existing custom
 * JWT + Redis-backed session model stays exactly as it is. No Supabase, Clerk
 * or Firebase.
 *
 * ── WHY THESE SHAPES LOOK SPARSE ───────────────────────────────────────────
 *
 * Several fields a designer might expect are missing on purpose:
 *
 *   - No "user not found" outcome. Telling an unauthenticated caller whether a
 *     phone number is registered is account enumeration (§43). Requesting an
 *     OTP looks identical for a known and an unknown number.
 *   - No OTP in any response. The existing backend hashes it (SHA-256) and
 *     never logs it, verified. Nothing may weaken that.
 *   - No remaining-attempts counter on the request step, only on verify, where
 *     the caller has already proven possession of the number.
 */

export interface RequestOtpInput {
  /** Israeli mobile, as typed. Normalisation is the server's job. */
  phone: string
  locale?: Locale
}

/**
 * Identical whether or not the number belongs to anyone.
 *
 * `expiresAt` and `resendAvailableAt` drive the countdown and the disabled
 * state of "שלח שוב"; neither reveals anything about the account.
 */
export interface RequestOtpResult {
  sent: true
  expiresAt: IsoDateTime
  resendAvailableAt: IsoDateTime
  /** Last two digits only, for "נשלח לטלפון המסתיים ב-•• 42". Never the full
   *  number — the caller typed it, but the response may be logged or cached. */
  maskedPhoneSuffix?: string
}

export interface VerifyOtpInput {
  phone: string
  code: string
}

/**
 * Failure modes the UI must render distinctly.
 *
 * `LOCKED` exists separately from `INVALID_CODE` because the user's next action
 * differs: retry versus wait. Collapsing them produces a form that invites
 * someone to keep guessing against a lockout that has already engaged.
 */
export type VerifyOtpFailureCode =
  | 'INVALID_CODE'
  | 'EXPIRED'
  | 'LOCKED'
  | 'TOO_MANY_ATTEMPTS'

export interface VerifyOtpSuccess {
  authenticated: true
  session: SessionInfo
}

export interface VerifyOtpFailure {
  authenticated: false
  code: VerifyOtpFailureCode
  /** Present for INVALID_CODE only. Absent once locked. */
  attemptsRemaining?: number
  /** Present for LOCKED / TOO_MANY_ATTEMPTS. */
  retryAfter?: IsoDateTime
}

export type VerifyOtpResult = VerifyOtpSuccess | VerifyOtpFailure

/**
 * What the frontend is allowed to know about the session.
 *
 * NO TOKEN. The access token lives in an httpOnly cookie and is forwarded
 * server-side by the BFF — the pattern already proven in the CRM. A token in
 * a JSON body is a token in `localStorage` within a week.
 */
export interface SessionInfo {
  /** Opaque. Not the resident's database id — see §43 on internal identifiers. */
  sessionId: string
  role: ViewerRole
  displayName: string
  expiresAt: IsoDateTime
  /** True when this resident also holds representation permissions. Drives
   *  whether /rep routes appear at all. Not authorisation — see Visibility. */
  isRepresentative: boolean
}

/** Answer to "am I still logged in?", called on portal mount. */
export interface SessionStatus {
  authenticated: boolean
  session?: SessionInfo
}

export interface LogoutResult {
  loggedOut: true
}
