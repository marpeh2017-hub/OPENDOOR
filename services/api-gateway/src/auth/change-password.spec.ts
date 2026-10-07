/**
 * A staff user changing their own password (AuthService.changePassword).
 *
 * In-memory stand-ins for Prisma, the audit log and Redis: what matters here
 * is the order of the checks, which answer is a 400 rather than a 401 (the CRM
 * signs the user out on any 401), and that success signs the user out
 * everywhere.
 */
import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { AuthService, hashPassword } from './auth.service'
import { issuedBeforeRevocation } from './session-revocation'

const CURRENT = 'Current2026Pass'
const NEXT = 'Next2026Password'

function setup(overrides: Partial<{ isActive: boolean; tenantId: string }> = {}) {
  const user = {
    id: 'usr_1', tenantId: 'tnt_01', isActive: true,
    passwordHash: hashPassword(CURRENT), ...overrides,
  }
  const audits: unknown[] = []
  const redisData = new Map<string, string>()
  const prisma = {
    user: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === user.id ? user : null) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      user: {
        update: async ({ data }: { data: { passwordHash: string } }) => {
          user.passwordHash = data.passwordHash
          return user
        },
      },
    }),
  }
  const redis = {
    get: async (key: string) => redisData.get(key) ?? null,
    setex: async (key: string, _ttl: number, value: string) => { redisData.set(key, value) },
  }
  const audit = { record: async (_actor: unknown, entry: unknown) => { audits.push(entry) } }
  const service = new AuthService({} as never, prisma as never, {} as never, redis, audit as never)
  const actor = { userId: 'usr_1', tenantId: 'tnt_01', role: 'COMPANY_ADMIN' }
  return { service, actor, user, audits, redis }
}

describe('AuthService.changePassword', () => {
  it('refuses a wrong current password with a 400, changing nothing', async () => {
    const { service, actor, user, audits } = setup()
    const before = user.passwordHash
    const attempt = service.changePassword(actor, { currentPassword: 'Wrong2026Password', newPassword: NEXT })
    await expect(attempt).rejects.toBeInstanceOf(BadRequestException)
    await expect(attempt).rejects.not.toBeInstanceOf(UnauthorizedException)
    expect(user.passwordHash).toBe(before)
    expect(audits).toHaveLength(0)
  })

  it('refuses a weak new password with the rule in Hebrew', async () => {
    const { service, actor } = setup()
    await expect(service.changePassword(actor, { currentPassword: CURRENT, newPassword: 'alllowercase123' }))
      .rejects.toThrow('הסיסמה צריכה לכלול אות אנגלית גדולה.')
  })

  it('refuses the current password as the new one', async () => {
    const { service, actor } = setup()
    await expect(service.changePassword(actor, { currentPassword: CURRENT, newPassword: CURRENT }))
      .rejects.toThrow('הסיסמה החדשה זהה לנוכחית. בחרו סיסמה אחרת.')
  })

  it('refuses a user of another tenant, or one who was deactivated', async () => {
    const other = setup({ tenantId: 'tnt_99' })
    await expect(other.service.changePassword(other.actor, { currentPassword: CURRENT, newPassword: NEXT }))
      .rejects.toBeInstanceOf(UnauthorizedException)
    const inactive = setup({ isActive: false })
    await expect(inactive.service.changePassword(inactive.actor, { currentPassword: CURRENT, newPassword: NEXT }))
      .rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('stores the new password, records it, and signs the user out everywhere', async () => {
    const { service, actor, audits, redis } = setup()
    const issuedEarlier = Math.floor(Date.now() / 1000) - 60

    await expect(service.changePassword(actor, { currentPassword: CURRENT, newPassword: NEXT }))
      .resolves.toEqual({ passwordChanged: true })

    expect(audits).toEqual([expect.objectContaining({
      action: 'UPDATE', entity: 'User', entityId: 'usr_1',
      metadata: { reason: 'PASSWORD_CHANGED_BY_USER', sessionsRevoked: true },
    })])
    expect(await issuedBeforeRevocation(redis, 'usr_1', issuedEarlier)).toBe(true)
    // The stored hash answers to the new password: it can now be changed again
    // with NEXT as the current one, and no longer with CURRENT.
    await expect(service.changePassword(actor, { currentPassword: CURRENT, newPassword: 'Third2026Password' }))
      .rejects.toThrow('הסיסמה הנוכחית שגויה.')
    await expect(service.changePassword(actor, { currentPassword: NEXT, newPassword: 'Third2026Password' }))
      .resolves.toEqual({ passwordChanged: true })
  })
})
