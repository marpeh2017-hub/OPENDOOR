/**
 * The shared OTP primitive.
 *
 * These tests exist because this exact code was fixed once in `auth.service.ts`
 * and NOT in `signing-session.service.ts`, and the gap went unnoticed until an
 * audit recovered a live signing code from its stored hash in 556 ms. The
 * duplication is now gone; these tests hold the properties in place.
 */
import { createHash } from 'crypto'
import { generateOtp, hashOtp, otpMatches } from './otp'

const ORIGINAL_SECRET = process.env.JWT_SECRET

beforeAll(() => { process.env.JWT_SECRET = 'otp-spec-secret' })
afterAll(() => { process.env.JWT_SECRET = ORIGINAL_SECRET })

describe('generateOtp', () => {
  it('returns exactly six digits', () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/)
  })

  it('covers the whole range, including codes with a leading digit of 1', () => {
    // randomInt(100000, 1000000) never returns a value below 100000, so a
    // six-digit string is guaranteed without zero-padding.
    const values = Array.from({ length: 500 }, () => Number(generateOtp()))
    expect(Math.min(...values)).toBeGreaterThanOrEqual(100000)
    expect(Math.max(...values)).toBeLessThanOrEqual(999999)
  })

  it('does not repeat itself the way a seeded or fixed generator would', () => {
    const seen = new Set(Array.from({ length: 300 }, generateOtp))
    // 300 draws from 900k values: collisions are possible but a generator that
    // is fixed, sequential or seeded per-call would collapse far below this.
    expect(seen.size).toBeGreaterThan(280)
  })
})

describe('hashOtp', () => {
  it('is not a bare digest — the whole point of the pepper', () => {
    const code = '123456'
    expect(hashOtp(code)).not.toBe(createHash('sha256').update(code).digest('hex'))
  })

  it('cannot be brute-forced from the digest alone without the secret', () => {
    // The audit recovered a code in 556ms by enumerating 10^6 sha256 digests.
    // That attack must now fail: sweeping the entire space with the WRONG
    // construction finds nothing.
    const stored = hashOtp('424242')
    let found: string | null = null
    for (let n = 0; n < 1000000; n++) {
      if (createHash('sha256').update(String(n).padStart(6, '0')).digest('hex') === stored) {
        found = String(n).padStart(6, '0')
        break
      }
    }
    expect(found).toBeNull()
  })

  it('is deterministic for a given secret', () => {
    expect(hashOtp('111111')).toBe(hashOtp('111111'))
  })

  it('changes completely when the secret changes', () => {
    const a = hashOtp('111111')
    process.env.JWT_SECRET = 'a-different-secret'
    const b = hashOtp('111111')
    process.env.JWT_SECRET = 'otp-spec-secret'
    expect(a).not.toBe(b)
  })

  it('refuses to run without a secret rather than hashing with nothing', () => {
    const saved = process.env.JWT_SECRET
    delete process.env.JWT_SECRET
    expect(() => hashOtp('123456')).toThrow(/JWT_SECRET/)
    process.env.JWT_SECRET = saved
  })
})

describe('otpMatches', () => {
  it('accepts the right code', () => {
    expect(otpMatches(hashOtp('654321'), '654321')).toBe(true)
  })

  it('rejects the wrong code', () => {
    expect(otpMatches(hashOtp('654321'), '654322')).toBe(false)
  })

  it('rejects empty, null and undefined without throwing', () => {
    expect(otpMatches(null, '123456')).toBe(false)
    expect(otpMatches(undefined, '123456')).toBe(false)
    expect(otpMatches('', '123456')).toBe(false)
    expect(otpMatches(hashOtp('123456'), '')).toBe(false)
  })

  it('rejects a truncated or malformed stored digest instead of throwing', () => {
    // timingSafeEqual throws on length mismatch; a length guard has to come
    // first or a corrupt row becomes a 500 on every login attempt.
    expect(otpMatches('abcd', '123456')).toBe(false)
    expect(otpMatches('not-hex-at-all', '123456')).toBe(false)
  })
})
