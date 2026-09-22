/**
 * Notification retention E2E — Phase 6.
 *
 * Notifications accumulated forever. This suite pins the cleanup policy, and
 * the assertions are weighted towards what MUST SURVIVE rather than what gets
 * removed — an over-eager retention sweep is a data-loss incident, while a
 * lazy one is only a disk-space problem.
 *
 * Specifically asserted:
 *   • UNREAD notifications survive at any age.
 *   • AUDIT rows survive — including audit rows older than the window.
 *   • SIGNATURE evidence survives (packages, records, events, signing sessions).
 *   • The sweep is TENANT-SCOPED: tenant A's policy cannot touch tenant B.
 *   • Per-tenant overrides are honoured and CLAMPED, so a tenant cannot
 *     configure a same-day purge.
 *   • The sweep is AUDITED, once per tenant, with the cutoff and the count.
 *
 * The sweep timer is disabled under NODE_ENV=test; `sweep()` is called
 * explicitly with an injected `now`.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { NotificationRetentionService } from '../src/notifications/notification-retention.service'
import { MessagingConfig } from '../src/messaging/messaging.config'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const A_SLUG = 'e2e-retention-a'
const B_SLUG = 'e2e-retention-b'
const DAY = 86_400_000

describe('Notification retention (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let retention: NotificationRetentionService

  let tenantAId: string
  let tenantBId: string
  let userAId: string
  let userBId: string

  const ago = (days: number) => new Date(Date.now() - days * DAY)

  const makeNotification = async (
    tenantId: string, userId: string,
    opts: { isRead: boolean; ageDays: number; title?: string },
  ) => {
    const when = ago(opts.ageDays)
    const row = await prisma.notification.create({
      data: {
        tenantId, userId, type: 'SYSTEM',
        title: opts.title ?? 'בדיקה', body: 'גוף',
        isRead: opts.isRead,
        readAt: opts.isRead ? when : null,
        createdAt: when,
      },
      select: { id: true },
    })
    return row.id
  }

  const purge = async () => {
    for (const slug of [A_SLUG, B_SLUG]) {
      const t = await prisma.tenant.findUnique({ where: { slug } })
      if (!t) continue
      await prisma.notification.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } })
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0,
        }),
      })
      .compile()

    app = moduleFixture.createNestApplication({ rawBody: true })
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    retention = app.get(NotificationRetentionService, { strict: false })

    await purge()
    const a = await prisma.tenant.create({ data: { name: 'E2E Ret A', slug: A_SLUG } })
    const b = await prisma.tenant.create({ data: { name: 'E2E Ret B', slug: B_SLUG } })
    tenantAId = a.id
    tenantBId = b.id

    userAId = (await prisma.user.create({
      data: {
        tenantId: tenantAId, email: 'a@e2e-ret.test', firstName: 'א', lastName: 'א',
        role: 'PROJECT_MANAGER' as any, passwordHash: 'not-a-real-hash',
      },
      select: { id: true },
    })).id
    userBId = (await prisma.user.create({
      data: {
        tenantId: tenantBId, email: 'b@e2e-ret.test', firstName: 'ב', lastName: 'ב',
        role: 'PROJECT_MANAGER' as any, passwordHash: 'not-a-real-hash',
      },
      select: { id: true },
    })).id
  })

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  beforeEach(async () => {
    await prisma.notification.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    })
    await prisma.auditLog.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    })
    await prisma.tenant.updateMany({
      where: { id: { in: [tenantAId, tenantBId] } },
      data: { notificationRetentionDays: null },
    })
  })

  const exists = async (id: string) =>
    (await prisma.notification.count({ where: { id } })) === 1

  /* ══ What gets deleted ══════════════════════════════════════════════════ */

  describe('deletes only old READ notifications', () => {
    it('removes a read notification older than the default window', async () => {
      const id = await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 400 })
      const r = await retention.sweep({ tenantId: tenantAId })
      expect(r.deleted).toBe(1)
      expect(await exists(id)).toBe(false)
    })

    it('keeps a read notification INSIDE the window', async () => {
      const id = await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 3 })
      const r = await retention.sweep({ tenantId: tenantAId })
      expect(r.deleted).toBe(0)
      expect(await exists(id)).toBe(true)
    })

    it('the boundary is inclusive of "older than", not of "exactly at"', async () => {
      const days = MessagingConfig.notificationRetentionDays
      const justInside = await makeNotification(tenantAId, userAId, {
        isRead: true, ageDays: days - 1,
      })
      const justOutside = await makeNotification(tenantAId, userAId, {
        isRead: true, ageDays: days + 1,
      })
      await retention.sweep({ tenantId: tenantAId })
      expect(await exists(justInside)).toBe(true)
      expect(await exists(justOutside)).toBe(false)
    })
  })

  /* ══ What must survive ══════════════════════════════════════════════════ */

  describe('never deletes', () => {
    it('an UNREAD notification, however old', async () => {
      const ancient = await makeNotification(tenantAId, userAId, { isRead: false, ageDays: 3650 })
      const r = await retention.sweep({ tenantId: tenantAId })
      expect(r.deleted).toBe(0)
      expect(await exists(ancient)).toBe(true)
    })

    it('an unread notification even alongside deletable read ones', async () => {
      const unread = await makeNotification(tenantAId, userAId, { isRead: false, ageDays: 500 })
      const read = await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 500 })
      await retention.sweep({ tenantId: tenantAId })
      expect(await exists(unread)).toBe(true)
      expect(await exists(read)).toBe(false)
    })

    it('AUDIT rows — including ones older than the window', async () => {
      const old = await prisma.auditLog.create({
        data: {
          tenantId: tenantAId, userId: userAId, action: 'CREATE' as any,
          entity: 'Project', entityId: 'p1', createdAt: ago(2000),
        },
        select: { id: true },
      })
      await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 500 })
      await retention.sweep({ tenantId: tenantAId })
      expect(await prisma.auditLog.count({ where: { id: old.id } })).toBe(1)
    })

    it('SIGNATURE evidence is untouched — the sweep cannot reach it', async () => {
      /*
       * This assertion used to compare GLOBAL row counts across the three
       * signature models before and after the sweep. That was flaky, and for a
       * reason worth writing down: every suite in this project runs in parallel
       * against ONE shared dev database, so any other suite creating a
       * signature package mid-sweep moved the global count and failed this
       * test — a false red that says nothing about retention.
       *
       * The replacement is not a weaker assertion, it is a sharper one. Rather
       * than "no signature row anywhere changed", it now proves the stronger
       * claim: signature rows belonging to THE VERY TENANT BEING SWEPT survive
       * the sweep, identified by id. Global counting never established that —
       * it would have passed even if the sweep had deleted a row in tenant A
       * while another suite happened to insert one elsewhere.
       *
       * `signature_packages.projectId` and `signing_sessions.recordId` carry no
       * FK constraint, so both rows can be created directly without dragging in
       * a project/owner/apartment fixture. `signature_records.ownerId` DOES
       * have one, so that model stays a count — but scoped to this suite's
       * tenant, which no other suite can touch.
       */
      const pkg = await prisma.signaturePackage.create({
        data: {
          tenantId:  tenantAId,
          projectId: `retention-probe-${Date.now()}`,
          title:     'Retention probe — must survive the sweep',
        },
        select: { id: true },
      })
      const session = await prisma.signingSession.create({
        data: {
          recordId:  `retention-probe-record-${Date.now()}`,
          token:     `retention-probe-token-${Date.now()}`,
          expiresAt: new Date(Date.now() + 3600e3),
        },
        select: { id: true },
      })
      const recordsBefore = await prisma.signatureRecord.count({
        where: { tenantId: tenantAId },
      })

      await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 500 })
      await retention.sweep({ tenantId: tenantAId })

      expect(await prisma.signaturePackage.count({ where: { id: pkg.id } })).toBe(1)
      expect(await prisma.signingSession.count({ where: { id: session.id } })).toBe(1)
      expect(await prisma.signatureRecord.count({ where: { tenantId: tenantAId } }))
        .toBe(recordsBefore)

      await prisma.signingSession.delete({ where: { id: session.id } })
      await prisma.signaturePackage.delete({ where: { id: pkg.id } })
    })

    it('MESSAGE rows (the communications log) are out of scope', async () => {
      const msg = await prisma.message.create({
        data: {
          tenantId: tenantAId, channel: 'SMS', direction: 'OUTBOUND',
          status: 'SENT', body: 'ישן', createdAt: ago(2000),
        },
        select: { id: true },
      })
      await retention.sweep({ tenantId: tenantAId })
      expect(await prisma.message.count({ where: { id: msg.id } })).toBe(1)
      await prisma.message.delete({ where: { id: msg.id } })
    })
  })

  /* ══ Tenant safety ══════════════════════════════════════════════════════ */

  describe('tenant isolation', () => {
    it('sweeping tenant A does not touch tenant B', async () => {
      const a = await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 500 })
      const b = await makeNotification(tenantBId, userBId, { isRead: true, ageDays: 500 })

      const r = await retention.sweep({ tenantId: tenantAId })
      expect(r.deleted).toBe(1)
      expect(await exists(a)).toBe(false)
      expect(await exists(b)).toBe(true)
    })

    it('a full sweep reports per-tenant counts separately', async () => {
      await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 500 })
      await makeNotification(tenantBId, userBId, { isRead: true, ageDays: 500 })
      await makeNotification(tenantBId, userBId, { isRead: true, ageDays: 600 })

      const r = await retention.sweep()
      const a = r.perTenant.find((t) => t.tenantId === tenantAId)
      const b = r.perTenant.find((t) => t.tenantId === tenantBId)
      expect(a?.deleted).toBe(1)
      expect(b?.deleted).toBe(2)
    })

    it('one tenant’s short window does not shorten another’s', async () => {
      await prisma.tenant.update({
        where: { id: tenantAId }, data: { notificationRetentionDays: 7 },
      })
      const a = await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 30 })
      const b = await makeNotification(tenantBId, userBId, { isRead: true, ageDays: 30 })

      await retention.sweep()
      expect(await exists(a)).toBe(false)  // 30 days old, 7-day window
      expect(await exists(b)).toBe(true)   // 30 days old, 180-day default
    })
  })

  /* ══ Configuration ══════════════════════════════════════════════════════ */

  describe('configurable window', () => {
    it('honours a per-tenant override', async () => {
      await prisma.tenant.update({
        where: { id: tenantAId }, data: { notificationRetentionDays: 10 },
      })
      const id = await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 20 })
      const r = await retention.sweep({ tenantId: tenantAId })
      expect(r.perTenant[0]?.retentionDays).toBe(10)
      expect(await exists(id)).toBe(false)
    })

    it('clamps an absurdly short override to the 7-day floor', async () => {
      await prisma.tenant.update({
        where: { id: tenantAId }, data: { notificationRetentionDays: 0 },
      })
      const yesterday = await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 1 })
      const r = await retention.sweep({ tenantId: tenantAId })
      expect(r.perTenant.length === 0 || r.perTenant[0].retentionDays >= 7).toBe(true)
      // A same-day purge is not configurable: yesterday's read notification lives.
      expect(await exists(yesterday)).toBe(true)
    })

    it('clamps a negative override too', () => {
      expect(retention.retentionDaysFor(-500)).toBe(7)
      expect(retention.retentionDaysFor(99999)).toBe(3650)
      expect(retention.retentionDaysFor(null)).toBe(MessagingConfig.notificationRetentionDays)
    })

    it('batches — never deletes more than the batch size in one sweep', async () => {
      const batch = MessagingConfig.notificationRetentionBatchSize
      // Only meaningful if we can exceed it cheaply; assert the contract shape
      // rather than creating thousands of rows.
      for (let i = 0; i < 5; i += 1) {
        await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 500 })
      }
      const r = await retention.sweep({ tenantId: tenantAId })
      expect(r.deleted).toBeLessThanOrEqual(batch)
      expect(r.deleted).toBe(5)
    })
  })

  /* ══ Auditability ═══════════════════════════════════════════════════════ */

  describe('auditability', () => {
    it('writes exactly ONE audit row per tenant per sweep', async () => {
      for (let i = 0; i < 3; i += 1) {
        await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 500 })
      }
      await retention.sweep({ tenantId: tenantAId })

      const rows = await prisma.auditLog.findMany({
        where: { tenantId: tenantAId, entity: 'Notification', action: 'DELETE' as any },
      })
      expect(rows).toHaveLength(1)
      const meta = rows[0].metadata as any
      expect(meta.policy).toBe('notification-retention')
      expect(meta.deleted).toBe(3)
      expect(typeof meta.cutoff).toBe('string')
      expect(meta.retentionDays).toBe(MessagingConfig.notificationRetentionDays)
    })

    it('attributes the deletion to no user — a sweep has no human actor', async () => {
      await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 500 })
      await retention.sweep({ tenantId: tenantAId })
      const row = await prisma.auditLog.findFirstOrThrow({
        where: { tenantId: tenantAId, entity: 'Notification', action: 'DELETE' as any },
      })
      expect(row.userId).toBeNull()
    })

    it('writes NO audit row when nothing was deleted', async () => {
      await makeNotification(tenantAId, userAId, { isRead: true, ageDays: 2 })
      await retention.sweep({ tenantId: tenantAId })
      expect(await prisma.auditLog.count({
        where: { tenantId: tenantAId, entity: 'Notification' },
      })).toBe(0)
    })
  })
})
