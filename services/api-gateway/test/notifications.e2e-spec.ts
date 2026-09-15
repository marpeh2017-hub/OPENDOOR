/**
 * Notifications E2E — the in-app delivery substrate (Phase B).
 *
 * `Notification` was a schema-only model: no controller, no reader, no writer.
 * This suite pins the module that now backs it, and in particular the two
 * properties Meetings (Phase C) and Automations (later) depend on:
 *
 *   - `NotificationsService.emit` is the integration point other modules call,
 *     and it refuses a recipient outside the emitting tenant.
 *   - reading is strictly FIRST-PERSON. There is no parameter a caller can pass
 *     to see someone else's notifications, and the tests below assert that by
 *     creating rows for another user and proving they are invisible — not by
 *     asserting an error message, which would pass vacuously.
 *
 * NO PASSWORD IS USED. Tokens are minted directly through `JwtService` against
 * users this suite creates, which is both closer to what the guard actually
 * validates and avoids depending on seed credentials. `sessionId` is always
 * present — a token without it is rejected by `JwtStrategy`, so omitting it
 * would make every assertion here vacuous.
 *
 * Every row created is removed in afterAll.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { NotificationsService } from '../src/notifications/notifications.service'
import { NOTIFICATION_KINDS } from '../src/notifications/notification-kinds'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const A_SLUG = 'e2e-notif-tenant-a'
const B_SLUG = 'e2e-notif-tenant-b'

describe('Notifications (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let notifications: NotificationsService

  /** Tenant A: the caller (`alice`) and a colleague (`bob`). */
  let tenantAId: string
  let aliceId: string
  let bobId: string
  /** Tenant B: an unrelated user, for the isolation assertions. */
  let tenantBId: string
  let carolId: string

  const token = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      {
        sub: userId, email: `${userId}@example.com`, role, tenantId, sessionId: randomUUID(),
        // A RESIDENT token must ALSO carry its project and resident scope, for
        // the same reason it must carry a sessionId: `JwtStrategy` rejects a
        // resident token it cannot safely scope, so without these the 403 under
        // test here would never be reached — the request would 401 first. The
        // ids are probes: these routes are staff routes and run no
        // resident-scoped query.
        ...(role === 'RESIDENT'
          // `sub` too: `JwtStrategy` now requires the two identity claims on a
          // resident token to agree, because code reading `sub` and code reading
          // `residentId` would otherwise describe different people.
          ? { sub: 'res_rbac_probe', projectId: 'prj_rbac_probe', residentId: 'res_rbac_probe' }
          : {}),
      },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  let aliceToken: string
  let bobToken: string
  let carolToken: string

  const asAlice = () => ({ Authorization: `Bearer ${aliceToken}` })
  const api = () => request(app.getHttpServer())

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

  const makeUser = async (tenantId: string, email: string, role: string) => {
    const u = await prisma.user.create({
      data: {
        tenantId,
        email,
        firstName: 'E2E',
        lastName: email.split('@')[0],
        // A syntactically valid but unusable hash. Nothing in this suite
        // authenticates by password — tokens are minted directly — so this is
        // never exercised as a credential.
        passwordHash: 'not-a-usable-credential',
        role: role as never,
      },
      select: { id: true },
    })
    return u.id
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Same seam and same reasoning as documents-upload.e2e-spec.ts: the
      // global ThrottlerGuard's 20 req/s would turn the RBAC and isolation
      // assertions into 429s. Replacing the STORAGE (not the guard — `useClass`
      // constructs its own instance, so overrideGuard does nothing) removes the
      // rate limit and nothing else. Every notification guard stays active.
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0,
        }),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    // Mirrors main.ts exactly. `forbidNonWhitelisted` is what makes the
    // mass-assignment assertions below mean anything.
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })
    notifications = app.get(NotificationsService, { strict: false })

    await purge()

    const a = await prisma.tenant.create({ data: { name: 'E2E Notif A', slug: A_SLUG } })
    const b = await prisma.tenant.create({ data: { name: 'E2E Notif B', slug: B_SLUG } })
    tenantAId = a.id
    tenantBId = b.id
    expect(tenantAId).not.toBe(tenantBId)

    aliceId = await makeUser(tenantAId, 'alice@e2e-notif.test', 'PROJECT_MANAGER')
    bobId   = await makeUser(tenantAId, 'bob@e2e-notif.test', 'FIELD_AGENT')
    carolId = await makeUser(tenantBId, 'carol@e2e-notif.test', 'PROJECT_MANAGER')

    aliceToken = token(aliceId, tenantAId, 'PROJECT_MANAGER')
    bobToken   = token(bobId, tenantAId, 'FIELD_AGENT')
    carolToken = token(carolId, tenantBId, 'PROJECT_MANAGER')
  })

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  /** Clean slate before each block that counts rows. */
  const clearAll = () => prisma.notification.deleteMany({
    where: { tenantId: { in: [tenantAId, tenantBId] } },
  })

  /* ── The emit() integration point ──────────────────────────────── */

  describe('emit() — what other modules call', () => {
    beforeEach(clearAll)

    it('creates a notification for a user in the same tenant', async () => {
      const res = await notifications.emit({
        userId: aliceId, tenantId: tenantAId,
        type: 'MEETING', title: 'זומנת לפגישה', body: 'פגישת דיירים',
        link: '/meetings/abc', entityType: 'Meeting', entityId: 'abc',
      })
      expect(res).toBeTruthy()

      const row = await prisma.notification.findUnique({ where: { id: res!.id } })
      expect(row).toMatchObject({
        userId: aliceId, tenantId: tenantAId, type: 'MEETING',
        link: '/meetings/abc', entityType: 'Meeting', entityId: 'abc', isRead: false,
      })
    })

    it('REFUSES a recipient who belongs to another tenant, and writes nothing', async () => {
      const res = await notifications.emit({
        userId: carolId, tenantId: tenantAId,
        type: 'MEETING', title: 'cross tenant', body: 'should not exist',
      })
      expect(res).toBeNull()
      const count = await prisma.notification.count({ where: { userId: carolId } })
      expect(count).toBe(0)
    })

    it('refuses an unknown kind rather than storing it', async () => {
      const res = await notifications.emit({
        userId: aliceId, tenantId: tenantAId,
        type: 'NOT_A_REAL_KIND' as never, title: 'x', body: 'y',
      })
      expect(res).toBeNull()
      expect(await prisma.notification.count({ where: { userId: aliceId } })).toBe(0)
    })

    it('does NOT throw when the recipient does not exist — notifying is best-effort', async () => {
      // A meeting that was created must not be rolled back because its
      // invitation could not be delivered.
      await expect(notifications.emit({
        userId: 'clzzzznonexistentuser', tenantId: tenantAId,
        type: 'MEETING', title: 'x', body: 'y',
      })).resolves.toBeNull()
    })

    describe('link sanitising — the list renders link as a click target', () => {
      const cases: [string, string | null][] = [
        ['/meetings/abc',            '/meetings/abc'],
        ['https://evil.example/x',   null],
        ['//evil.example/x',         null],
        ['javascript:alert(1)',      null],
        ['\\\\evil.example\\share',  null],
        ['meetings/abc',             null],
      ]
      for (const [input, expected] of cases) {
        it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, async () => {
          const res = await notifications.emit({
            userId: aliceId, tenantId: tenantAId,
            type: 'SYSTEM', title: 't', body: 'b', link: input,
          })
          const row = await prisma.notification.findUnique({ where: { id: res!.id } })
          expect(row!.link).toBe(expected)
        })
      }
    })

    it('emitMany fans out and de-duplicates repeated recipients', async () => {
      const created = await notifications.emitMany(
        [aliceId, bobId, aliceId],
        { tenantId: tenantAId, type: 'MEETING', title: 'fan out', body: 'b' },
      )
      expect(created).toBe(2)
      expect(await prisma.notification.count({ where: { tenantId: tenantAId } })).toBe(2)
    })

    it('emitMany skips out-of-tenant recipients but still delivers the rest', async () => {
      const created = await notifications.emitMany(
        [aliceId, carolId],
        { tenantId: tenantAId, type: 'MEETING', title: 'partial', body: 'b' },
      )
      expect(created).toBe(1)
      expect(await prisma.notification.count({ where: { userId: carolId } })).toBe(0)
    })
  })

  /* ── Reading is first-person ───────────────────────────────────── */

  describe('GET /notifications — first-person only', () => {
    beforeEach(async () => {
      await clearAll()
      await notifications.emit({
        userId: aliceId, tenantId: tenantAId, type: 'TASK', title: 'למשימה שלי', body: 'a1',
      })
      await notifications.emit({
        userId: aliceId, tenantId: tenantAId, type: 'MEETING', title: 'פגישה שלי', body: 'a2',
      })
      await notifications.emit({
        userId: bobId, tenantId: tenantAId, type: 'TASK', title: 'של בוב', body: 'b1',
      })
    })

    it('returns only the caller’s own rows', async () => {
      const res = await api().get('/api/v1/notifications').set(asAlice())
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(2)
      for (const n of res.body.items) expect(n.userId).toBe(aliceId)
      expect(res.body.total).toBe(2)
      expect(res.body.unreadCount).toBe(2)
    })

    it('a colleague in the SAME tenant sees only their own — not the caller’s', async () => {
      // The real assertion of first-person reading: Bob's list must not contain
      // Alice's rows even though they share a tenant.
      const res = await api().get('/api/v1/notifications')
        .set({ Authorization: `Bearer ${bobToken}` })
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].userId).toBe(bobId)
      expect(res.body.items[0].title).toBe('של בוב')
    })

    it('newest first', async () => {
      const res = await api().get('/api/v1/notifications').set(asAlice())
      const times = res.body.items.map((n: any) => new Date(n.createdAt).getTime())
      expect(times[0]).toBeGreaterThanOrEqual(times[1])
    })

    it('?unreadOnly=true filters to unread', async () => {
      const list = await api().get('/api/v1/notifications').set(asAlice())
      const first = list.body.items[0]
      await api().patch(`/api/v1/notifications/${first.id}/read`).set(asAlice()).send({})

      const res = await api().get('/api/v1/notifications?unreadOnly=true').set(asAlice())
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].isRead).toBe(false)
    })

    it('?unreadOnly=false means READ only — not "everything"', async () => {
      // The bug this pins: `Boolean('false')` is true, so a naive
      // `@Type(() => Boolean)` would make this identical to unreadOnly=true.
      const list = await api().get('/api/v1/notifications').set(asAlice())
      await api().patch(`/api/v1/notifications/${list.body.items[0].id}/read`)
        .set(asAlice()).send({})

      const res = await api().get('/api/v1/notifications?unreadOnly=false').set(asAlice())
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].isRead).toBe(true)
    })

    it('?type= filters by kind', async () => {
      const res = await api().get('/api/v1/notifications?type=MEETING').set(asAlice())
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].type).toBe('MEETING')
    })

    it('rejects an unknown ?type → 400', async () => {
      const res = await api().get('/api/v1/notifications?type=NONSENSE').set(asAlice())
      expect(res.status).toBe(400)
    })

    it('rejects an unknown query parameter → 400 (no silent filter bypass)', async () => {
      const res = await api().get('/api/v1/notifications?userId=' + bobId).set(asAlice())
      expect(res.status).toBe(400)
    })

    it('honours limit and offset', async () => {
      const res = await api().get('/api/v1/notifications?limit=1&offset=1').set(asAlice())
      expect(res.body.items).toHaveLength(1)
      expect(res.body.total).toBe(2)
    })

    it('rejects limit above the cap → 400', async () => {
      const res = await api().get('/api/v1/notifications?limit=5000').set(asAlice())
      expect(res.status).toBe(400)
    })
  })

  /* ── Unread count ──────────────────────────────────────────────── */

  describe('GET /notifications/unread-count', () => {
    beforeEach(async () => {
      await clearAll()
      await notifications.emitMany([aliceId], {
        tenantId: tenantAId, type: 'TASK', title: 'x', body: 'y',
      })
      await notifications.emit({
        userId: bobId, tenantId: tenantAId, type: 'TASK', title: 'bob', body: 'y',
      })
    })

    it('counts only the caller’s unread rows', async () => {
      const res = await api().get('/api/v1/notifications/unread-count').set(asAlice())
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ count: 1 })
    })

    it('drops to zero after mark-all-read, and does not touch anyone else', async () => {
      await api().patch('/api/v1/notifications/read-all').set(asAlice()).send({})

      const mine = await api().get('/api/v1/notifications/unread-count').set(asAlice())
      expect(mine.body).toEqual({ count: 0 })

      const bobs = await api().get('/api/v1/notifications/unread-count')
        .set({ Authorization: `Bearer ${bobToken}` })
      expect(bobs.body).toEqual({ count: 1 })
    })

    it('`read-all` is routed as a literal, not parsed as an id', async () => {
      const res = await api().patch('/api/v1/notifications/read-all').set(asAlice()).send({})
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('updated')
    })
  })

  /* ── Mark read / unread ────────────────────────────────────────── */

  describe('PATCH /notifications/:id/read', () => {
    let aliceNotifId: string
    let bobNotifId: string

    beforeEach(async () => {
      await clearAll()
      aliceNotifId = (await notifications.emit({
        userId: aliceId, tenantId: tenantAId, type: 'TASK', title: 'mine', body: 'b',
      }))!.id
      bobNotifId = (await notifications.emit({
        userId: bobId, tenantId: tenantAId, type: 'TASK', title: 'bobs', body: 'b',
      }))!.id
    })

    it('marks read and stamps readAt', async () => {
      const res = await api().patch(`/api/v1/notifications/${aliceNotifId}/read`)
        .set(asAlice()).send({})
      expect(res.status).toBe(200)
      expect(res.body.isRead).toBe(true)
      expect(res.body.readAt).toBeTruthy()
    })

    it('can mark unread again, clearing readAt', async () => {
      await api().patch(`/api/v1/notifications/${aliceNotifId}/read`).set(asAlice()).send({})
      const res = await api().patch(`/api/v1/notifications/${aliceNotifId}/read`)
        .set(asAlice()).send({ isRead: false })
      expect(res.status).toBe(200)
      expect(res.body.isRead).toBe(false)
      expect(res.body.readAt).toBeNull()
    })

    it("someone else's notification → 404, and the row is UNCHANGED", async () => {
      const res = await api().patch(`/api/v1/notifications/${bobNotifId}/read`)
        .set(asAlice()).send({})
      expect(res.status).toBe(404)
      // Not just the status: prove the write did not happen.
      const row = await prisma.notification.findUnique({ where: { id: bobNotifId } })
      expect(row!.isRead).toBe(false)
      expect(row!.readAt).toBeNull()
    })

    it('an unknown id → 404', async () => {
      const res = await api().patch('/api/v1/notifications/clznope000000/read')
        .set(asAlice()).send({})
      expect(res.status).toBe(404)
    })
  })

  /* ── POST /notifications ───────────────────────────────────────── */

  describe('POST /notifications', () => {
    beforeEach(clearAll)

    it('sends to a colleague in the same tenant and audits it', async () => {
      const res = await api().post('/api/v1/notifications').set(asAlice()).send({
        userId: bobId, type: 'MESSAGE', title: 'שלום', body: 'נא לבדוק',
        link: '/projects/x', entityType: 'Project', entityId: 'x',
      })
      expect(res.status).toBe(201)
      expect(res.body.userId).toBe(bobId)

      const audit = await prisma.auditLog.findFirst({
        where: { tenantId: tenantAId, entity: 'Notification', entityId: res.body.id },
      })
      expect(audit).toBeTruthy()
      expect(audit!.userId).toBe(aliceId)
      // The body is free text that may quote resident detail; the audit log is
      // exported, so it must not be recorded.
      expect(JSON.stringify(audit!.metadata)).not.toContain('נא לבדוק')
    })

    it("a recipient in ANOTHER tenant → 404, never 403 (no user-id oracle)", async () => {
      const res = await api().post('/api/v1/notifications').set(asAlice()).send({
        userId: carolId, type: 'MESSAGE', title: 'x', body: 'y',
      })
      expect(res.status).toBe(404)
      expect(await prisma.notification.count({ where: { userId: carolId } })).toBe(0)
    })

    it('rejects an unknown kind → 400', async () => {
      const res = await api().post('/api/v1/notifications').set(asAlice()).send({
        userId: bobId, type: 'NOPE', title: 'x', body: 'y',
      })
      expect(res.status).toBe(400)
    })

    it('rejects mass assignment of tenantId / isRead / readAt → 400', async () => {
      for (const extra of [
        { tenantId: tenantBId },
        { isRead: true },
        { readAt: new Date().toISOString() },
        { id: 'chosen-by-caller' },
      ]) {
        const res = await api().post('/api/v1/notifications').set(asAlice()).send({
          userId: bobId, type: 'MESSAGE', title: 'x', body: 'y', ...extra,
        })
        expect({ extra: Object.keys(extra)[0], status: res.status })
          .toEqual({ extra: Object.keys(extra)[0], status: 400 })
      }
      expect(await prisma.notification.count({ where: { tenantId: tenantBId } })).toBe(0)
    })

    it('strips an absolute link rather than storing it', async () => {
      const res = await api().post('/api/v1/notifications').set(asAlice()).send({
        userId: bobId, type: 'MESSAGE', title: 'x', body: 'y',
        link: 'https://evil.example/steal',
      })
      expect(res.status).toBe(201)
      expect(res.body.link).toBeNull()
    })
  })

  /* ── DELETE ────────────────────────────────────────────────────── */

  describe('DELETE /notifications/:id', () => {
    it('dismisses the caller’s own row', async () => {
      await clearAll()
      const id = (await notifications.emit({
        userId: aliceId, tenantId: tenantAId, type: 'SYSTEM', title: 'x', body: 'y',
      }))!.id
      const res = await api().delete(`/api/v1/notifications/${id}`).set(asAlice())
      expect(res.status).toBe(200)
      expect(await prisma.notification.findUnique({ where: { id } })).toBeNull()
    })

    it("refuses to delete someone else's → 404, and the row survives", async () => {
      await clearAll()
      const id = (await notifications.emit({
        userId: bobId, tenantId: tenantAId, type: 'SYSTEM', title: 'x', body: 'y',
      }))!.id
      const res = await api().delete(`/api/v1/notifications/${id}`).set(asAlice())
      expect(res.status).toBe(404)
      expect(await prisma.notification.findUnique({ where: { id } })).toBeTruthy()
    })
  })

  /* ── RBAC ──────────────────────────────────────────────────────── */

  describe('RBAC', () => {
    it('no token → 401', async () => {
      const res = await api().get('/api/v1/notifications')
      expect(res.status).toBe(401)
    })

    it('a token WITHOUT sessionId → 401 (revocation would be a no-op)', async () => {
      // Guards against the forged-token failure mode: a suite that minted
      // tokens without sessionId would be testing an unreachable code path.
      const forged = jwt.sign(
        { sub: aliceId, email: 'a@b.c', role: 'PROJECT_MANAGER', tenantId: tenantAId },
        { secret: process.env.JWT_SECRET as string, expiresIn: '5m' },
      )
      const res = await api().get('/api/v1/notifications')
        .set({ Authorization: `Bearer ${forged}` })
      expect(res.status).toBe(401)
    })

    it('a RESIDENT (portal account) → 403 on the list', async () => {
      const residentToken = token(aliceId, tenantAId, 'RESIDENT')
      const res = await api().get('/api/v1/notifications')
        .set({ Authorization: `Bearer ${residentToken}` })
      expect(res.status).toBe(403)
    })

    it('a RESIDENT → 403 on unread-count, mark-all-read and POST', async () => {
      const residentToken = token(aliceId, tenantAId, 'RESIDENT')
      const h = { Authorization: `Bearer ${residentToken}` }
      expect((await api().get('/api/v1/notifications/unread-count').set(h)).status).toBe(403)
      expect((await api().patch('/api/v1/notifications/read-all').set(h).send({})).status).toBe(403)
      expect((await api().post('/api/v1/notifications').set(h)
        .send({ userId: bobId, type: 'MESSAGE', title: 'x', body: 'y' })).status).toBe(403)
    })

    it('a read-only observer role (MUNICIPALITY_USER) still has an inbox', async () => {
      // The class-level fence is about keeping RESIDENT out, not about
      // write-privilege — every staff role receives notifications.
      const observer = token(aliceId, tenantAId, 'MUNICIPALITY_USER')
      const res = await api().get('/api/v1/notifications')
        .set({ Authorization: `Bearer ${observer}` })
      expect(res.status).toBe(200)
    })
  })

  /* ── Tenant isolation ──────────────────────────────────────────── */

  describe('tenant isolation', () => {
    it("a user in tenant B never sees tenant A's notifications", async () => {
      await clearAll()
      await notifications.emit({
        userId: aliceId, tenantId: tenantAId, type: 'TASK', title: 'סודי', body: 'b',
      })
      const res = await api().get('/api/v1/notifications')
        .set({ Authorization: `Bearer ${carolToken}` })
      expect(res.status).toBe(200)
      expect(res.body.items).toHaveLength(0)
    })

    it('a token claiming tenant B cannot read a row addressed to the same user id in tenant A', async () => {
      // Belt-and-braces on the double filter: even holding a valid token for
      // Alice's USER ID but tenant B, her tenant-A rows stay invisible, because
      // the scope filters on both.
      await clearAll()
      const id = (await notifications.emit({
        userId: aliceId, tenantId: tenantAId, type: 'TASK', title: 'x', body: 'b',
      }))!.id
      const wrongTenant = token(aliceId, tenantBId, 'PROJECT_MANAGER')
      const res = await api().patch(`/api/v1/notifications/${id}/read`)
        .set({ Authorization: `Bearer ${wrongTenant}` }).send({})
      expect(res.status).toBe(404)
      expect((await prisma.notification.findUnique({ where: { id } }))!.isRead).toBe(false)
    })
  })

  /* ── Kind registry ─────────────────────────────────────────────── */

  describe('notification kinds', () => {
    it('every kind in the registry is accepted by the API', async () => {
      await clearAll()
      for (const kind of NOTIFICATION_KINDS) {
        const res = await api().post('/api/v1/notifications').set(asAlice())
          .send({ userId: bobId, type: kind, title: kind, body: 'b' })
        expect({ kind, status: res.status }).toEqual({ kind, status: 201 })
      }
    })

    it('MEETING is present — Phase C depends on it', () => {
      expect(NOTIFICATION_KINDS).toContain('MEETING')
    })
  })
})
