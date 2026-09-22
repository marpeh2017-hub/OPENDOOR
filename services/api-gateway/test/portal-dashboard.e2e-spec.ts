/**
 * The resident dashboard — Portal stage 2.
 *
 * ── WHAT IS BEING PROVED ────────────────────────────────────────────────────
 *
 * The page this replaces held hard-coded arrays and rendered the same thing for
 * every visitor. Making it real means it now reads a database, which means the
 * only question that matters is whether it can be made to read the WRONG rows.
 *
 * So the centre of this suite is not "does the dashboard return data" — it is a
 * second tenant, fully populated with its own documents, messages, meetings and
 * staff, whose data must not appear in tenant A's response under any of the
 * following: a forged tenant claim, a forged project claim, a query parameter,
 * a cross-tenant row deliberately attached to tenant A's resident, or a
 * resident who has been moved since their session began.
 *
 * Tokens are minted directly with `JwtService`. That is deliberately the
 * STRONGEST attacker model available here: it assumes a caller who can produce
 * a correctly signed token with claims of their choosing, and asserts that the
 * scope is still re-derived from the database rather than believed.
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
const MARKER = `DASH-${STAMP}`
const SLUG_A = `dash-${STAMP}-a`
const SLUG_B = `dash-${STAMP}-b`

/** Every string tenant B owns contains this. One assertion can then sweep a whole response. */
const B_SECRET = `BTENANT${STAMP}`

const BASE = '/api/v1/portal/dashboard'

interface Fixture {
  tenantId: string
  projectId: string
  buildingId: string
  apartmentId: string
  residentId: string
  managerId: string
}

