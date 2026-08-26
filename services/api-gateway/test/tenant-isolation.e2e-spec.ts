/**
 * Tenant isolation E2E tests.
 *
 * A previous version of this suite probed hard-coded placeholder UUIDs that
 * existed in no tenant at all. A 404 for a row that does not exist proves
 * nothing about isolation. This version seeds a REAL second tenant with its own
 * project → complex → building → apartment → resident/owner/task/document/
 * signature-package/data-quality graph, then asserts tenant A cannot reach any
 * of it.
 *
 * Expected contract:
 *   - Cross-tenant single-record GET  → 404 (never 200, never 403-as-oracle)
 *   - Cross-tenant mutation           → 404
 *   - List endpoints                  → never include the other tenant's rows
 *
 * All seeded data is removed in afterAll (tenant delete cascades).
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
const B_SLUG = 'e2e-isolation-tenant-b'

describe('Tenant isolation (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let tokenA: string
  let tenantAId: string

  // Tenant B fixture ids
  let tenantBId: string
  let bProjectId: string
  let bComplexId: string
  let bBuildingId: string
  let bApartmentId: string
  let bResidentId: string
  let bOwnerId: string
  let bTaskId: string
  let bDocumentId: string
  let bIssueId: string

  /**
   * Remove a seeded tenant and everything hanging off it.
   *
   * Several models (Owner, Resident, Task, DataQualityIssue) carry a tenantId
   * column but are NOT declared as cascade relations on Tenant, so deleting the
   * tenant alone hits a foreign-key violation. Delete children explicitly, in
   * dependency order, before the tenant itself.
   */
  const purgeTenant = async (slug: string) => {
    const t = await prisma.tenant.findUnique({ where: { slug } })
    if (!t) return
    const id = t.id

    const projects = await prisma.project.findMany({
      where: { tenantId: id },
      select: { id: true },
    })
    const projectIds = projects.map((p) => p.id)

    const complexes = await prisma.complex.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true },
    })
    const complexIds = complexes.map((c) => c.id)

    const buildings = await prisma.building.findMany({
      where: { complexId: { in: complexIds } },
      select: { id: true },
    })
    const buildingIds = buildings.map((b) => b.id)

    await prisma.dataQualityIssue.deleteMany({ where: { tenantId: id } })
    await prisma.task.deleteMany({ where: { tenantId: id } })
    await prisma.resident.deleteMany({ where: { tenantId: id } })
    await prisma.owner.deleteMany({ where: { tenantId: id } })
    await prisma.document.deleteMany({ where: { tenantId: id } })
    await prisma.apartment.deleteMany({ where: { buildingId: { in: buildingIds } } })
    await prisma.building.deleteMany({ where: { complexId: { in: complexIds } } })
    await prisma.complex.deleteMany({ where: { projectId: { in: projectIds } } })
    await prisma.project.deleteMany({ where: { tenantId: id } })
    await prisma.tenant.delete({ where: { id } })
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })

    // ── Tenant A: the real seeded tenant, via a real login ──────────
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })

    // Fail loudly rather than silently skipping.
    expect(login.status).toBe(200)
    tokenA = login.body.accessToken
    tenantAId = (jwt.decode(tokenA) as any).tenantId

    // ── Tenant B: seeded fresh for this suite ───────────────────────
    await purgeTenant(B_SLUG)

    const tenantB = await prisma.tenant.create({
      data: { name: 'E2E Isolation Tenant B', slug: B_SLUG },
    })
    tenantBId = tenantB.id
    expect(tenantBId).not.toBe(tenantAId)

    const bUser = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: 'admin@tenant-b.e2e.local',
        firstName: 'Tenant',
        lastName: 'B',
        role: 'COMPANY_ADMIN',
      },
    })

    const bProject = await prisma.project.create({
      data: {
        tenantId: tenantBId,
        code: 'TB-001',
        name: 'Tenant B Project',
        city: 'חיפה',
      },
    })
    bProjectId = bProject.id

    const bComplex = await prisma.complex.create({
      data: { projectId: bProjectId, name: 'Tenant B Complex' },
    })
    bComplexId = bComplex.id

    const bBuilding = await prisma.building.create({
      data: { complexId: bComplexId, address: 'רחוב ב 1', city: 'חיפה' },
    })
    bBuildingId = bBuilding.id

    const bApartment = await prisma.apartment.create({
      data: { buildingId: bBuildingId, apartmentNumber: '1' },
    })
    bApartmentId = bApartment.id

    const bResident = await prisma.resident.create({
      data: {
        tenantId: tenantBId,
        apartmentId: bApartmentId,
        firstName: 'דייר',
        lastName: 'בי',
      },
    })
    bResidentId = bResident.id

    const bOwner = await prisma.owner.create({
      data: { tenantId: tenantBId, fullName: 'בעלים בי' },
    })
    bOwnerId = bOwner.id

    const bTask = await prisma.task.create({
      data: {
        tenantId: tenantBId,
        title: 'Tenant B task',
        projectId: bProjectId,
      },
    })
    bTaskId = bTask.id

    const bDocument = await prisma.document.create({
      data: {
        tenantId: tenantBId,
        projectId: bProjectId,
        category: 'OTHER' as any,
        title: 'Tenant B document',
        fileName: 'tenant-b.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        s3Key: 'e2e/tenant-b/tenant-b.pdf',
        s3Bucket: 'urban-renewal',
        createdById: bUser.id,
      },
    })
    bDocumentId = bDocument.id

    const bIssue = await prisma.dataQualityIssue.create({
      data: {
        tenantId: tenantBId,
        projectId: bProjectId,
        entityType: 'RESIDENT' as any,
        entityId: bResidentId,
        entityLabel: 'דייר בי',
        issueType: 'MISSING_PHONE',
        category: 'COMPLETENESS' as any,
        severity: 'HIGH' as any,
        title: 'Tenant B issue',
        description: 'Seeded for isolation test',
      },
    })
    bIssueId = bIssue.id
  })

  afterAll(async () => {
    // Cascade removes every row seeded above that hangs off the tenant.
    if (tenantBId) await purgeTenant(B_SLUG)
    await app?.close()
  })

  const asA = () => ({ Authorization: `Bearer ${tokenA}` })

  /* ── Single-record cross-tenant reads ────────────────────────── */

  describe('tenant A cannot read tenant B records', () => {
    it('GET /projects/:bId → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${bProjectId}`)
        .set(asA())
      expect(res.status).toBe(404)
    })

    it('GET /residents/:bId → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/residents/${bResidentId}`)
        .set(asA())
      expect(res.status).toBe(404)
    })

    it('GET /buildings/:bId → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/buildings/${bBuildingId}`)
        .set(asA())
      expect(res.status).toBe(404)
    })

    it('GET /buildings/apartments/:bId → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/buildings/apartments/${bApartmentId}`)
        .set(asA())
      expect(res.status).toBe(404)
    })

    it('GET /tasks/:bId → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${bTaskId}`)
        .set(asA())
      expect(res.status).toBe(404)
    })

    it('GET /documents/:bId → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/documents/${bDocumentId}`)
        .set(asA())
      expect(res.status).toBe(404)
    })

    it('GET /data-quality/issues/:bId → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/data-quality/issues/${bIssueId}`)
        .set(asA())
      expect(res.status).toBe(404)
    })

    it('GET /projects/:bId/signature-report → 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${bProjectId}/signature-report`)
        .set(asA())
      expect(res.status).toBe(404)
    })
  })

  /* ── Cross-tenant mutations ──────────────────────────────────── */

  describe('tenant A cannot mutate tenant B records', () => {
    it('PUT /projects/:bId → 404', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/projects/${bProjectId}`)
        .set(asA())
        .send({ name: 'hijacked' })
      expect(res.status).toBe(404)

      // And the row is untouched.
      const still = await prisma.project.findUnique({ where: { id: bProjectId } })
      expect(still?.name).toBe('Tenant B Project')
    })

    it('DELETE /buildings/:bId → 404 and the building survives', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/buildings/${bBuildingId}`)
        .set(asA())
      expect(res.status).toBe(404)

      const still = await prisma.building.findUnique({ where: { id: bBuildingId } })
      expect(still).not.toBeNull()
    })

    it('PATCH /residents/:bId/signature-status → 404', async () => {
      // The body must be VALID for this to test what it claims to test: the
      // endpoint now takes an `UpdateSignatureStatusDto` (`status`), and the
      // global ValidationPipe rejects an unknown `signatureStatus` key with 400
      // before the tenant check ever runs. Sending the correct field proves the
      // request really does reach the tenant boundary and is refused there.
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/residents/${bResidentId}/signature-status`)
        .set(asA())
        .send({ status: 'SIGNED' })
      expect(res.status).toBe(404)

      const still = await prisma.resident.findUnique({ where: { id: bResidentId } })
      expect(still?.signatureStatus).toBe('NOT_CONTACTED')
    })
  })

  /* ── List endpoints must never bleed ─────────────────────────── */

  describe('list endpoints exclude the other tenant', () => {
    const rows = (body: any): any[] =>
      Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : []

    it('GET /projects excludes tenant B', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/projects?limit=200').set(asA())
      expect(res.status).toBe(200)
      const ids = rows(res.body).map((p: any) => p.id)
      expect(ids).not.toContain(bProjectId)
      expect(ids.length).toBeGreaterThan(0)
    })

    it('GET /residents excludes tenant B', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/residents?limit=200').set(asA())
      expect(res.status).toBe(200)
      expect(rows(res.body).map((r: any) => r.id)).not.toContain(bResidentId)
    })

    it('GET /tasks excludes tenant B', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/tasks?limit=200').set(asA())
      expect(res.status).toBe(200)
      expect(rows(res.body).map((t: any) => t.id)).not.toContain(bTaskId)
    })

    it('GET /documents excludes tenant B', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/documents?limit=200').set(asA())
      expect(res.status).toBe(200)
      expect(rows(res.body).map((d: any) => d.id)).not.toContain(bDocumentId)
    })

    it('GET /buildings excludes tenant B', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/buildings?limit=200').set(asA())
      expect(res.status).toBe(200)
      expect(rows(res.body).map((b: any) => b.id)).not.toContain(bBuildingId)
    })

    it('GET /data-quality/issues excludes tenant B', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/data-quality/issues?limit=200')
        .set(asA())
      expect(res.status).toBe(200)
      expect(rows(res.body).map((i: any) => i.id)).not.toContain(bIssueId)
    })

    it('GET /gis/overview emits no tenant B geography', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/gis/overview').set(asA())
      expect(res.status).toBe(200)
      const serialized = JSON.stringify(res.body)
      expect(serialized).not.toContain(bProjectId)
      expect(serialized).not.toContain(bBuildingId)
    })

    it('GET /dashboard/stats leaks no tenant B identifiers', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/dashboard/stats').set(asA())
      expect(res.status).toBe(200)
      const serialized = JSON.stringify(res.body)
      for (const id of [bProjectId, bResidentId, bTaskId, bDocumentId]) {
        expect(serialized).not.toContain(id)
      }
    })
  })

  /* ── Filter-parameter injection ──────────────────────────────── */

  describe('tenant B ids supplied as filters do not widen scope', () => {
    it('GET /residents?projectId=<tenantB> returns nothing from tenant B', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/residents?projectId=${bProjectId}`)
        .set(asA())
      expect(res.status).toBe(200)
      const data = Array.isArray(res.body) ? res.body : res.body?.data ?? []
      expect(data.map((r: any) => r.id)).not.toContain(bResidentId)
    })

    it('GET /tasks?projectId=<tenantB> returns nothing from tenant B', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks?projectId=${bProjectId}`)
        .set(asA())
      expect(res.status).toBe(200)
      const data = Array.isArray(res.body) ? res.body : res.body?.data ?? []
      expect(data.map((t: any) => t.id)).not.toContain(bTaskId)
    })

    it('GET /buildings?projectId=<tenantB> returns nothing from tenant B', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/buildings?projectId=${bProjectId}`)
        .set(asA())
      expect(res.status).toBe(200)
      const data = Array.isArray(res.body) ? res.body : res.body?.data ?? []
      expect(data.map((b: any) => b.id)).not.toContain(bBuildingId)
    })
  })

  /* ── A tenant-B token must not reach tenant A ────────────────── */

  describe('reverse direction', () => {
    it('a tenant B token cannot read tenant A projects', async () => {
      const tokenB = jwt.sign(
        {
          sub: 'tenant-b-user',
          email: 'admin@tenant-b.e2e.local',
          role: 'COMPANY_ADMIN',
          tenantId: tenantBId,
          sessionId: randomUUID(),
        },
        { secret: process.env.JWT_SECRET as string, expiresIn: '5m' },
      )

      const res = await request(app.getHttpServer())
        .get('/api/v1/projects?limit=200')
        .set({ Authorization: `Bearer ${tokenB}` })

      expect(res.status).toBe(200)
      const data = Array.isArray(res.body) ? res.body : res.body?.data ?? []
      // Tenant B owns exactly one project — its own.
      expect(data.map((p: any) => p.id)).toEqual([bProjectId])
    })
  })
})
