/**
 * RBAC end-to-end tests.
 *
 * These tests mint STRUCTURALLY VALID tokens signed with the real JWT secret,
 * carrying each role we want to exercise. That is the only way to distinguish
 * authentication (401) from authorization (403): an invalid/garbage token can
 * only ever produce 401, so asserting `[401, 403]` proves nothing about roles.
 *
 * Contract pinned here:
 *   - No token                        → 401
 *   - Valid token, insufficient role   → 403 (never 401, never 200)
 *   - Valid token, sufficient role     → not 403
 *
 * Token minting reuses the app's own JwtService (same approach as
 * gis.e2e-spec.ts) so no extra signing dependency is introduced.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { AppModule } from '../src/app.module'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SEED_EMAIL = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'

describe('RBAC (e2e)', () => {
  let app: INestApplication
  let jwt: JwtService
  let tenantId: string
  let userId: string
  let adminToken: string

  /** Mint a valid token for an arbitrary role in the seeded tenant. */
  const tokenFor = (role: string) =>
    jwt.sign(
      // sessionId is a mandatory claim (a token without one could never be
      // revoked, so JwtStrategy rejects it). Use a fresh random one: it is never
      // in the revoked set, so authentication passes and the RBAC check stays
      // the only thing under test.
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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })

    // Fail loudly rather than silently skipping the suite.
    expect(login.status).toBe(200)
    adminToken = login.body.accessToken
    expect(typeof adminToken).toBe('string')

    jwt = app.get(JwtService, { strict: false })
    const decoded = jwt.decode(adminToken) as any
    tenantId = decoded.tenantId
    userId = decoded.sub
  })

  afterAll(async () => {
    await app?.close()
  })

  /* ── Authentication boundary ─────────────────────────────────── */

  describe('unauthenticated access', () => {
    const guarded: Array<[string, string]> = [
      ['get', '/api/v1/projects'],
      ['get', '/api/v1/residents'],
      ['get', '/api/v1/leads'],
      ['get', '/api/v1/dashboard/stats'],
      ['get', '/api/v1/signatures/packages'],
      ['get', '/api/v1/tasks'],
      ['get', '/api/v1/buildings'],
      ['get', '/api/v1/documents'],
    ]

    it.each(guarded)('%s %s without a token → 401', async (method, url) => {
      const res = await (request(app.getHttpServer()) as any)[method](url)
      expect(res.status).toBe(401)
    })
  })

  /* ── Read endpoints must be staff-only ───────────────────────── */

  describe('RESIDENT role is denied staff read endpoints', () => {
    // A RESIDENT is a real, assignable UserRole. It must not be able to read
    // tenant-wide staff data (other residents' PII, project pipeline, leads,
    // dashboard aggregates, or signature packages and their evidence).
    const staffReads = [
      '/api/v1/projects',
      '/api/v1/residents',
      '/api/v1/leads',
      '/api/v1/dashboard/stats',
      '/api/v1/signatures/packages',
    ]

    it.each(staffReads)('RESIDENT → GET %s → 403', async (url) => {
      const res = await request(app.getHttpServer())
        .get(url)
        .set({ Authorization: `Bearer ${tokenFor('RESIDENT')}` })

      expect(res.status).toBe(403)
    })

    it.each(staffReads)('COMPANY_ADMIN → GET %s → not 403', async (url) => {
      const res = await request(app.getHttpServer())
        .get(url)
        .set({ Authorization: `Bearer ${adminToken}` })

      expect(res.status).not.toBe(403)
    })
  })

  /* ── Destructive signature actions ───────────────────────────── */

  describe('signature package mutations are restricted', () => {
    // Deleting a signature package destroys legally significant records.
    // Every non-signature role must be refused at the API, not merely have the
    // button hidden in the UI.
    const outsiders = ['RESIDENT', 'MUNICIPALITY_USER', 'EXTERNAL_CONSULTANT', 'FIELD_AGENT']

    it.each(outsiders)('%s → DELETE /signatures/packages/:id → 403', async (role) => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/signatures/packages/nonexistent-package-id')
        .set({ Authorization: `Bearer ${tokenFor(role)}` })

      // Must be refused by the roles guard BEFORE the handler runs, so a
      // missing record (404) would mean the role check never happened.
      expect(res.status).toBe(403)
    })

    it.each(outsiders)('%s → PATCH /signatures/packages/:id/submit → 403', async (role) => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/signatures/packages/nonexistent-package-id/submit')
        .set({ Authorization: `Bearer ${tokenFor(role)}` })

      expect(res.status).toBe(403)
    })

    it('LAWYER → DELETE /signatures/packages/:id → not 403 (authorized role)', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/signatures/packages/nonexistent-package-id')
        .set({ Authorization: `Bearer ${tokenFor('LAWYER')}` })

      expect(res.status).not.toBe(403)
    })
  })

  /* ── Signature evidence is sensitive ─────────────────────────── */

  describe('signature evidence is not readable by outsiders', () => {
    const evidenceRoutes = [
      '/api/v1/signatures/packages/some-id/evidence',
      '/api/v1/signatures/packages/some-id/evidence/pdf',
      '/api/v1/signatures/packages/some-id/download',
    ]

    it.each(evidenceRoutes)('RESIDENT → GET %s → 403', async (url) => {
      const res = await request(app.getHttpServer())
        .get(url)
        .set({ Authorization: `Bearer ${tokenFor('RESIDENT')}` })

      expect(res.status).toBe(403)
    })
  })

  /* ── Project writes are manager-tier ─────────────────────────── */

  describe('project mutations are manager-tier only', () => {
    it('FIELD_AGENT → POST /projects → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set({ Authorization: `Bearer ${tokenFor('FIELD_AGENT')}` })
        .send({ name: 'RBAC probe', city: 'Tel Aviv' })

      expect(res.status).toBe(403)
    })

    it('FIELD_AGENT → PUT /projects/:id → 403', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/projects/some-project-id')
        .set({ Authorization: `Bearer ${tokenFor('FIELD_AGENT')}` })
        .send({ name: 'RBAC probe' })

      expect(res.status).toBe(403)
    })

    it('FIELD_AGENT → GET /projects → allowed (staff read)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set({ Authorization: `Bearer ${tokenFor('FIELD_AGENT')}` })

      expect(res.status).not.toBe(403)
    })
  })

  /* ── Tenant administration is super-admin only ───────────────── */

  describe('tenant administration', () => {
    it('COMPANY_ADMIN → POST /tenants → 403 (SUPER_ADMIN only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set({ Authorization: `Bearer ${adminToken}` })
        .send({ name: 'RBAC probe tenant', slug: 'rbac-probe' })

      expect(res.status).toBe(403)
    })

    it('FIELD_AGENT → GET /users → 403 (admin only)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set({ Authorization: `Bearer ${tokenFor('FIELD_AGENT')}` })

      expect(res.status).toBe(403)
    })
  })
})
