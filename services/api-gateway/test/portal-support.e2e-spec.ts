/**
 * Resident support — Portal stage 3d.
 *
 * ── THE TWO PROPERTIES THIS SUITE EXISTS FOR ────────────────────────────────
 *
 * 1. A TICKET IS PERSONAL, NOT A HOUSEHOLD MATTER. The fixture puts TWO
 *    residents in ONE apartment — the case the dev seed does not contain and
 *    the one the decision was made for. Co-owners of a pinuy-binuy apartment
 *    are routinely heirs contesting an estate or a couple separating; the
 *    ownership model carries `viaInheritance` and `poaHolderId` for exactly
 *    that reason. Neither may read the other's ticket.
 *
 * 2. `isInternal` REPLIES NEVER LEAVE. That flag is the only thing between the
 *    project team's private assessment of a resident and that resident. Every
 *    read path is checked, including the reply COUNT — a ticket with three
 *    internal notes and no answer must not look answered.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const MARKER = `SUP-${STAMP}`
const SLUG_A = `sup-${STAMP}-a`
const SLUG_B = `sup-${STAMP}-b`
const B_SECRET = `BTENANT${STAMP}`

const PORTAL = '/api/v1/portal/support'

interface Fixture {
  tenantId: string
  projectId: string
  apartmentId: string
  /** Two residents sharing ONE apartment — the case the seed does not have. */
  residentId: string
  coResidentId: string
  managerId: string
}

