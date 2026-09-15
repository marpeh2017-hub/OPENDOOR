import { createHmac, randomInt, timingSafeEqual } from 'crypto'

/**
 * The ONE way this codebase generates, stores and compares a one-time code.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * There were two OTP implementations: one in `auth/auth.service.ts` for portal
 * login, one in `signatures/signing-session.service.ts` for signing. When the
 * S3/S8 findings were fixed on 2026-09-08, only the login copy was updated.
 * The signing copy — which protects the legally consequential act, not the
 * merely inconvenient one — kept `Math.random()` and a bare SHA-256 for
 * another day, and an audit recovered a live signing code from its stored hash
 * in 556 ms.
 *
 * That is what two implementations of one security primitive buys you. This
 * module is the single implementation, so the next fix cannot land in one
 * place and miss the other.
 *
 * ── THE THREE RULES ─────────────────────────────────────────────────────────
 *
 * 1. GENERATION is `crypto.randomInt`, never `Math.random()`. Math.random is
 *    xorshift128+: its internal state is recoverable from a modest number of
 *    outputs, after which every later code is computable rather than guessable.
 *
 * 2. STORAGE is an HMAC, never a bare digest. A six-digit code has 10^6
 *    pre-images, so `sha256(code)` is not a hash in any useful sense — anyone
 *    who can read the store enumerates the space in milliseconds. The key makes
 *    the stored value useless without the server secret.
 *
 * 3. COMPARISON is constant-time.
 *
 * ── WHY THE PEPPER COMES FROM JWT_SECRET ────────────────────────────────────
 *
 * `JwtStrategy` already refuses to construct without `JWT_SECRET`, so it cannot
 * be silently unset in production. A NEW required variable would be one more
 * way for a deployment to fail, for no gain. The domain separator keeps this
 * key distinct from anything else derived from the same secret.
 *
 * Rotating `JWT_SECRET` invalidates every OTP in flight. They live five
 * minutes, so this is not worth engineering around.
 */

/** Domain separator — changing it invalidates every stored code. */
const PEPPER_INFO = 'otp-pepper-v1'

function pepper(): Buffer {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is required to hash OTP codes')
  return createHmac('sha256', secret).update(PEPPER_INFO).digest()
}

/** A six-digit code from a cryptographic source. */
export function generateOtp(): string {
  return randomInt(100000, 1000000).toString()
}

/** The value that is safe to persist, in Redis or in a database column. */
export function hashOtp(code: string): string {
  return createHmac('sha256', pepper()).update(code).digest('hex')
}

/**
 * Constant-time comparison of a stored digest against a candidate code.
 *
 * Takes the RAW candidate rather than a pre-hashed one so no caller can
 * accidentally compare with `===`.
 */
export function otpMatches(storedDigest: string | null | undefined, candidate: string): boolean {
  if (!storedDigest || !candidate) return false
  const expected = Buffer.from(storedDigest, 'hex')
  const actual = Buffer.from(hashOtp(candidate), 'hex')
  if (expected.length !== actual.length || expected.length === 0) return false
  return timingSafeEqual(expected, actual)
}
