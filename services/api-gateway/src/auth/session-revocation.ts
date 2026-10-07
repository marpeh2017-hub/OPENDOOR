/**
 * Signing a staff user out everywhere.
 *
 * ── WHY A MOMENT AND NOT A LIST OF SESSIONS ────────────────────────────────
 *
 * A staff sign-in is a pair of JWTs carrying a random `sessionId`, and nothing
 * records which sessions a user holds. Logout revokes one session by writing
 * `jwt:revoked:{sessionId}` (AuthService.logout), but "every session this user
 * has" had no answer: the admin password reset and deactivation deleted
 * `Session` rows that sign-in never writes, so they signed nobody out, and a
 * stolen token outlived both for up to the 30-day refresh window.
 *
 * So the moment of revocation is stored per user, and any token issued at or
 * before it is refused, by the access-token check (JwtStrategy) and by refresh
 * alike. The key lives as long as the longest token, after which every older
 * token has expired on its own.
 *
 * Residents are unaffected: their tokens carry a residentId as `sub`, and no
 * key is ever written under one.
 */

/** The refresh token's lifetime: the longest any revoked token could live. */
export const REVOCATION_TTL_SECONDS = 30 * 24 * 60 * 60

/** The subset of the Redis client (or its dev fallback) used here. */
export interface RevocationStore {
  get(key: string): Promise<string | null>
  setex(key: string, seconds: number, value: string): Promise<unknown>
}

const notBeforeKey = (userId: string) => `jwt:user-not-before:${userId}`

/** Refuse every token this user was issued up to now. */
export async function revokeAllSessionsOf(store: RevocationStore, userId: string): Promise<void> {
  await store.setex(notBeforeKey(userId), REVOCATION_TTL_SECONDS, String(Math.floor(Date.now() / 1000)))
}

/**
 * Whether a token was issued at or before this user's last revocation.
 *
 * `iat` is in whole seconds, so a token issued in the same second as the
 * revocation is refused too: the safe side of the tie. A token with no `iat`
 * cannot show it is newer and is refused once a revocation exists.
 */
export async function issuedBeforeRevocation(
  store: RevocationStore,
  userId: string,
  issuedAt: number | undefined,
): Promise<boolean> {
  const value = await store.get(notBeforeKey(userId))
  if (value === null || value === undefined) return false
  return issuedAt === undefined || issuedAt <= Number(value)
}
