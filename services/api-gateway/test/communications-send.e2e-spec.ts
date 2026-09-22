/**
 * Communications compose E2E tests — POST /api/v1/communications.
 *
 * IMPORTANT: this endpoint ENQUEUES an outbound Message with status QUEUED. A
 * dispatcher now consumes those rows (see messaging-dispatcher.e2e-spec.ts);
 * this suite covers the ENQUEUE contract only — that the endpoint itself never
 * writes a delivery status. These tests pin the recording contract and the
 * security fix (the endpoint used to
 * spread `...body` into `prisma.message.create`, letting a caller forge
 * `direction`, `status`, `sentAt`, `externalId`, `campaignId` and `metadata`).
 *
 * The app is configured exactly like `main.ts` so `forbidNonWhitelisted` is
 * live — a laxer pipe would make the mass-assignment assertions vacuous.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SEED_EMAIL = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'
const B_SLUG = 'e2e-comms-tenant-b'

describe('Communications compose (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let adminToken: string
  let tenantId: string
  let userId: string
  let residentId: string

  let tenantBId: string
  let bResidentId: string

  const createdMessageIds: string[] = []

  const tokenFor = (role: string) =>
    jwt.sign(
      // sessionId is mandatory; a fresh random one is never revoked, so this
      // isolates the RBAC check without weakening authentication.
      {
        sub: userId, email: SEED_EMAIL, role, tenantId, sessionId: randomUUID(),
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
      { secret: process.env.JWT_SECRET as string, expiresIn: '5m' },
    )

  const purgeTenantB = async () => {
    const t = await prisma.tenant.findUnique({ where: { slug: B_SLUG } })
    if (!t) return
    await prisma.message.deleteMany({ where: { tenantId: t.id } })
    await prisma.resident.deleteMany({ where: { tenantId: t.id } })
    await prisma.apartment.deleteMany({ where: { building: { complex: { project: { tenantId: t.id } } } } })
    await prisma.building.deleteMany({ where: { complex: { project: { tenantId: t.id } } } })
    await prisma.complex.deleteMany({ where: { project: { tenantId: t.id } } })
    await prisma.project.deleteMany({ where: { tenantId: t.id } })
    await prisma.tenant.delete({ where: { id: t.id } })
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })

    // Fail loudly rather than silently skipping the suite.
    expect(login.status).toBe(200)
    adminToken = login.body.accessToken
    expect(typeof adminToken).toBe('string')

    const decoded = jwt.decode(adminToken) as any
    tenantId = decoded.tenantId
    userId = decoded.sub

    const resident = await prisma.resident.findFirst({
      where: { tenantId }, select: { id: true },
    })
    expect(resident).toBeTruthy()
    residentId = resident!.id

    await purgeTenantB()
    const tenantB = await prisma.tenant.create({
      data: { name: 'E2E Comms Tenant B', slug: B_SLUG },
    })
    tenantBId = tenantB.id
    expect(tenantBId).not.toBe(tenantId)

    // Resident requires an apartment, which requires the building graph above it.
    const bProject = await prisma.project.create({
      data: { tenantId: tenantBId, code: 'CMB-001', name: 'Comms Tenant B', city: 'חיפה' },
    })
    const bComplex = await prisma.complex.create({
      data: { projectId: bProject.id, name: 'Comms Tenant B Complex' },
    })
    const bBuilding = await prisma.building.create({
      data: { complexId: bComplex.id, address: 'רחוב ב 2', city: 'חיפה' },
    })
    const bApartment = await prisma.apartment.create({
      data: { buildingId: bBuilding.id, apartmentNumber: '1' },
    })
    const bResident = await prisma.resident.create({
      data: {
        tenantId: tenantBId,
        apartmentId: bApartment.id,
        firstName: 'דייר',
        lastName: 'בי',
      },
    })
    bResidentId = bResident.id
  })

  afterAll(async () => {
    if (prisma && createdMessageIds.length) {
      await prisma.message.deleteMany({ where: { id: { in: createdMessageIds } } })
    }
    await purgeTenantB()
    await app?.close()
  })

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` })
  const post = (headers: Record<string, string>, body: any) =>
    request(app.getHttpServer()).post('/api/v1/communications').set(headers).send(body)

  /* ── Happy path ──────────────────────────────────────────────── */

  describe('successful send', () => {
    let body: any

    beforeAll(async () => {
      const res = await post(asAdmin(), {
        channel: 'WHATSAPP',
        residentId,
        toPhone: '+972500000000',
        body: 'הודעת בדיקה מ-communications-send.e2e-spec',
      })
      expect(res.status).toBe(201)
      body = res.body
      createdMessageIds.push(body.id)
    })

    it('records an OUTBOUND message with status QUEUED', () => {
      expect(body.direction).toBe('OUTBOUND')
      expect(body.status).toBe('QUEUED')
      expect(body.residentId).toBe(residentId)
    })

    /**
     * UPDATED FOR THE DISPATCHER (Phase 1/3). This used to assert
     * `channel === 'WHATSAPP'` — the channel the caller asked for, stored
     * verbatim. It no longer is, and that is the fix rather than a regression:
     * the seeded resident has `whatsappOptIn: false`, so
     * `ResidentContactService` routes to a channel they actually consented to.
     * A staff member cannot opt a resident into WhatsApp by picking it from a
     * dropdown.
     */
    it('routes to a channel the resident has consented to, not the one asked for', () => {
      expect(body.channel).toBe('SMS')
    })

    /**
     * UPDATED. The original assertion was "does NOT mark the message as sent —
     * there is no dispatcher". A dispatcher now exists; what still must hold is
     * that the ENDPOINT never marks anything sent. SENT is written only by the
     * dispatcher, and only after a provider call actually succeeded.
     */
    it('the endpoint never marks the message sent — only the dispatcher does', () => {
      expect(body.sentAt).toBeNull()
      expect(body.deliveredAt).toBeNull()
      expect(body.externalId).toBeNull()
      expect(body.providerName).toBeNull()
      expect(body.providerMessageId).toBeNull()
      expect(body.attemptCount).toBe(0)
      expect(body.isSimulated).toBe(false)
    })

    it('is persisted in the caller’s tenant', async () => {
      const row = await prisma.message.findUnique({ where: { id: body.id } })
      expect(row?.tenantId).toBe(tenantId)
    })

    it('appears immediately in GET /communications', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/communications?residentId=${residentId}`)
        .set(asAdmin())
      expect(res.status).toBe(200)
      expect(res.body.some((m: any) => m.id === body.id)).toBe(true)
    })

    it('accepts an EMAIL with a subject', async () => {
      const res = await post(asAdmin(), {
        channel: 'EMAIL',
        residentId,
        toEmail: 'e2e@example.test',
        subject: 'נושא בדיקה',
        body: 'גוף ההודעה',
      })
      expect(res.status).toBe(201)
      createdMessageIds.push(res.body.id)
      expect(res.body.subject).toBe('נושא בדיקה')
    })
  })

  /* ── Validation / failure handling ───────────────────────────── */

  describe('send failures', () => {
    it('rejects an empty body → 400', async () => {
      const res = await post(asAdmin(), { channel: 'SMS', residentId, body: '' })
      expect(res.status).toBe(400)
    })

    it('rejects a non-sendable channel → 400', async () => {
      const res = await post(asAdmin(), { channel: 'PUSH', residentId, body: 'x' })
      expect(res.status).toBe(400)
    })

    it('rejects an unknown channel → 400', async () => {
      const res = await post(asAdmin(), { channel: 'CARRIER_PIGEON', residentId, body: 'x' })
      expect(res.status).toBe(400)
    })

    it('rejects a request with no recipient at all → 400', async () => {
      const res = await post(asAdmin(), { channel: 'SMS', body: 'x' })
      expect(res.status).toBe(400)
    })

    it('rejects a malformed toEmail → 400', async () => {
      const res = await post(asAdmin(), { channel: 'EMAIL', toEmail: 'not-an-email', body: 'x' })
      expect(res.status).toBe(400)
    })

    it('rejects a client-forged status / direction / sentAt → 400', async () => {
      const res = await post(asAdmin(), {
        channel: 'SMS', residentId, body: 'x',
        status: 'DELIVERED', direction: 'INBOUND', sentAt: new Date().toISOString(),
      })
      expect(res.status).toBe(400)
    })

    it('rejects a client-supplied externalId / campaignId / metadata → 400', async () => {
      const res = await post(asAdmin(), {
        channel: 'SMS', residentId, body: 'x',
        externalId: 'forged', campaignId: 'forged', metadata: { a: 1 },
      })
      expect(res.status).toBe(400)
    })

    it('rejects a tenantId override → 400', async () => {
      const res = await post(asAdmin(), {
        channel: 'SMS', residentId, body: 'x', tenantId: tenantBId,
      })
      expect(res.status).toBe(400)
    })

    it('no forged rows were persisted', async () => {
      const forged = await prisma.message.count({
        where: { tenantId, OR: [{ direction: 'INBOUND', body: 'x' }, { externalId: 'forged' }] },
      })
      expect(forged).toBe(0)
    })
  })

  /* ── RBAC ────────────────────────────────────────────────────── */

  describe('RBAC', () => {
    it('no token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/communications')
        .send({ channel: 'SMS', residentId, body: 'x' })
      expect(res.status).toBe(401)
    })

    it('valid token, RESIDENT role → 403 (not 401, not 201)', async () => {
      const res = await post({ Authorization: `Bearer ${tokenFor('RESIDENT')}` },
        { channel: 'SMS', residentId, body: 'x' })
      expect(res.status).toBe(403)
    })

    it('valid token, LAWYER (staff, but not a sender) → 403', async () => {
      const res = await post({ Authorization: `Bearer ${tokenFor('LAWYER')}` },
        { channel: 'SMS', residentId, body: 'x' })
      expect(res.status).toBe(403)
    })

    it('LAWYER can still READ the log', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/communications')
        .set({ Authorization: `Bearer ${tokenFor('LAWYER')}` })
      expect(res.status).toBe(200)
    })
  })

  /* ── Tenant isolation ────────────────────────────────────────── */

  describe('tenant isolation', () => {
    it('messaging another tenant’s resident → 404', async () => {
      const res = await post(asAdmin(), {
        channel: 'SMS', residentId: bResidentId, body: 'cross tenant',
      })
      expect(res.status).toBe(404)
    })

    it('no message row was created for the other tenant', async () => {
      const count = await prisma.message.count({ where: { tenantId: tenantBId } })
      expect(count).toBe(0)
    })

    it('no message referencing the other tenant’s resident exists', async () => {
      const count = await prisma.message.count({ where: { residentId: bResidentId } })
      expect(count).toBe(0)
    })
  })
})
