/**
 * Signing a staff user out everywhere.
 *
 * These tests exist because the admin password reset and deactivation once
 * "revoked all sessions" by deleting `Session` rows that staff sign-in never
 * writes: both signed nobody out, and nothing noticed. They hold the
 * replacement in place, from the stored moment down to the token check.
 */
import { UnauthorizedException } from '@nestjs/common'
import {
  REVOCATION_TTL_SECONDS, issuedBeforeRevocation, revokeAllSessionsOf, type RevocationStore,
} from './session-revocation'
import { JwtStrategy } from './strategies/jwt.strategy'

/** The two calls the helpers make, plus `exists` for JwtStrategy's own check. */
function memoryStore() {
  const data = new Map<string, { value: string; ttl: number }>()
  const store: RevocationStore & { exists(key: string): Promise<number> } = {
    get: async (key) => data.get(key)?.value ?? null,
    setex: async (key, ttl, value) => { data.set(key, { value, ttl }) },
    exists: async (key) => (data.has(key) ? 1 : 0),
  }
  return { store, data }
}

const ORIGINAL_SECRET = process.env.JWT_SECRET
beforeAll(() => { process.env.JWT_SECRET = 'session-revocation-spec-secret' })
afterAll(() => { process.env.JWT_SECRET = ORIGINAL_SECRET })
afterEach(() => { jest.useRealTimers() })

/** Revoke at a fixed moment: 1,800,000,000 s (2027-01-15). */
async function revokeAt(store: RevocationStore, userId: string, seconds = 1_800_000_000) {
  jest.useFakeTimers({ now: seconds * 1000 })
  await revokeAllSessionsOf(store, userId)
  jest.useRealTimers()
  return seconds
}

describe('issuedBeforeRevocation', () => {
  it('refuses nothing for a user who was never revoked', async () => {
    const { store } = memoryStore()
    expect(await issuedBeforeRevocation(store, 'usr_1', 1)).toBe(false)
  })

  it('refuses tokens issued at or before the moment, and accepts later ones', async () => {
    const { store } = memoryStore()
    const at = await revokeAt(store, 'usr_1')
    expect(await issuedBeforeRevocation(store, 'usr_1', at - 3600)).toBe(true)
    // The same second is refused: the safe side of a whole-second tie.
    expect(await issuedBeforeRevocation(store, 'usr_1', at)).toBe(true)
    expect(await issuedBeforeRevocation(store, 'usr_1', at + 1)).toBe(false)
  })

  it('refuses a token with no issue time once a revocation exists', async () => {
    const { store } = memoryStore()
    await revokeAt(store, 'usr_1')
    expect(await issuedBeforeRevocation(store, 'usr_1', undefined)).toBe(true)
  })

  it('is per user', async () => {
    const { store } = memoryStore()
    const at = await revokeAt(store, 'usr_1')
    expect(await issuedBeforeRevocation(store, 'usr_2', at - 3600)).toBe(false)
  })

  it('keeps the moment as long as the longest token lives', async () => {
    const { store, data } = memoryStore()
    await revokeAt(store, 'usr_1')
    expect([...data.values()][0]?.ttl).toBe(REVOCATION_TTL_SECONDS)
    expect(REVOCATION_TTL_SECONDS).toBe(30 * 24 * 60 * 60)
  })
})

describe('JwtStrategy.validate', () => {
  const payload = (iat: number) => ({
    sub: 'usr_1', email: 'a@example.com', role: 'COMPANY_ADMIN',
    tenantId: 'tnt_01', sessionId: 'ses_1', iat,
  })

  it('refuses an access token issued before the user was signed out everywhere', async () => {
    const { store } = memoryStore()
    const at = await revokeAt(store, 'usr_1')
    const strategy = new JwtStrategy(store)
    await expect(strategy.validate(payload(at - 60))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('accepts a token issued after it, as the next sign-in will be', async () => {
    const { store } = memoryStore()
    const at = await revokeAt(store, 'usr_1')
    const strategy = new JwtStrategy(store)
    await expect(strategy.validate(payload(at + 60))).resolves.toMatchObject({ userId: 'usr_1' })
  })
})