describe('Resident portal dashboard (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let A: Fixture
  let B: Fixture
  let residentAToken: string
  let staffAToken: string
  let documentAId: string
  let signedDocumentAId: string

  const api = () => request(app.getHttpServer())
  const asResidentA = () => ({ Authorization: `Bearer ${residentAToken}` })

  /** A correctly signed resident token with exactly the claims asked for. */
  const residentToken = (claims: {
    residentId: string; tenantId: string; projectId?: string
  }) =>
    jwt.sign(
      {
        sub: claims.residentId,
        role: 'RESIDENT',
        tenantId: claims.tenantId,
        ...(claims.projectId ? { projectId: claims.projectId } : {}),
        residentId: claims.residentId,
        sessionId: randomUUID(),
      },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const staffToken = (userId: string, tenantId: string, role = 'PROJECT_MANAGER') =>
    jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  /** One tenant, complete: project, building, apartment, resident, manager. */
  const makeTenant = async (slug: string, label: string, mark: string): Promise<Fixture> => {
    const tenant = await prisma.tenant.create({ data: { name: slug, slug } })

    const manager = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `${mark}-pm-${randomUUID().slice(0, 6)}@example.com`.toLowerCase(),
        firstName: `${mark}Manager`, lastName: 'Cohen',
        phone: '0501112233',
        passwordHash: 'not-a-usable-credential', role: 'PROJECT_MANAGER' as never,
      },
      select: { id: true },
    })

    const project = await prisma.project.create({
      data: {
        tenantId: tenant.id, code: `${MARKER}-${label}`, name: `${mark} Project`,
        city: 'תל אביב', stage: 'PLANNING', status: 'ACTIVE',
        projectManagerId: manager.id,
      },
    })
    const complex = await prisma.complex.create({
      data: { projectId: project.id, name: `${mark} complex` },
    })
    const building = await prisma.building.create({
      data: { complexId: complex.id, address: `${mark} street 1` },
    })
    const apartment = await prisma.apartment.create({
      data: { buildingId: building.id, apartmentNumber: '4' },
    })
    const resident = await prisma.resident.create({
      data: {
        tenantId: tenant.id, apartmentId: apartment.id,
        firstName: `${mark}First`, lastName: 'Levi',
        phone: '0509900101', isActive: true,
      },
    })

    return {
      tenantId: tenant.id, projectId: project.id, buildingId: building.id,
      apartmentId: apartment.id, residentId: resident.id, managerId: manager.id,
    }
  }

  const makeDocument = async (f: Fixture, title: string) => {
    const doc = await prisma.document.create({
      data: {
        tenantId: f.tenantId, projectId: f.projectId,
        category: 'CONTRACT', title,
        fileName: `${title}.pdf`, fileSize: 1024, mimeType: 'application/pdf',
        s3Key: `${MARKER}/${title}`, s3Bucket: 'test-bucket',
        createdById: f.managerId, isLatest: true,
      },
      select: { id: true },
    })
    await prisma.residentDocument.create({
      data: { residentId: f.residentId, documentId: doc.id },
    })
    return doc.id
  }

  const purge = async () => {
    const stale = await prisma.tenant.findMany({
      where: { slug: { startsWith: 'dash-' } }, select: { id: true },
    })
    for (const t of stale) {
      await prisma.signatureRequest.deleteMany({ where: { tenantId: t.id } })
      await prisma.message.deleteMany({ where: { tenantId: t.id } })
      await prisma.meeting.deleteMany({ where: { tenantId: t.id } })
      await prisma.residentDocument.deleteMany({ where: { document: { tenantId: t.id } } })
      await prisma.document.deleteMany({ where: { tenantId: t.id } })
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } }).catch(() => undefined)
    }
  }

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      // A harness artefact only: this suite fires far more than 20 requests a
      // second and softens no assertion in the file.
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

    // ── Tenant A's own content ──────────────────────────────────────────────
    documentAId = await makeDocument(A, 'AlphaPlanningDrawing')
    signedDocumentAId = await makeDocument(A, 'AlphaPowerOfAttorney')

    await prisma.signatureRequest.create({
      data: {
        tenantId: A.tenantId, residentId: A.residentId, documentId: signedDocumentAId,
        status: 'SIGNED', signedAt: new Date('2026-03-15T10:00:00Z'), sentAt: new Date('2026-03-01T10:00:00Z'),
      },
    })

    await prisma.message.createMany({
      data: [
        {
          tenantId: A.tenantId, residentId: A.residentId, channel: 'SMS', direction: 'OUTBOUND',
          status: 'DELIVERED', body: 'AlphaDelivered: אסיפת דיירים ביום ראשון',
        },
        {
          tenantId: A.tenantId, residentId: A.residentId, channel: 'SMS', direction: 'OUTBOUND',
          status: 'QUEUED', body: 'AlphaQueued: never reached them',
        },
        {
          tenantId: A.tenantId, residentId: A.residentId, channel: 'SMS', direction: 'OUTBOUND',
          status: 'FAILED', body: 'AlphaFailed: never reached them either',
        },
      ],
    })

    const futureMeeting = await prisma.meeting.create({
      data: {
        tenantId: A.tenantId, projectId: A.projectId, title: 'AlphaUpcomingMeeting',
        startTime: new Date(Date.now() + 86_400_000), location: 'לובי',
      },
    })
    await prisma.meetingAttendee.create({
      data: { meetingId: futureMeeting.id, residentId: A.residentId, rsvpStatus: 'pending' },
    })

    const pastMeeting = await prisma.meeting.create({
      data: {
        tenantId: A.tenantId, projectId: A.projectId, title: 'AlphaPastMeeting',
        startTime: new Date(Date.now() - 86_400_000),
      },
    })
    await prisma.meetingAttendee.create({
      data: { meetingId: pastMeeting.id, residentId: A.residentId, rsvpStatus: 'accepted' },
    })

    const cancelled = await prisma.meeting.create({
      data: {
        tenantId: A.tenantId, projectId: A.projectId, title: 'AlphaCancelledMeeting',
        startTime: new Date(Date.now() + 172_800_000), status: 'cancelled',
      },
    })
    await prisma.meetingAttendee.create({
      data: { meetingId: cancelled.id, residentId: A.residentId, rsvpStatus: 'pending' },
    })

    // ── Tenant B's own content, which must never surface ────────────────────
    await makeDocument(B, `${B_SECRET}Contract`)
    await prisma.message.create({
      data: {
        tenantId: B.tenantId, residentId: B.residentId, channel: 'SMS', direction: 'OUTBOUND',
        status: 'DELIVERED', body: `${B_SECRET} confidential message`,
      },
    })

    residentAToken = residentToken({
      residentId: A.residentId, tenantId: A.tenantId, projectId: A.projectId,
    })
    staffAToken = staffToken(A.managerId, A.tenantId)
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  1. It returns this resident's real data
  // ══════════════════════════════════════════════════════════════════════════

  describe('the dashboard is real', () => {
    it('greets the signed-in resident and names their own home', async () => {
      const res = await api().get(BASE).set(asResidentA()).expect(200)
      expect(res.body.resident.firstName).toBe('AlphaFirst')
      expect(res.body.resident.apartmentNumber).toBe('4')
      expect(res.body.resident.buildingAddress).toBe('Alpha street 1')
    })

    it('reports the project stage from the database, on the real twelve-stage scale', async () => {
      const res = await api().get(BASE).set(asResidentA()).expect(200)
      expect(res.body.project.stage).toBe('PLANNING')
      expect(res.body.project.stageLabel).toBe('תכנון')
      // The mock invented seven stages that do not exist in `ProjectStage`.
      expect(res.body.project.stages).toHaveLength(12)
      expect(res.body.project.progressPercent).toBe(50)   // 6th of 12

      const stages: { key: string; done: boolean; current: boolean }[] = res.body.project.stages
      expect(stages.find((s) => s.key === 'PLANNING')!.current).toBe(true)
      expect(stages.find((s) => s.key === 'SIGNATURES')!.done).toBe(true)
      expect(stages.find((s) => s.key === 'CONSTRUCTION')!.done).toBe(false)
      expect(stages.filter((s) => s.current)).toHaveLength(1)
    })

    it('reflects the signature actually recorded, with its real date', async () => {
      const res = await api().get(BASE).set(asResidentA()).expect(200)
      expect(res.body.signature.signed).toBe(true)
      expect(new Date(res.body.signature.signedAt).toISOString()).toBe('2026-03-15T10:00:00.000Z')
      expect(res.body.signature.pending).toBeNull()
    })

    it("lists this resident's own documents, and marks which are signed", async () => {
      const res = await api().get(BASE).set(asResidentA()).expect(200)
      const byId = Object.fromEntries(res.body.documents.map((d: { id: string }) => [d.id, d]))
      expect(byId[documentAId].signed).toBe(false)
      expect(byId[signedDocumentAId].signed).toBe(true)
    })

    it('shows only messages that actually reached the resident', async () => {
      const res = await api().get(BASE).set(asResidentA()).expect(200)
      const bodies = JSON.stringify(res.body.messages)
      expect(bodies).toContain('AlphaDelivered')
      // Telling a resident they were informed of something the system never
      // managed to send is worse than showing nothing.
      expect(bodies).not.toContain('AlphaQueued')
      expect(bodies).not.toContain('AlphaFailed')
    })

    it('shows upcoming meetings only, and not cancelled ones', async () => {
      const res = await api().get(BASE).set(asResidentA()).expect(200)
      const titles = res.body.meetings.map((m: { title: string }) => m.title)
      expect(titles).toContain('AlphaUpcomingMeeting')
      expect(titles).not.toContain('AlphaPastMeeting')
      expect(titles).not.toContain('AlphaCancelledMeeting')
    })

    it('names the project manager without publishing their phone number', async () => {
      const res = await api().get(BASE).set(asResidentA()).expect(200)
      expect(res.body.contact.projectManager.name).toBe('AlphaManager Cohen')
      // The column holds one. Disclosing it to every resident is a product
      // decision, not a side effect of the field being available.
      expect(JSON.stringify(res.body)).not.toContain('0501112233')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  2. Tenant isolation
  // ══════════════════════════════════════════════════════════════════════════

  describe('tenant isolation', () => {
    it('no part of the response mentions the other tenant', async () => {
      const res = await api().get(BASE).set(asResidentA()).expect(200)
      // One sweep over the whole body. Every string tenant B owns — its name,
      // project, address, resident, manager, document and message — contains
      // this marker, so a leak anywhere in any section fails here.
      expect(JSON.stringify(res.body)).not.toContain(B_SECRET)
      expect(JSON.stringify(res.body)).not.toContain(B.tenantId)
      expect(JSON.stringify(res.body)).not.toContain(B.residentId)
    })

    it('a document from another tenant attached to this resident is NOT returned', async () => {
      // The attack is a bad row rather than a bad request: whatever put it
      // there, the read must not honour it.
      const foreign = await prisma.document.create({
        data: {
          tenantId: B.tenantId, projectId: B.projectId, category: 'CONTRACT',
          title: `${B_SECRET}CrossTenantDoc`,
          fileName: 'x.pdf', fileSize: 10, mimeType: 'application/pdf',
          s3Key: `${MARKER}/cross`, s3Bucket: 'test-bucket',
          createdById: B.managerId, isLatest: true,
        },
        select: { id: true },
      })
      await prisma.residentDocument.create({
        data: { residentId: A.residentId, documentId: foreign.id },
      })

      const res = await api().get(BASE).set(asResidentA()).expect(200)
      expect(JSON.stringify(res.body.documents)).not.toContain(B_SECRET)
      expect(res.body.documents.map((d: { id: string }) => d.id)).not.toContain(foreign.id)

      await prisma.residentDocument.deleteMany({ where: { documentId: foreign.id } })
      await prisma.document.delete({ where: { id: foreign.id } })
    })

    it('a message row carrying another tenant id is NOT returned', async () => {
      const foreign = await prisma.message.create({
        data: {
          tenantId: B.tenantId, residentId: A.residentId, channel: 'SMS',
          direction: 'OUTBOUND', status: 'DELIVERED', body: `${B_SECRET}CrossTenantMessage`,
        },
        select: { id: true },
      })

      const res = await api().get(BASE).set(asResidentA()).expect(200)
      expect(JSON.stringify(res.body.messages)).not.toContain(B_SECRET)

      await prisma.message.delete({ where: { id: foreign.id } })
    })

    it('a meeting in another tenant is NOT returned, even with a real invitation', async () => {
      const foreign = await prisma.meeting.create({
        data: {
          tenantId: B.tenantId, projectId: B.projectId, title: `${B_SECRET}CrossTenantMeeting`,
          startTime: new Date(Date.now() + 86_400_000),
        },
        select: { id: true },
      })
      await prisma.meetingAttendee.create({
        data: { meetingId: foreign.id, residentId: A.residentId, rsvpStatus: 'pending' },
      })

      const res = await api().get(BASE).set(asResidentA()).expect(200)
      expect(JSON.stringify(res.body.meetings)).not.toContain(B_SECRET)

      await prisma.meeting.delete({ where: { id: foreign.id } })
    })

    it('a project manager pointing into another tenant yields no contact, not a name', async () => {
      // `projectManagerId` is a bare string with no foreign key, so this is a
      // state the database itself permits.
      await prisma.project.update({
        where: { id: A.projectId }, data: { projectManagerId: B.managerId },
      })

      const res = await api().get(BASE).set(asResidentA()).expect(200)
      expect(res.body.contact.projectManager).toBeNull()
      expect(JSON.stringify(res.body)).not.toContain(B_SECRET)

      await prisma.project.update({
        where: { id: A.projectId }, data: { projectManagerId: A.managerId },
      })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  3. The session cannot be steered
  // ══════════════════════════════════════════════════════════════════════════

  describe('the scope comes from the session and nowhere else', () => {
    it('a correctly signed token claiming ANOTHER tenant is refused', async () => {
      // The attacker holds the signing key in this test. The claim is still not
      // believed: the scope is re-derived from the database and compared.
      const forged = residentToken({
        residentId: A.residentId, tenantId: B.tenantId, projectId: A.projectId,
      })
      const res = await api().get(BASE).set({ Authorization: `Bearer ${forged}` })
      expect(res.status).toBe(401)
      expect(res.body.code).toBe('PORTAL_SCOPE_CHANGED')
    })

    it('a correctly signed token claiming ANOTHER project is refused', async () => {
      const forged = residentToken({
        residentId: A.residentId, tenantId: A.tenantId, projectId: B.projectId,
      })
      const res = await api().get(BASE).set({ Authorization: `Bearer ${forged}` })
      expect(res.status).toBe(401)
      expect(res.body.code).toBe('PORTAL_SCOPE_CHANGED')
    })

    it('a token for tenant B returns tenant B, never tenant A', async () => {
      // The mirror image: the isolation is real in both directions, not an
      // artefact of tenant A happening to be first.
      const tokenB = residentToken({
        residentId: B.residentId, tenantId: B.tenantId, projectId: B.projectId,
      })
      const res = await api().get(BASE).set({ Authorization: `Bearer ${tokenB}` }).expect(200)
      expect(res.body.resident.firstName).toBe(`${B_SECRET}First`)
      expect(JSON.stringify(res.body)).not.toContain('Alpha')
    })

    it('query parameters cannot redirect the read', async () => {
      const mine = await api().get(BASE).set(asResidentA()).expect(200)
      const steered = await api()
        .get(`${BASE}?residentId=${B.residentId}&tenantId=${B.tenantId}&projectId=${B.projectId}`)
        .set(asResidentA())

      expect(steered.status).toBe(200)
      // Identical, because the endpoint never looked. This is the property that
      // makes "no parameters" a design decision rather than an omission.
      expect(steered.body.resident).toEqual(mine.body.resident)
      expect(JSON.stringify(steered.body)).not.toContain(B_SECRET)
    })

    it('a resident archived since sign-in is refused', async () => {
      await prisma.resident.update({ where: { id: A.residentId }, data: { isActive: false } })

      const res = await api().get(BASE).set(asResidentA())
      expect(res.status).toBe(401)
      expect(res.body.code).toBe('RESIDENT_NOT_FOUND')

      await prisma.resident.update({ where: { id: A.residentId }, data: { isActive: true } })
    })

    it('a resident moved to another project since sign-in is refused, not silently re-scoped', async () => {
      /*
       * The token is valid, correctly signed, and describes a world that has
       * changed. Adopting the new placement would move a live session into a
       * scope nobody decided it should have; the resident signs in again
       * instead and gets a session that says what is true now.
       */
      const elsewhere = await prisma.project.create({
        data: { tenantId: A.tenantId, code: `${MARKER}-moved`, name: 'Alpha Second', city: 'תל אביב' },
      })
      const complex = await prisma.complex.create({
        data: { projectId: elsewhere.id, name: 'Alpha second complex' },
      })
      const building = await prisma.building.create({
        data: { complexId: complex.id, address: 'Alpha second street 9' },
      })
      const apartment = await prisma.apartment.create({
        data: { buildingId: building.id, apartmentNumber: '12' },
      })
      const original = await prisma.resident.findUniqueOrThrow({
        where: { id: A.residentId }, select: { apartmentId: true },
      })
      await prisma.resident.update({
        where: { id: A.residentId }, data: { apartmentId: apartment.id },
      })

      const res = await api().get(BASE).set(asResidentA())
      expect(res.status).toBe(401)
      expect(res.body.code).toBe('PORTAL_SCOPE_CHANGED')

      await prisma.resident.update({
        where: { id: A.residentId }, data: { apartmentId: original.apartmentId },
      })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  4. Who may call it at all
  // ══════════════════════════════════════════════════════════════════════════

  describe('access', () => {
    it('rejects an anonymous caller with 401', async () => {
      await api().get(BASE).expect(401)
    })

    it('rejects a STAFF token with 403 — this is not a staff route', async () => {
      const res = await api().get(BASE).set({ Authorization: `Bearer ${staffAToken}` })
      expect(res.status).toBe(403)
    })

    it('rejects a resident token that carries no project scope', async () => {
      // Every resident token minted before stage 1 has this shape.
      const scopeless = residentToken({ residentId: A.residentId, tenantId: A.tenantId })
      const res = await api().get(BASE).set({ Authorization: `Bearer ${scopeless}` })
      expect(res.status).toBe(401)
    })

    it('rejects a revoked session', async () => {
      const login = residentToken({
        residentId: A.residentId, tenantId: A.tenantId, projectId: A.projectId,
      })
      await api().post('/api/v1/auth/logout').set({ Authorization: `Bearer ${login}` }).expect(204)

      const res = await api().get(BASE).set({ Authorization: `Bearer ${login}` })
      expect(res.status).toBe(401)
    })
  })
})