describe('Resident portal support (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let A: Fixture
  let B: Fixture
  let mine: string
  let coResident: string
  let staffA: string

  const api = () => request(app.getHttpServer())
  const asMe = () => ({ Authorization: `Bearer ${mine}` })
  const asCoResident = () => ({ Authorization: `Bearer ${coResident}` })

  const residentToken = (residentId: string, tenantId: string, projectId: string) =>
    jwt.sign(
      { sub: residentId, role: 'RESIDENT', tenantId, projectId, residentId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const makeTicket = async (f: Fixture, residentId: string, subject: string, extra = {}) =>
    prisma.supportTicket.create({
      data: {
        tenantId: f.tenantId, residentId, subject,
        description: `${subject} — description`, status: 'OPEN', category: 'GENERAL',
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
        signatureGoal: 67, signatureActual: 40, signedUnits: 8, totalUnits: 20,
        targetEndDate: new Date('2028-06-30T00:00:00Z'),
      },
    })
    const complex = await prisma.complex.create({
      data: { projectId: project.id, name: `${mark} complex` },
    })
    const building = await prisma.building.create({
      data: { complexId: complex.id, address: `${mark} street 1` },
    })

    // ONE apartment, TWO residents — jointly owned, half each.
    const apartment = await prisma.apartment.create({
      data: { buildingId: building.id, apartmentNumber: '7' },
    })
    const makeResident = async (firstName: string, phoneSuffix: string, primary: boolean) =>
      (await prisma.resident.create({
        data: {
          tenantId: tenant.id, apartmentId: apartment.id,
          firstName, lastName: 'Levi', phone: `05099${phoneSuffix}`,
          ownershipPercentage: 50, isPrimaryContact: primary, isActive: true,
        },
        select: { id: true },
      })).id

    return {
      tenantId: tenant.id, projectId: project.id, apartmentId: apartment.id,
      residentId: await makeResident(`${mark}First`, '10001', true),
      coResidentId: await makeResident(`${mark}Sibling`, '10002', false),
      managerId: manager.id,
    }
  }

  const purge = async () => {
    const stale = await prisma.tenant.findMany({
      where: { slug: { startsWith: 'sup-' } }, select: { id: true },
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

    mine = residentToken(A.residentId, A.tenantId, A.projectId)
    coResident = residentToken(A.coResidentId, A.tenantId, A.projectId)
    staffA = jwt.sign(
      { sub: A.managerId, email: 'pm@example.com', role: 'PROJECT_MANAGER', tenantId: A.tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  beforeEach(async () => {
    await prisma.ticketReply.deleteMany({
      where: { ticket: { tenantId: { in: [A.tenantId, B.tenantId] } } },
    })
    await prisma.supportTicket.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } })
    await prisma.notification.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } })
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  1. Two residents, one apartment
  // ══════════════════════════════════════════════════════════════════════════

  describe('a ticket belongs to a person, not to a household', () => {
    it('the fixture really is two residents in one apartment', async () => {
      const residents = await prisma.resident.findMany({
        where: { apartmentId: A.apartmentId }, select: { id: true, ownershipPercentage: true },
      })
      expect(residents).toHaveLength(2)
      expect(residents.every((r) => r.ownershipPercentage === 50)).toBe(true)
    })

    it("does NOT show a co-resident's ticket in the list", async () => {
      await makeTicket(A, A.coResidentId, 'AlphaSiblingPrivateMatter')
      const res = await api().get(PORTAL).set(asMe()).expect(200)
      expect(res.body.tickets).toHaveLength(0)
      expect(JSON.stringify(res.body)).not.toContain('SiblingPrivateMatter')
    })

    it("404s on a co-resident's ticket by id — the same front door, a different file", async () => {
      const theirs = await makeTicket(A, A.coResidentId, 'AlphaSiblingEstateDispute')
      const res = await api().get(`${PORTAL}/${theirs.id}`).set(asMe())
      expect(res.status).toBe(404)
      expect(res.body.code).toBe('TICKET_NOT_FOUND')
    })

    it("REFUSES to reply into a co-resident's ticket", async () => {
      const theirs = await makeTicket(A, A.coResidentId, 'AlphaSiblingThread')
      const res = await api().post(`${PORTAL}/${theirs.id}/replies`).set(asMe())
        .send({ body: 'I want to say something in my sibling\'s case' })
      expect(res.status).toBe(404)

      expect(await prisma.ticketReply.count({ where: { ticketId: theirs.id } })).toBe(0)
    })

    it('each of the two sees exactly their own', async () => {
      await makeTicket(A, A.residentId, 'AlphaMineOnly')
      await makeTicket(A, A.coResidentId, 'AlphaTheirsOnly')

      const first = await api().get(PORTAL).set(asMe()).expect(200)
      const second = await api().get(PORTAL).set(asCoResident()).expect(200)

      expect(first.body.tickets.map((t: { subject: string }) => t.subject)).toEqual(['AlphaMineOnly'])
      expect(second.body.tickets.map((t: { subject: string }) => t.subject)).toEqual(['AlphaTheirsOnly'])
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  2. Internal notes stay internal
  // ══════════════════════════════════════════════════════════════════════════

  describe('internal replies', () => {
    const plantConversation = async () => {
      const ticket = await makeTicket(A, A.residentId, 'AlphaConversation')
      await prisma.ticketReply.create({
        data: {
          ticketId: ticket.id, authorId: A.managerId, isInternal: false,
          body: 'PUBLIC: בדקנו ונחזור אליך',
        },
      })
      await prisma.ticketReply.create({
        data: {
          ticketId: ticket.id, authorId: A.managerId, isInternal: true,
          body: 'INTERNAL: הדייר בעייתי, להעביר למחלקה המשפטית',
        },
      })
      return ticket
    }

    it('the conversation shows the public reply and NOT the internal note', async () => {
      const ticket = await plantConversation()
      const res = await api().get(`${PORTAL}/${ticket.id}`).set(asMe()).expect(200)

      const body = JSON.stringify(res.body)
      expect(body).toContain('PUBLIC:')
      // The only thing between the project team's internal assessment of a
      // resident and that resident.
      expect(body).not.toContain('INTERNAL:')
      expect(res.body.replies).toHaveLength(1)
    })

    it('the reply COUNT in the list excludes internal notes', async () => {
      // A ticket with three internal notes and no answer must not look answered.
      const ticket = await makeTicket(A, A.residentId, 'AlphaSilentlyNoted')
      for (let i = 0; i < 3; i++) {
        await prisma.ticketReply.create({
          data: { ticketId: ticket.id, authorId: A.managerId, isInternal: true, body: `INTERNAL ${i}` },
        })
      }
      const res = await api().get(PORTAL).set(asMe()).expect(200)
      expect(res.body.tickets[0].replyCount).toBe(0)
    })

    it('a resident cannot mark their own reply internal', async () => {
      const ticket = await makeTicket(A, A.residentId, 'AlphaTryInternal')
      const res = await api().post(`${PORTAL}/${ticket.id}/replies`).set(asMe())
        .send({ body: 'hello', isInternal: true })
      // Refused rather than stripped: writing into the hidden channel is not a
      // field to quietly ignore.
      expect(res.status).toBe(400)
    })

    it('a reply the resident does write is not internal', async () => {
      const ticket = await makeTicket(A, A.residentId, 'AlphaMyReply')
      await api().post(`${PORTAL}/${ticket.id}/replies`).set(asMe())
        .send({ body: 'תודה' }).expect(201)

      const row = await prisma.ticketReply.findFirstOrThrow({
        where: { ticketId: ticket.id },
        select: { isInternal: true, authorResidentId: true, authorId: true },
      })
      expect(row.isInternal).toBe(false)
      expect(row.authorResidentId).toBe(A.residentId)
      expect(row.authorId).toBeNull()
    })

    it('staff names are shown, staff ids and emails are not', async () => {
      const ticket = await plantConversation()
      const res = await api().get(`${PORTAL}/${ticket.id}`).set(asMe()).expect(200)
      expect(res.body.replies[0].authorName).toBe('AlphaManager Cohen')
      expect(JSON.stringify(res.body)).not.toContain(A.managerId)
      expect(JSON.stringify(res.body)).not.toContain('@example.com')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  3. Opening and answering
  // ══════════════════════════════════════════════════════════════════════════

  describe('opening a ticket', () => {
    it('creates it against the right resident and tenant, and tells the manager', async () => {
      const res = await api().post(PORTAL).set(asMe())
        .send({ subject: 'שאלה על לוח הזמנים', description: 'מתי מתחיל הפינוי בבניין שלי?', category: 'CONSTRUCTION' })
      expect(res.status).toBe(201)

      const row = await prisma.supportTicket.findUniqueOrThrow({
        where: { id: res.body.id },
        select: { residentId: true, tenantId: true, category: true, status: true },
      })
      expect(row.residentId).toBe(A.residentId)
      expect(row.tenantId).toBe(A.tenantId)
      expect(row.category).toBe('CONSTRUCTION')
      expect(row.status).toBe('OPEN')

      const notification = await prisma.notification.findFirst({
        where: { entityType: 'SupportTicket', entityId: res.body.id },
        select: { userId: true },
      })
      expect(notification?.userId).toBe(A.managerId)
    })

    it('audits it with the resident as actor and a null user', async () => {
      const res = await api().post(PORTAL).set(asMe())
        .send({ subject: 'בדיקה', description: 'תיאור מספיק ארוך' }).expect(201)

      const entry = await prisma.auditLog.findFirst({
        where: { entity: 'SupportTicket', entityId: res.body.id },
        select: { userId: true, metadata: true },
      })
      expect(entry!.userId).toBeNull()
      expect((entry!.metadata as Record<string, unknown>).residentId).toBe(A.residentId)
    })

    it('rejects a body naming another resident or tenant', async () => {
      const res = await api().post(PORTAL).set(asMe()).send({
        subject: 'בדיקה', description: 'תיאור מספיק ארוך',
        residentId: A.coResidentId, tenantId: B.tenantId, status: 'CLOSED',
      })
      expect(res.status).toBe(400)
    })

    it('rejects an unknown category and an over-short body', async () => {
      await api().post(PORTAL).set(asMe())
        .send({ subject: 'בדיקה', description: 'תיאור מספיק ארוך', category: 'WHATEVER' }).expect(400)
      await api().post(PORTAL).set(asMe()).send({ subject: 'ok', description: 'short' }).expect(400)
    })

    it('caps how many can be open at once', async () => {
      for (let i = 0; i < 5; i++) {
        await api().post(PORTAL).set(asMe())
          .send({ subject: `פנייה ${i}`, description: 'תיאור מספיק ארוך' }).expect(201)
      }
      const sixth = await api().post(PORTAL).set(asMe())
        .send({ subject: 'שישית', description: 'תיאור מספיק ארוך' })
      expect(sixth.status).toBe(400)
      expect(sixth.body.code).toBe('TOO_MANY_OPEN_TICKETS')
    })

    it('a resolved ticket does not count against the cap', async () => {
      for (let i = 0; i < 5; i++) {
        const t = await api().post(PORTAL).set(asMe())
          .send({ subject: `פנייה ${i}`, description: 'תיאור מספיק ארוך' }).expect(201)
        if (i === 0) {
          await prisma.supportTicket.update({
            where: { id: t.body.id }, data: { status: 'RESOLVED', resolvedAt: new Date() },
          })
        }
      }
      await api().post(PORTAL).set(asMe())
        .send({ subject: 'נוספת', description: 'תיאור מספיק ארוך' }).expect(201)
    })
  })

  describe('replying', () => {
    it('adds the reply and shows it in the conversation', async () => {
      const ticket = await makeTicket(A, A.residentId, 'AlphaReplyable')
      await api().post(`${PORTAL}/${ticket.id}/replies`).set(asMe())
        .send({ body: 'עוד פרט אחד' }).expect(201)

      const res = await api().get(`${PORTAL}/${ticket.id}`).set(asMe()).expect(200)
      expect(res.body.replies).toHaveLength(1)
      expect(res.body.replies[0].fromResident).toBe(true)
    })

    it('reopens a RESOLVED ticket — "that did not fix it" is the point', async () => {
      const ticket = await makeTicket(A, A.residentId, 'AlphaResolved', {
        status: 'RESOLVED', resolvedAt: new Date(),
      })
      const res = await api().post(`${PORTAL}/${ticket.id}/replies`).set(asMe())
        .send({ body: 'זה עדיין לא נפתר' })
      expect(res.status).toBe(201)
      expect(res.body.reopened).toBe(true)

      const row = await prisma.supportTicket.findUniqueOrThrow({
        where: { id: ticket.id }, select: { status: true, resolvedAt: true },
      })
      expect(row.status).toBe('OPEN')
      expect(row.resolvedAt).toBeNull()
    })

    it('REFUSES to reply to a CLOSED ticket', async () => {
      const ticket = await makeTicket(A, A.residentId, 'AlphaClosed', {
        status: 'CLOSED', closedAt: new Date(),
      })
      const res = await api().post(`${PORTAL}/${ticket.id}/replies`).set(asMe())
        .send({ body: 'עוד משהו' })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('TICKET_CLOSED')
      expect(await prisma.ticketReply.count({ where: { ticketId: ticket.id } })).toBe(0)
    })

    it('says on the ticket whether replying is still possible', async () => {
      const open = await makeTicket(A, A.residentId, 'AlphaStillOpen')
      const closed = await makeTicket(A, A.residentId, 'AlphaDone', {
        status: 'CLOSED', closedAt: new Date(),
      })
      expect((await api().get(`${PORTAL}/${open.id}`).set(asMe())).body.canReply).toBe(true)
      expect((await api().get(`${PORTAL}/${closed.id}`).set(asMe())).body.canReply).toBe(false)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  4. The FAQ, from this project's own record
  // ══════════════════════════════════════════════════════════════════════════

  describe('the FAQ', () => {
    it("answers from THIS project's numbers, not from hard-coded ones", async () => {
      const res = await api().get(PORTAL).set(asMe()).expect(200)
      const text = JSON.stringify(res.body.faq)

      expect(text).toContain('8 מתוך 20')       // signedUnits / totalUnits
      expect(text).toContain('67%')              // the project's own goal
      // The hard-coded page claimed 80%, contradicting the system's own data.
      expect(text).not.toContain('80%')
    })

    it('derives the percentage from the counts, not from the dead column', async () => {
      /*
       * `Project.signatureActual` is written by nothing — not the seed, not any
       * service — so it sits at its default of 0. Reading it produced
       * "34 of 48 units (0%)" on a real project: wrong, and visibly nonsense to
       * the resident reading it. This fixture reproduces the disagreement.
       */
      await prisma.project.update({
        where: { id: A.projectId },
        data: { signedUnits: 8, totalUnits: 20, signatureActual: 0 },
      })
      const res = await api().get(PORTAL).set(asMe()).expect(200)
      const text = JSON.stringify(res.body.faq)
      expect(text).toContain('8 מתוך 20')
      expect(text).toContain('40%')
      expect(text).not.toContain('(0%)')
    })

    it('drops the contractual claims entirely', async () => {
      const res = await api().get(PORTAL).set(asMe()).expect(200)
      const text = JSON.stringify(res.body.faq)
      // These varied per project and per agreement, and nothing in the database
      // can answer them — so they are gone rather than guessed at.
      expect(text).not.toContain('25%')
      expect(text).not.toContain('דיור חלופי')
      expect(text).not.toContain('היזם נושא')
    })

    it('OMITS a question whose data is missing rather than guessing', async () => {
      await prisma.project.update({
        where: { id: A.projectId }, data: { targetEndDate: null },
      })
      const res = await api().get(PORTAL).set(asMe()).expect(200)
      expect(JSON.stringify(res.body.faq)).not.toContain('מסירת הדירות')

      await prisma.project.update({
        where: { id: A.projectId }, data: { targetEndDate: new Date('2028-06-30T00:00:00Z') },
      })
    })

    it("shows tenant B's numbers to tenant B", async () => {
      await prisma.project.update({
        where: { id: B.projectId }, data: { signedUnits: 19, totalUnits: 19, signatureGoal: 80 },
      })
      const tokenB = residentToken(B.residentId, B.tenantId, B.projectId)
      const res = await api().get(PORTAL).set({ Authorization: `Bearer ${tokenB}` }).expect(200)
      expect(JSON.stringify(res.body.faq)).toContain('19 מתוך 19')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  5. Tenant isolation and access
  // ══════════════════════════════════════════════════════════════════════════

  describe('isolation and access', () => {
    it("does not show a ticket from another tenant, even with this resident's id on it", async () => {
      await prisma.supportTicket.create({
        data: {
          tenantId: B.tenantId, residentId: A.residentId,
          subject: `${B_SECRET}CrossTenantTicket`, description: 'x', status: 'OPEN',
        },
      })
      const res = await api().get(PORTAL).set(asMe()).expect(200)
      expect(JSON.stringify(res.body)).not.toContain(B_SECRET)
      expect(res.body.tickets).toHaveLength(0)
    })

    it("404s on another tenant's ticket by id", async () => {
      const foreign = await makeTicket(B, B.residentId, `${B_SECRET}Foreign`)
      const res = await api().get(`${PORTAL}/${foreign.id}`).set(asMe())
      expect(res.status).toBe(404)
    })

    it('rejects an anonymous caller and a staff token', async () => {
      await api().get(PORTAL).expect(401)
      const staff = await api().get(PORTAL).set({ Authorization: `Bearer ${staffA}` })
      expect(staff.status).toBe(403)
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
})
