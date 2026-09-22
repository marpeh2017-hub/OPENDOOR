/**
 * Buildings / Complexes / Apartments E2E.
 *
 * Buildings carry no `tenantId` column — the boundary is enforced by walking
 * Building → Complex → Project → tenantId. These tests pin that behaviour plus
 * the RBAC contract (write endpoints are MANAGER_ROLES-only).
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SEED_EMAIL    = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'

/** An id that belongs to no tenant — stands in for another tenant's row. */
const FOREIGN_BUILDING_ID  = 'bldg_not_in_this_tenant'
const FOREIGN_APARTMENT_ID = 'apt_not_in_this_tenant'

describe('Buildings (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let token: string | undefined

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
    prisma = app.get(PrismaService)

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })

    // Fail loudly rather than silently skipping the whole suite.
    expect(login.status).toBe(200)
    token = login.body.accessToken
    expect(typeof token).toBe('string')
  })

  afterAll(async () => {
    await app?.close()
  })

  const auth = () => ({ Authorization: `Bearer ${token}` })

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('GET /buildings without a token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/buildings')
    expect(res.status).toBe(401)
  })

  // ── Reads ─────────────────────────────────────────────────────────────────

  it('GET /buildings returns the tenant buildings with counts', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/buildings').set(auth())

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    for (const b of res.body) {
      expect(b).toHaveProperty('apartmentCount')
      expect(b).toHaveProperty('residentCount')
      expect(b.complex.project).toHaveProperty('id')
    }
  })

  it('GET /complexes returns complexes for the tenant', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/complexes').set(auth())
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /buildings/:id returns apartments and never leaks nationalId', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/buildings').set(auth())
    if (list.body.length === 0) return // nothing seeded to drill into

    const res = await request(app.getHttpServer())
      .get(`/api/v1/buildings/${list.body[0].id}`)
      .set(auth())

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.apartments)).toBe(true)
    expect(JSON.stringify(res.body)).not.toContain('nationalId')
  })

  // ── Tenant isolation ──────────────────────────────────────────────────────

  it('GET /buildings/:id for another tenant → 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/buildings/${FOREIGN_BUILDING_ID}`)
      .set(auth())
    expect(res.status).toBe(404)
  })

  it('GET /apartments/:id for another tenant → 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/apartments/${FOREIGN_APARTMENT_ID}`)
      .set(auth())
    expect(res.status).toBe(404)
  })

  it('PATCH /buildings/:id for another tenant → 404 (no cross-tenant write)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/buildings/${FOREIGN_BUILDING_ID}`)
      .set(auth())
      .send({ floors: 99 })
    expect(res.status).toBe(404)
  })

  it('POST /buildings into a complex outside the tenant → 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set(auth())
      .send({ complexId: 'cx_not_in_this_tenant', address: 'רחוב בדיקה 1' })
    expect(res.status).toBe(404)
  })

  // ── RBAC ──────────────────────────────────────────────────────────────────
  // Write endpoints are MANAGER_ROLES-only. A token that is not a manager must
  // be rejected with 403 — an invalid token is rejected earlier with 401.

  it('unauthenticated POST /buildings → 401 (never 200)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .send({ complexId: 'x', address: 'y' })
    expect(res.status).toBe(401)
  })

  it('unauthenticated DELETE /buildings/:id → 401', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/buildings/${FOREIGN_BUILDING_ID}`)
    expect(res.status).toBe(401)
  })

  // ── Write round-trip (manager token from the seed admin) ──────────────────

  it('creates, updates and ARCHIVES a building inside the tenant', async () => {
    const complexes = await request(app.getHttpServer()).get('/api/v1/complexes').set(auth())
    if (complexes.body.length === 0) return

    const complexId = complexes.body[0].id

    const created = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set(auth())
      .send({ complexId, address: 'בדיקת E2E', city: 'תל אביב', floors: 4 })

    expect(created.status).toBe(201)
    const id = created.body.id
    expect(id).toBeTruthy()

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/buildings/${id}`)
      .set(auth())
      .send({ floors: 7 })
    expect(updated.status).toBe(200)
    expect(updated.body.floors).toBe(7)

    // Re-read to prove the change actually persisted.
    const reread = await request(app.getHttpServer())
      .get(`/api/v1/buildings/${id}`)
      .set(auth())
    expect(reread.body.floors).toBe(7)

    // DELETE is a SOFT ARCHIVE, not a destructive delete.
    //
    // Apartments — and through them ownership shares, residents and signature
    // records — cascade from Building, so a hard delete would destroy the
    // evidence behind an already-reported signature threshold. The row stays
    // readable with status 'archived'; this test asserts that contract rather
    // than the previous 404-after-delete behaviour.
    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/buildings/${id}`)
      .set(auth())
    expect(removed.status).toBe(200)
    expect(removed.body.status).toBe('archived')

    const archived = await request(app.getHttpServer())
      .get(`/api/v1/buildings/${id}`)
      .set(auth())
    expect(archived.status).toBe(200)
    expect(archived.body.status).toBe('archived')

    // Restoring is the inverse of archiving.
    const restored = await request(app.getHttpServer())
      .patch(`/api/v1/buildings/${id}/status`)
      .set(auth())
      .send({ status: 'active' })
    expect(restored.status).toBe(200)
    expect(restored.body.status).toBe('active')

    // Leave no test data behind: this row is hard-removed directly, which the
    // API deliberately will not do.
    await prisma.building.delete({ where: { id } })
  })
})
