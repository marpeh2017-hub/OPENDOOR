/**
 * Resident profile — Portal stage 3c.
 *
 * ── THE TWO PROPERTIES ──────────────────────────────────────────────────────
 *
 * 1. A resident may change exactly five things about themselves, and the list
 *    is enforced rather than documented. `phone` is the login credential;
 *    `ownershipPercentage` decides the pinuy-binuy signature threshold;
 *    `notes` is staff's private commentary about this person. A body carrying
 *    any of them must be REFUSED, not quietly stripped — a silently dropped
 *    field is one refactor away from a silently honoured one.
 *
 * 2. What a resident does to their own record is auditable. `AuditLog.userId`
 *    is a `User` foreign key and a resident has no user row, so the ordinary
 *    `actorFrom(req)` path would produce an insert that fails and is swallowed
 *    — an action with no audit row and a log line nobody reads. These changes
 *    go through `recordAnonymous`, and the tests check the row is really there.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { actorFrom } from '../src/common/actor'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const MARKER = `PROF-${STAMP}`
const SLUG_A = `prof-${STAMP}-a`
const SLUG_B = `prof-${STAMP}-b`
const B_SECRET = `BTENANT${STAMP}`

const PORTAL = '/api/v1/portal/profile'

interface Fixture {
  tenantId: string
  projectId: string
  residentId: string
  neighbourId: string
  managerId: string
}

describe('Resident portal profile (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let A: Fixture
  let B: Fixture
  let residentAToken: string
  let managerAToken: string

  const api = () => request(app.getHttpServer())
  const asResidentA = () => ({ Authorization: `Bearer ${residentAToken}` })

  const residentToken = (residentId: string, tenantId: string, projectId: string) =>
    jwt.sign(
      { sub: residentId, role: 'RESIDENT', tenantId, projectId, residentId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

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
          email: `${firstName.toLowerCase()}@example.com`,
          nationalId: `${MARKER}-id-${flatNo}`,
          notes: `${mark} INTERNAL STAFF NOTE about this resident`,
          ownershipPercentage: 50, isActive: true,
          language: 'he', preferredChannel: 'SMS',
          whatsappOptIn: false, smsOptIn: true, emailOptIn: true,
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
      where: { slug: { startsWith: 'prof-' } }, select: { id: true },
    })
    for (const t of stale) {
      await prisma.ticketReply.deleteMany({ where: { ticket: { tenantId: t.id } } })
      await prisma.supportTicket.deleteMany({ where: { tenantId: t.id } })
      await prisma.notification.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
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

    app = mod.createNestApplication({ rawBody: true })
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
    managerAToken = jwt.sign(
      { sub: A.managerId, email: 'pm@example.com', role: 'PROJECT_MANAGER', tenantId: A.tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  beforeEach(async () => {
    await prisma.supportTicket.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } })
    await prisma.notification.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } })
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } })
    await prisma.resident.update({
      where: { id: A.residentId },
      data: {
        language: 'he', preferredChannel: 'SMS',
        whatsappOptIn: false, smsOptIn: true, emailOptIn: true, doNotContact: false,
      },
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  1. What the profile shows
  // ══════════════════════════════════════════════════════════════════════════

  describe('the profile', () => {
    it("shows the resident's own details and home", async () => {
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.resident.name).toBe('AlphaFirst Levi')
      expect(res.body.home.apartmentNumber).toBe('1')
      expect(res.body.home.buildingAddress).toBe('Alpha street 1')
      expect(res.body.home.ownershipPercentage).toBe(50)
      expect(res.body.standing.signatureStatus).toBe('NOT_CONTACTED')
    })

    it('NEVER returns the national id', async () => {
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(JSON.stringify(res.body)).not.toContain(`${MARKER}-id-1`)
      expect(JSON.stringify(res.body)).not.toContain('nationalId')
    })

    it("NEVER returns staff's internal notes about them", async () => {
      // `notes` is the project team's private commentary ABOUT this person.
      // Reading it back to them from their own profile would be a disclosure
      // nobody decided to make.
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(JSON.stringify(res.body)).not.toContain('INTERNAL STAFF NOTE')
      expect(JSON.stringify(res.body)).not.toContain('notes')
    })

    it('shows a do-not-contact flag it does not let them change', async () => {
      // Visible so a resident who asked for silence can see it is recorded,
      // rather than wondering why the project has gone quiet.
      await prisma.resident.update({ where: { id: A.residentId }, data: { doNotContact: true } })
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(res.body.preferences.doNotContact).toBe(true)
    })

    it("does not leak the neighbour or the other tenant", async () => {
      const res = await api().get(PORTAL).set(asResidentA()).expect(200)
      const body = JSON.stringify(res.body)
      expect(body).not.toContain('AlphaNeighbour')
      expect(body).not.toContain(B_SECRET)
      expect(body).not.toContain(A.neighbourId)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  2. The five fields — and everything that is not one of them
  // ══════════════════════════════════════════════════════════════════════════

  describe('what a resident may change', () => {
    it('changes language and preferred channel', async () => {
      const res = await api().patch(PORTAL).set(asResidentA())
        .send({ language: 'ru', preferredChannel: 'WHATSAPP' })
      expect(res.status).toBe(200)
      expect(res.body.changed).toBe(true)
      expect(res.body.changedFields.sort()).toEqual(['language', 'preferredChannel'])

      const row = await prisma.resident.findUniqueOrThrow({
        where: { id: A.residentId }, select: { language: true, preferredChannel: true },
      })
      expect(row.language).toBe('ru')
      expect(row.preferredChannel).toBe('WHATSAPP')
    })

    it('changes their own consent flags', async () => {
      await api().patch(PORTAL).set(asResidentA())
        .send({ smsOptIn: false, whatsappOptIn: true }).expect(200)

      const row = await prisma.resident.findUniqueOrThrow({
        where: { id: A.residentId }, select: { smsOptIn: true, whatsappOptIn: true },
      })
      expect(row.smsOptIn).toBe(false)
      expect(row.whatsappOptIn).toBe(true)
    })

    it('reports no change rather than writing one, when nothing differs', async () => {
      const res = await api().patch(PORTAL).set(asResidentA())
        .send({ language: 'he' }).expect(200)
      expect(res.body.changed).toBe(false)

      const audits = await prisma.auditLog.count({ where: { tenantId: A.tenantId } })
      // An audit trail full of "changed he to he" is one nobody reads.
      expect(audits).toBe(0)
    })

    const forbidden: [string, unknown][] = [
      ['phone', '0501112233'],
      ['email', 'new@example.com'],
      ['firstName', 'Somebody'],
      ['lastName', 'Else'],
      ['nationalId', '123456789'],
      ['ownershipPercentage', 100],
      ['notes', 'I wrote this myself'],
      ['isPrimaryContact', true],
      ['doNotContact', true],
      ['signatureStatus', 'SIGNED'],
      ['isObjecting', true],
      ['portalInboxEnabled', true],
      ['tenantId', 'someone-elses-tenant'],
      ['apartmentId', 'someone-elses-apartment'],
    ]

    it.each(forbidden)('REFUSES to let a resident set %s', async (field, value) => {
      /*
       * Refused, not stripped. `forbidNonWhitelisted` turns an unexpected field
       * into a 400, which means the day somebody adds one of these to the DTO
       * by accident, a test fails rather than a resident silently gaining the
       * ability to rewrite their own ownership share.
       */
      const res = await api().patch(PORTAL).set(asResidentA()).send({ [field]: value })
      expect(res.status).toBe(400)
    })

    it('the ownership share and the phone are genuinely unchanged after all that', async () => {
      for (const [field, value] of forbidden) {
        await api().patch(PORTAL).set(asResidentA()).send({ [field]: value })
      }
      const row = await prisma.resident.findUniqueOrThrow({
        where: { id: A.residentId },
        select: { phone: true, ownershipPercentage: true, notes: true, signatureStatus: true },
      })
      expect(row.phone).toBe('0509900001')
      expect(row.ownershipPercentage).toBe(50)
      expect(row.notes).toContain('INTERNAL STAFF NOTE')
      expect(row.signatureStatus).toBe('NOT_CONTACTED')
    })

    it('rejects a value outside the allowed set', async () => {
      await api().patch(PORTAL).set(asResidentA()).send({ language: 'klingon' }).expect(400)
      // PUSH has no provider and PORTAL is a staff routing decision.
      await api().patch(PORTAL).set(asResidentA()).send({ preferredChannel: 'PUSH' }).expect(400)
      await api().patch(PORTAL).set(asResidentA()).send({ preferredChannel: 'PORTAL' }).expect(400)
    })

    it('cannot change the NEIGHBOUR, whatever the session says', async () => {
      const beforeNeighbour = await prisma.resident.findUniqueOrThrow({
        where: { id: A.neighbourId }, select: { language: true },
      })
      await api().patch(PORTAL).set(asResidentA()).send({ language: 'ar' }).expect(200)
      const afterNeighbour = await prisma.resident.findUniqueOrThrow({
        where: { id: A.neighbourId }, select: { language: true },
      })
      expect(afterNeighbour.language).toBe(beforeNeighbour.language)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  3. The audit trail for an actor with no user row
  // ══════════════════════════════════════════════════════════════════════════

  describe('auditing a resident-initiated change', () => {
    it('writes an audit row naming the resident, with a null user', async () => {
      await api().patch(PORTAL).set(asResidentA()).send({ smsOptIn: false }).expect(200)

      const entry = await prisma.auditLog.findFirst({
        where: { tenantId: A.tenantId, entity: 'Resident', entityId: A.residentId },
        orderBy: { createdAt: 'desc' },
        select: { userId: true, action: true, changes: true, metadata: true },
      })
      expect(entry).not.toBeNull()
      // Null because `AuditLog.userId` is a `User` FK and a resident has none —
      // which is exactly why the actor has to be legible from the metadata.
      expect(entry!.userId).toBeNull()
      expect(entry!.action).toBe('UPDATE')
      const meta = entry!.metadata as Record<string, unknown>
      expect(meta.actor).toBe('RESIDENT')
      expect(meta.residentId).toBe(A.residentId)
      expect(meta.selfService).toBe(true)

      // "They agreed to be contacted, then withdrew it on this date" is the
      // whole point of the record.
      const changes = entry!.changes as { before: Record<string, unknown>; after: Record<string, unknown> }
      expect(changes.before.smsOptIn).toBe(true)
      expect(changes.after.smsOptIn).toBe(false)
    })

    it('`actorFrom` REFUSES a resident session rather than losing the row', async () => {
      /*
       * The trap this guards. `req.user.userId` on a portal token is the
       * RESIDENT id; `AuditService.record` catches the resulting foreign-key
       * failure and only logs it, so the action would happen with no audit row
       * at all. A loud throw at the call site beats a hole found months later.
       */
      expect(() =>
        actorFrom({
          user: { tenantId: A.tenantId, userId: A.residentId, role: 'RESIDENT' },
          headers: {},
        }),
      ).toThrow(/recordAnonymous/)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  4. Asking a human for what they may not change themselves
  // ══════════════════════════════════════════════════════════════════════════

  describe('contact update requests', () => {
    const REQUEST = `${PORTAL}/contact-update-request`

    it('files a ticket and tells the project manager', async () => {
      const res = await api().post(REQUEST).set(asResidentA())
        .send({ message: 'החלפתי מספר, נא לעדכן ל-050-0000000' })
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('OPEN')

      const ticket = await prisma.supportTicket.findUniqueOrThrow({
        where: { id: res.body.id },
        select: { residentId: true, tenantId: true, category: true, description: true },
      })
      expect(ticket.residentId).toBe(A.residentId)
      expect(ticket.tenantId).toBe(A.tenantId)
      expect(ticket.category).toBe('CONTACT_UPDATE')
      expect(ticket.description).toContain('החלפתי מספר')

      // The support inbox does not exist yet, so the request has to reach a
      // person some other way or it is not a request.
      const notification = await prisma.notification.findFirst({
        where: { tenantId: A.tenantId, entityType: 'SupportTicket', entityId: res.body.id },
        select: { userId: true, type: true },
      })
      expect(notification).not.toBeNull()
      expect(notification!.userId).toBe(A.managerId)
    })

    it('does NOT apply the requested change', async () => {
      await api().post(REQUEST).set(asResidentA())
        .send({ message: 'הטלפון החדש שלי הוא 0501112233' }).expect(201)

      const row = await prisma.resident.findUniqueOrThrow({
        where: { id: A.residentId }, select: { phone: true },
      })
      // A human reading the request and satisfying themselves about who is
      // asking IS the control. Nothing here is automatic.
      expect(row.phone).toBe('0509900001')
    })

    it('refuses a second request while one is still open', async () => {
      const first = await api().post(REQUEST).set(asResidentA())
        .send({ message: 'בקשה ראשונה' }).expect(201)

      const second = await api().post(REQUEST).set(asResidentA())
        .send({ message: 'בקשה שנייה' })
      expect(second.status).toBe(400)
      expect(second.body.code).toBe('CONTACT_REQUEST_ALREADY_OPEN')
      expect(second.body.ticketId).toBe(first.body.id)

      expect(await prisma.supportTicket.count({ where: { residentId: A.residentId } })).toBe(1)
    })

    it('allows a new one once the previous is resolved', async () => {
      const first = await api().post(REQUEST).set(asResidentA())
        .send({ message: 'בקשה ראשונה' }).expect(201)
      await prisma.supportTicket.update({
        where: { id: first.body.id }, data: { status: 'RESOLVED', resolvedAt: new Date() },
      })

      await api().post(REQUEST).set(asResidentA()).send({ message: 'בקשה חדשה' }).expect(201)
    })

    it('surfaces the open request on the profile', async () => {
      const filed = await api().post(REQUEST).set(asResidentA())
        .send({ message: 'נא לעדכן' }).expect(201)

      const profile = await api().get(PORTAL).set(asResidentA()).expect(200)
      expect(profile.body.pendingContactRequest.id).toBe(filed.body.id)
    })

    it('rejects an empty or oversized message', async () => {
      await api().post(REQUEST).set(asResidentA()).send({ message: '' }).expect(400)
      await api().post(REQUEST).set(asResidentA()).send({ message: 'x'.repeat(1001) }).expect(400)
    })

    it('rejects a body that names another resident or tenant', async () => {
      const res = await api().post(REQUEST).set(asResidentA())
        .send({ message: 'נא לעדכן', residentId: A.neighbourId, tenantId: B.tenantId })
      expect(res.status).toBe(400)
    })

    it('a ticket lands in the resident\'s OWN tenant, never elsewhere', async () => {
      await api().post(REQUEST).set(asResidentA()).send({ message: 'בדיקה' }).expect(201)
      expect(await prisma.supportTicket.count({ where: { tenantId: B.tenantId } })).toBe(0)
    })

    it('audits the request with the resident as the actor', async () => {
      const filed = await api().post(REQUEST).set(asResidentA())
        .send({ message: 'נא לעדכן' }).expect(201)

      const entry = await prisma.auditLog.findFirst({
        where: { tenantId: A.tenantId, entity: 'SupportTicket', entityId: filed.body.id },
        select: { userId: true, metadata: true },
      })
      expect(entry).not.toBeNull()
      expect(entry!.userId).toBeNull()
      expect((entry!.metadata as Record<string, unknown>).residentId).toBe(A.residentId)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  5. Access
  // ══════════════════════════════════════════════════════════════════════════

  describe('access', () => {
    it('rejects an anonymous caller on read and on write', async () => {
      await api().get(PORTAL).expect(401)
      await api().patch(PORTAL).send({ language: 'en' }).expect(401)
    })

    it('rejects a staff token', async () => {
      const res = await api().get(PORTAL).set({ Authorization: `Bearer ${managerAToken}` })
      expect(res.status).toBe(403)
      const patch = await api().patch(PORTAL)
        .set({ Authorization: `Bearer ${managerAToken}` }).send({ language: 'en' })
      expect(patch.status).toBe(403)
    })

    it('a resident of tenant B sees tenant B', async () => {
      const tokenB = residentToken(B.residentId, B.tenantId, B.projectId)
      const res = await api().get(PORTAL).set({ Authorization: `Bearer ${tokenB}` }).expect(200)
      expect(res.body.resident.name).toContain(B_SECRET)
      expect(JSON.stringify(res.body)).not.toContain('Alpha')
    })

    it('a token whose project claim is forged is refused', async () => {
      const forged = residentToken(A.residentId, A.tenantId, B.projectId)
      const res = await api().get(PORTAL).set({ Authorization: `Bearer ${forged}` })
      expect(res.status).toBe(401)
      expect(res.body.code).toBe('PORTAL_SCOPE_CHANGED')
    })
  })
})
