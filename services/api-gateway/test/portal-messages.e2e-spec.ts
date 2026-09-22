/**
 * Resident messages — Portal stage 3b.
 *
 * ── THE PROPERTY THAT MATTERS MOST HERE ─────────────────────────────────────
 *
 * Not isolation, though that is held too. It is that the portal must never tell
 * a resident they were informed of something the system did not manage to send.
 * A `Message` row exists from the moment somebody presses send, in `QUEUED`;
 * `FAILED` and `CANCELLED` rows are messages that never arrived. In a
 * pinuy-binuy project "you were notified" is a claim that gets made in front of
 * a lawyer, and the portal must not be the thing that manufactures it.
 *
 * ── AND THE WRITER THAT WAS MISSING ─────────────────────────────────────────
 *
 * Unlike documents, the message WRITE side already existed and is in use.
 * What did not exist was any way to turn on `Resident.portalInboxEnabled` — the gate
 * `ResidentContactService` checks before it will route anything down the PORTAL
 * channel. Only the seed ever set it, so the channel built specifically for
 * this page was unreachable for every resident created through the API. The
 * endpoint that fixes that is covered at the bottom.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { ResidentContactService } from '../src/messaging/resident-contact.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const MARKER = `MSGS-${STAMP}`
const SLUG_A = `msgs-${STAMP}-a`
const SLUG_B = `msgs-${STAMP}-b`
const B_SECRET = `BTENANT${STAMP}`

const PORTAL = '/api/v1/portal/messages'

interface Fixture {
  tenantId: string
  projectId: string
  residentId: string
  neighbourId: string
  managerId: string
}

describe('Resident portal messages (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let A: Fixture
  let B: Fixture
  let residentAToken: string
  let managerAToken: string
  let lawyerAToken: string
  let managerBToken: string

  const api = () => request(app.getHttpServer())
  const asResidentA = () => ({ Authorization: `Bearer ${residentAToken}` })
  const asManagerA = () => ({ Authorization: `Bearer ${managerAToken}` })

  const residentToken = (residentId: string, tenantId: string, projectId: string) =>
    jwt.sign(
      { sub: residentId, role: 'RESIDENT', tenantId, projectId, residentId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const staffToken = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  /** A message row in whatever state the test needs it. */
  const makeMessage = async (
    f: Fixture,
    body: string,
    extra: Record<string, unknown> = {},
  ) =>
    prisma.message.create({
      data: {
        tenantId: f.tenantId, residentId: f.residentId,
        channel: 'SMS', direction: 'OUTBOUND', status: 'SENT',
        sentAt: new Date(), body,
        ...extra,
      },
      select: { id: true },
    })

  const makeTenant = async (slug: string, label: string, mark: string): Promise<Fixture> => {
    const tenant = await prisma.tenant.create({ data: { name: slug, slug } })
    const manager = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `${MARKER}-pm-${randomUUID().slice(0, 6)}@example.com`.toLowerCase(),
        firstName: `${mark}Manager`, lastName: 'Cohen',
        passwordHash: 'not-a-usable-credential', role: 'PROJECT_MANAGER' as never,
      },
      select: { id: true },
    })
    const project = await prisma.project.create({
      data: {
        tenantId: tenant.id, code: `${MARKER}-${label}`, name: `${mark} Project`,
        city: 'תל אביב', stage: 'SIGNATURES', projectManagerId: manager.id,
      },
    })
    const complex = await prisma.complex.create({
      data: { projectId: project.id, name: `${mark} complex` },
    })
    const building = await prisma.building.create({
      data: { complexId: complex.id, address: `${mark} street 1` },
    })
    const makeResident = async (flatNo: string, firstName: string) => {
      const apartment = await prisma.apartment.create({
        data: { buildingId: building.id, apartmentNumber: flatNo },
      })
      return (await prisma.resident.create({
        data: {
          tenantId: tenant.id, apartmentId: apartment.id,
          firstName, lastName: 'Levi', phone: `05099${flatNo.padStart(5, '0')}`,
          isActive: true, portalInboxEnabled: false,
        },
        select: { id: true },
      })).id
    }
    return {
      tenantId: tenant.id, projectId: project.id,
      residentId: await makeResident('1', `${mark}First`),
      neighbourId: await makeResident('2', `${mark}Neighbour`),
      managerId: manager.id,
    }
  }

  const purge = async () => {
    const stale = await prisma.tenant.findMany({
      where: { slug: { startsWith: 'msgs-' } }, select: { id: true },
    })
    for (const t of stale) {
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.message.deleteMany({ where: { tenantId: t.id } })
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } }).catch(() => undefined)
    }
  }

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({ totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }),
      })
      .compile()

    app = mod.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService)
    jwt = app.get(JwtService, { strict: false })

    await purge()
    A = await makeTenant(SLUG_A, 'A', 'Alpha')
    B = await makeTenant(SLUG_B, 'B', B_SECRET)

    residentAToken = residentToken(A.residentId, A.tenantId, A.projectId)
    managerAToken = staffToken(A.managerId, A.tenantId, 'PROJECT_MANAGER')
    lawyerAToken = staffToken(A.managerId, A.tenantId, 'LAWYER')
    managerBToken = staffToken(B.managerId, B.tenantId, 'PROJECT_MANAGER')
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  beforeEach(async () => {
    await prisma.message.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  1. Only what actually reached them
  // ══════════════════════════════════════════════════════════════════════════

  describe('what counts as a message the resident received', () => {
    it('shows a SENT message', async () => {
      await makeMessage(A, 'AlphaSent: אסיפת דיירים ביום ראשון')
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.total).toBe(1)
      expect(res.body.messages[0].body).toContain('AlphaSent')
    })

    it('shows DELIVERED and READ too', async () => {
      await makeMessage(A, 'AlphaDelivered', { status: 'DELIVERED', deliveredAt: new Date() })
      await makeMessage(A, 'AlphaRead', { status: 'READ' })
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.total).toBe(2)
    })

    it('HIDES a queued message — it has not been sent yet', async () => {
      await makeMessage(A, 'AlphaQueued', { status: 'QUEUED', sentAt: null })
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.total).toBe(0)
    })

    it('HIDES a failed message — telling them they were informed would be false', async () => {
      await makeMessage(A, 'AlphaFailed', {
        status: 'FAILED', sentAt: null, failedAt: new Date(), failureReason: 'carrier rejected',
      })
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.total).toBe(0)
      expect(JSON.stringify(res.body)).not.toContain('AlphaFailed')
    })

    it('HIDES a cancelled and a still-processing message', async () => {
      await makeMessage(A, 'AlphaCancelled', { status: 'CANCELLED', sentAt: null })
      await makeMessage(A, 'AlphaProcessing', { status: 'PROCESSING', sentAt: null })
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.total).toBe(0)
    })

    it('HIDES an inbound message — this list is what the project SAID to them', async () => {
      // Nothing writes INBOUND today, but the filter should not depend on that
      // staying true: a reply feature must not retroactively fill this page
      // with the resident's own words presented as the project's.
      await makeMessage(A, 'AlphaInbound', { direction: 'INBOUND' })
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.total).toBe(0)
    })

    it('reports the moment it LEFT, not the moment it was composed', async () => {
      // A message that sat in the queue for an hour was received an hour later.
      const composed = new Date('2026-05-01T08:00:00Z')
      const left = new Date('2026-05-01T09:00:00Z')
      await makeMessage(A, 'AlphaDelayed', { createdAt: composed, sentAt: left })
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(new Date(res.body.messages[0].sentAt).toISOString()).toBe(left.toISOString())
    })

    it('says whether a rule or a person sent it', async () => {
      const automation = await prisma.automation.create({
        data: {
          tenantId: A.tenantId, name: `${MARKER} auto`, trigger: 'RESIDENT_CREATED',
          isActive: false, dryRun: true,
        },
        select: { id: true },
      })
      await makeMessage(A, 'AlphaByHand')
      await makeMessage(A, 'AlphaByRule', { automationId: automation.id })

      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      const byBody = Object.fromEntries(
        res.body.messages.map((m: { body: string; automated: boolean }) => [m.body, m.automated]),
      )
      expect(byBody['AlphaByRule']).toBe(true)
      expect(byBody['AlphaByHand']).toBe(false)

      await prisma.message.deleteMany({ where: { automationId: automation.id } })
      await prisma.automation.delete({ where: { id: automation.id } })
    })

    it('names the project as the sender — no individual author is recorded', async () => {
      await makeMessage(A, 'AlphaFrom')
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.from).toBe('Alpha Project')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  2. Isolation
  // ══════════════════════════════════════════════════════════════════════════

  describe('isolation', () => {
    it("does NOT show a neighbour's messages from the same project", async () => {
      await prisma.message.create({
        data: {
          tenantId: A.tenantId, residentId: A.neighbourId, channel: 'SMS',
          direction: 'OUTBOUND', status: 'SENT', sentAt: new Date(),
          body: 'AlphaNeighbourPrivateMessage',
        },
      })
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.total).toBe(0)
      expect(JSON.stringify(res.body)).not.toContain('NeighbourPrivate')
    })

    it('does NOT show a message carrying another tenant id', async () => {
      await prisma.message.create({
        data: {
          tenantId: B.tenantId, residentId: A.residentId, channel: 'SMS',
          direction: 'OUTBOUND', status: 'SENT', sentAt: new Date(),
          body: `${B_SECRET}CrossTenantMessage`,
        },
      })
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(JSON.stringify(res.body)).not.toContain(B_SECRET)
      expect(res.body.total).toBe(0)
    })

    it('does NOT show a broadcast with no resident attached', async () => {
      // A message to a bare phone number is not addressed to a resident record,
      // and must not be adopted by whoever happens to hold that number.
      await prisma.message.create({
        data: {
          tenantId: A.tenantId, residentId: null, toPhone: '0509900001',
          channel: 'SMS', direction: 'OUTBOUND', status: 'SENT', sentAt: new Date(),
          body: 'AlphaUnaddressedBroadcast',
        },
      })
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.total).toBe(0)
    })

    it("a resident of tenant B sees tenant B's messages, never tenant A's", async () => {
      await makeMessage(A, 'AlphaOnly')
      await prisma.message.create({
        data: {
          tenantId: B.tenantId, residentId: B.residentId, channel: 'SMS',
          direction: 'OUTBOUND', status: 'SENT', sentAt: new Date(),
          body: `${B_SECRET}OwnMessage`,
        },
      })
      const tokenB = residentToken(B.residentId, B.tenantId, B.projectId)
      const res = await api().get(PORTAL).set({ Authorization: `Bearer ${tokenB}` }).expect(200)
      expect(res.body.total).toBe(1)
      expect(JSON.stringify(res.body)).not.toContain('AlphaOnly')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  3. Paging — the first portal query parameters
  // ══════════════════════════════════════════════════════════════════════════

  describe('paging', () => {
    const makeMany = async (n: number) => {
      for (let i = 0; i < n; i++) {
        await prisma.message.create({
          data: {
            tenantId: A.tenantId, residentId: A.residentId, channel: 'SMS',
            direction: 'OUTBOUND', status: 'SENT',
            sentAt: new Date(Date.now() - i * 60_000),
            createdAt: new Date(Date.now() - i * 60_000),
            body: `AlphaPaged-${String(i).padStart(3, '0')}`,
          },
        })
      }
    }

    it('returns newest first, capped, and reports the true total', async () => {
      await makeMany(8)
      const res = await api().get(`${PORTAL}?limit=3`).set(asResidentA()).expect(200)
      expect(res.body.messages).toHaveLength(3)
      expect(res.body.total).toBe(8)
      expect(res.body.messages[0].body).toBe('AlphaPaged-000')
      expect(res.body.nextCursor).not.toBeNull()
    })

    it('walks the whole list through the cursor without repeating or skipping', async () => {
      await makeMany(7)
      const seen: string[] = []
      let cursor: string | null = null
      for (let page = 0; page < 5; page++) {
        const url: string = `${PORTAL}?limit=3${cursor ? `&cursor=${cursor}` : ''}`
        const res = await api().get(url).set(asResidentA()).expect(200)
        seen.push(...res.body.messages.map((m: { body: string }) => m.body))
        cursor = res.body.nextCursor
        if (!cursor) break
      }
      expect(seen).toHaveLength(7)
      expect(new Set(seen).size).toBe(7)
      expect(cursor).toBeNull()
    })

    it("a cursor naming ANOTHER resident's message does not reach across", async () => {
      await makeMany(3)
      const theirs = await prisma.message.create({
        data: {
          tenantId: A.tenantId, residentId: A.neighbourId, channel: 'SMS',
          direction: 'OUTBOUND', status: 'SENT', sentAt: new Date(),
          body: 'AlphaNeighbourCursorTarget',
        },
        select: { id: true },
      })

      // The cursor is applied inside the already-scoped query, so a foreign id
      // matches nothing rather than acting as a window into their list.
      const res = await api().get(`${PORTAL}?cursor=${theirs.id}`).set(asResidentA())
      expect(res.status).toBe(200)
      expect(JSON.stringify(res.body)).not.toContain('NeighbourCursorTarget')
    })

    it('REJECTS an ownership parameter smuggled in beside a paging one', async () => {
      /*
       * The distinction the DTO exists to enforce: `limit` and `cursor` choose
       * how much of your own list to return; `residentId` would choose whose.
       * `forbidNonWhitelisted` makes the second a 400 rather than a field that
       * is quietly dropped today and quietly honoured after some later
       * refactor.
       */
      const res = await api()
        .get(`${PORTAL}?limit=5&residentId=${A.neighbourId}`)
        .set(asResidentA())
      expect(res.status).toBe(400)
    })

    it('rejects a limit outside the allowed range', async () => {
      await api().get(`${PORTAL}?limit=0`).set(asResidentA()).expect(400)
      await api().get(`${PORTAL}?limit=500`).set(asResidentA()).expect(400)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  4. Access
  // ══════════════════════════════════════════════════════════════════════════

  describe('access', () => {
    it('rejects an anonymous caller', async () => {
      await api().get(PORTAL).expect(401)
    })

    it('rejects a staff token', async () => {
      const res = await api().get(PORTAL).set(asManagerA())
      expect(res.status).toBe(403)
    })

    it('rejects a resident token with no project scope', async () => {
      const scopeless = jwt.sign(
        { sub: A.residentId, role: 'RESIDENT', tenantId: A.tenantId, sessionId: randomUUID() },
        { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
      )
      const res = await api().get(PORTAL).set({ Authorization: `Bearer ${scopeless}` })
      expect(res.status).toBe(401)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  5. The writer that was missing: turning the PORTAL channel on
  // ══════════════════════════════════════════════════════════════════════════

  describe('portal access, from the CRM', () => {
    const accessApi = (residentId: string) => `/api/v1/residents/${residentId}/portal-inbox`

    afterEach(async () => {
      await prisma.resident.updateMany({
        where: { id: { in: [A.residentId, A.neighbourId] } },
        data: { portalInboxEnabled: false },
      })
      // The audit log is append-only by design, so a test that counts entries
      // has to start from a known state rather than from whatever the previous
      // one left behind.
      await prisma.auditLog.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } })
    })

    it('enables the inbox, and the change is real', async () => {
      const res = await api().patch(accessApi(A.residentId)).set(asManagerA())
        .send({ enabled: true })
      expect(res.status).toBe(200)
      expect(res.body.portalInboxEnabled).toBe(true)
      expect(res.body.changed).toBe(true)

      const row = await prisma.resident.findUniqueOrThrow({
        where: { id: A.residentId }, select: { portalInboxEnabled: true },
      })
      expect(row.portalInboxEnabled).toBe(true)
    })

    it('is idempotent and says so, rather than writing a second audit entry', async () => {
      await api().patch(accessApi(A.residentId)).set(asManagerA()).send({ enabled: true }).expect(200)
      const again = await api().patch(accessApi(A.residentId)).set(asManagerA())
        .send({ enabled: true }).expect(200)
      expect(again.body.changed).toBe(false)

      const entries = await prisma.auditLog.count({
        where: {
          tenantId: A.tenantId, entity: 'Resident', entityId: A.residentId,
          metadata: { path: ['grant'], equals: 'PORTAL_INBOX_ENABLED' },
        },
      })
      expect(entries).toBe(1)
    })

    it('records the grant, and the withdrawal, in the audit log', async () => {
      await api().patch(accessApi(A.residentId)).set(asManagerA()).send({ enabled: true }).expect(200)
      await api().patch(accessApi(A.residentId)).set(asManagerA()).send({ enabled: false }).expect(200)

      const off = await prisma.auditLog.findFirst({
        where: {
          tenantId: A.tenantId, entityId: A.residentId,
          metadata: { path: ['grant'], equals: 'PORTAL_INBOX_DISABLED' },
        },
        select: { userId: true },
      })
      expect(off).not.toBeNull()
      expect(off!.userId).toBe(A.managerId)
    })

    it('REFUSES a resident in another tenant', async () => {
      const res = await api().patch(accessApi(B.residentId)).set(asManagerA())
        .send({ enabled: true })
      expect(res.status).toBe(404)

      const row = await prisma.resident.findUniqueOrThrow({
        where: { id: B.residentId }, select: { portalInboxEnabled: true },
      })
      expect(row.portalInboxEnabled).toBe(false)
    })

    it('REFUSES a manager from another tenant', async () => {
      const res = await api().patch(accessApi(A.residentId))
        .set({ Authorization: `Bearer ${managerBToken}` }).send({ enabled: true })
      expect(res.status).toBe(404)
    })

    it('REFUSES a staff role outside RESIDENT_WRITE_ROLES', async () => {
      const res = await api().patch(accessApi(A.residentId))
        .set({ Authorization: `Bearer ${lawyerAToken}` }).send({ enabled: true })
      expect(res.status).toBe(403)
    })

    it('REFUSES to enable it for an archived resident', async () => {
      await prisma.resident.update({ where: { id: A.neighbourId }, data: { isActive: false } })
      const res = await api().patch(accessApi(A.neighbourId)).set(asManagerA())
        .send({ enabled: true })
      expect(res.status).toBe(400)
      await prisma.resident.update({ where: { id: A.neighbourId }, data: { isActive: true } })
    })

    it('rejects a body that tries to set anything else', async () => {
      const res = await api().patch(accessApi(A.residentId)).set(asManagerA())
        .send({ enabled: true, tenantId: B.tenantId })
      expect(res.status).toBe(400)
    })

    it('makes the PORTAL channel selectable for a resident who refuses every other one', async () => {
      /*
       * The point of the whole endpoint. `ResidentContactService` walks
       * WhatsApp → SMS → email → portal; with every opt-in off, the portal is
       * the only channel left, and before this flag could be set it was
       * unreachable — the resident was simply uncontactable.
       */
      await prisma.resident.update({
        where: { id: A.residentId },
        data: { whatsappOptIn: false, smsOptIn: false, emailOptIn: false, portalInboxEnabled: false },
      })

      const contact = app.get(ResidentContactService)

      // Every opt-in off and no portal: the router has nothing left to choose.
      const before = await contact.route(A.tenantId, A.residentId)
      expect(JSON.stringify(before)).not.toContain('PORTAL')

      await api().patch(accessApi(A.residentId)).set(asManagerA()).send({ enabled: true }).expect(200)

      const after = await contact.route(A.tenantId, A.residentId)
      expect(JSON.stringify(after)).toContain('PORTAL')

      await prisma.resident.update({
        where: { id: A.residentId },
        data: { smsOptIn: true, emailOptIn: true },
      })
    })
  })
})
