/**
 * GIS geocoding E2E.
 *
 * Covers the geocoding foundation added in Phase 1: coordinate provenance, the
 * manual override path, the admin-triggered sweep endpoint, and the guards that
 * stop a wrong or unverifiable result from ever reaching a real project.
 *
 * ── Two deliberate constraints on this suite ──────────────────────────────
 *
 * 1. **No test makes a live Nominatim request.** The public instance is a
 *    donated resource capped at 1 request/second, and 24 suites running in
 *    parallel against it would be exactly the bulk abuse its usage policy
 *    forbids. The verification logic is therefore exercised directly as pure
 *    functions, and the sweep endpoint is exercised over a candidate set that
 *    is provably empty — which tests routing, RBAC, tenant scoping and the
 *    response contract without touching the network.
 *
 * 2. **Every assertion is scoped to this suite's own tenant.** All 24 suites
 *    share one dev database and run concurrently, so any assertion on a global
 *    row count would flake. This suite seeds `e2e-geocoding-tenant`, asserts
 *    only against ids it created, and purges it in afterAll.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import {
  parseStoredCoordinates,
  toJsonValue,
} from '../src/gis/coordinates'
import {
  citiesAgree,
  distanceKm,
  normalizePlaceName,
  qualityRank,
  MIN_ACCEPTABLE_QUALITY,
} from '../src/gis/geocoding/geocoding.types'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const TENANT_SLUG = 'e2e-geocoding-tenant'
const OTHER_TENANT_SLUG = 'e2e-geocoding-other-tenant'

/** Real coordinates for Herzl 45, Tel Aviv — used only as a manual-override input. */
const HERZL_45 = { lat: 32.059161, lng: 34.77083 }

describe('GIS geocoding (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let tenantId: string
  let otherTenantId: string
  let managerToken: string
  let staffToken: string
  let residentToken: string

  let projectId: string
  let complexId: string
  let buildingId: string
  /** A project in a different tenant — the isolation probe target. */
  let otherProjectId: string
  /** A project with NO address, so it is never a geocode candidate. */
  let addresslessProjectId: string

  const purgeTenant = async (slug: string) => {
    const t = await prisma.tenant.findUnique({ where: { slug } })
    if (!t) return
    const projects = await prisma.project.findMany({
      where: { tenantId: t.id },
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
    await prisma.apartment.deleteMany({
      where: { buildingId: { in: buildings.map((b) => b.id) } },
    })
    await prisma.building.deleteMany({ where: { complexId: { in: complexIds } } })
    await prisma.complex.deleteMany({ where: { projectId: { in: projectIds } } })
    await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
    await prisma.project.deleteMany({ where: { tenantId: t.id } })
    await prisma.user.deleteMany({ where: { tenantId: t.id } })
    await prisma.tenant.delete({ where: { id: t.id } })
  }

  const tokenFor = (role: string, tid: string, uid: string) =>
    jwt.sign(
      // sessionId is mandatory on every token this app issues; a fresh random
      // one is never revoked, so it isolates RBAC from authentication.
      { sub: uid, email: `${role.toLowerCase()}@e2e.local`, role, tenantId: tid, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '15m' },
    )

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    // Mirrors main.ts exactly, including forbidNonWhitelisted — the allow-list
    // rejection is part of what this suite asserts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })

    await purgeTenant(TENANT_SLUG)
    await purgeTenant(OTHER_TENANT_SLUG)

    const tenant = await prisma.tenant.create({
      data: { name: 'E2E Geocoding', slug: TENANT_SLUG },
    })
    tenantId = tenant.id

    const other = await prisma.tenant.create({
      data: { name: 'E2E Geocoding Other', slug: OTHER_TENANT_SLUG },
    })
    otherTenantId = other.id

    const manager = await prisma.user.create({
      data: {
        tenantId, email: `geo-mgr-${randomUUID()}@e2e.local`,
        firstName: 'Geo', lastName: 'Manager', role: 'COMPANY_ADMIN',
      },
    })
    const staff = await prisma.user.create({
      data: {
        tenantId, email: `geo-staff-${randomUUID()}@e2e.local`,
        firstName: 'Geo', lastName: 'Lawyer', role: 'LAWYER',
      },
    })
    managerToken  = tokenFor('COMPANY_ADMIN', tenantId, manager.id)
    staffToken    = tokenFor('LAWYER', tenantId, staff.id)
    residentToken = tokenFor('RESIDENT', tenantId, manager.id)

    const project = await prisma.project.create({
      data: {
        tenantId, code: `GEO-${randomUUID().slice(0, 8)}`,
        name: 'E2E גיאוקודינג הרצל', city: 'תל אביב', address: 'הרצל 45',
      },
    })
    projectId = project.id

    const addressless = await prisma.project.create({
      data: {
        tenantId, code: `GEO-NA-${randomUUID().slice(0, 8)}`,
        name: 'E2E גיאוקודינג ללא כתובת', city: 'תל אביב',
      },
    })
    addresslessProjectId = addressless.id

    const complex = await prisma.complex.create({
      data: { projectId, name: 'E2E מתחם', address: 'הרצל 43-47' },
    })
    complexId = complex.id

    const building = await prisma.building.create({
      data: { complexId, address: 'הרצל 45', city: 'תל אביב' },
    })
    buildingId = building.id

    const otherProject = await prisma.project.create({
      data: {
        tenantId: otherTenantId, code: `GEO-OTH-${randomUUID().slice(0, 8)}`,
        name: 'E2E טננט אחר', city: 'חיפה', address: 'הרצל 1',
      },
    })
    otherProjectId = otherProject.id
  })

  afterAll(async () => {
    await purgeTenant(TENANT_SLUG)
    await purgeTenant(OTHER_TENANT_SLUG)
    await app?.close()
  })

  const asManager  = () => ({ Authorization: `Bearer ${managerToken}` })
  const asStaff    = () => ({ Authorization: `Bearer ${staffToken}` })
  const asResident = () => ({ Authorization: `Bearer ${residentToken}` })

  // ───────────────────────── coordinate parsing ─────────────────────────
  describe('coordinate storage format', () => {
    it('parses a plain object from the Json column', () => {
      expect(parseStoredCoordinates({ lat: 32.1, lng: 34.8 })).toMatchObject({ lat: 32.1, lng: 34.8 })
    })

    it('parses a JSON string, which older rows may hold', () => {
      // The SQLite-flavoured schema variant typed this column as String?, so
      // both shapes must read back identically rather than one being invisible.
      expect(parseStoredCoordinates('{"lat":32.1,"lng":34.8}')).toMatchObject({ lat: 32.1, lng: 34.8 })
    })

    it('preserves provenance alongside the pair', () => {
      const parsed = parseStoredCoordinates({
        lat: 32.1, lng: 34.8, source: 'GEOCODED', provider: 'nominatim',
        matchQuality: 'HOUSE_NUMBER', confidence: 0.42, resolvedAt: '2026-01-01T00:00:00.000Z',
      })
      expect(parsed).toMatchObject({
        source: 'GEOCODED', provider: 'nominatim', matchQuality: 'HOUSE_NUMBER', confidence: 0.42,
      })
    })

    it('rejects malformed, out-of-range and non-coordinate values', () => {
      expect(parseStoredCoordinates(null)).toBeNull()
      expect(parseStoredCoordinates('')).toBeNull()
      expect(parseStoredCoordinates('not json')).toBeNull()
      expect(parseStoredCoordinates([1, 2])).toBeNull()
      expect(parseStoredCoordinates({ lat: 91, lng: 34 })).toBeNull()
      expect(parseStoredCoordinates({ lat: 32, lng: 181 })).toBeNull()
      expect(parseStoredCoordinates({ lat: 'abc', lng: 34 })).toBeNull()
      expect(parseStoredCoordinates({ lng: 34 })).toBeNull()
    })

    it('strips undefined keys so Prisma accepts the Json payload', () => {
      const json = toJsonValue({ lat: 1, lng: 2, note: undefined as unknown as string })
      expect('note' in json).toBe(false)
    })
  })

  // ───────────────────── verification guard logic ───────────────────────
  describe('verification guards', () => {
    it('treats Hebrew city renderings that differ only in typography as equal', () => {
      // Nominatim returns תל־אביב–יפו (maqaf + en-dash) for a stored תל אביב.
      // Without this, every Tel Aviv match would be discarded as a mismatch.
      expect(citiesAgree('תל אביב', 'תל־אביב–יפו')).toBe(true)
      expect(citiesAgree('רמת גן', 'רמת גן')).toBe(true)
      expect(citiesAgree('תל אביב-יפו', 'תל־אביב–יפו')).toBe(true)
    })

    it('rejects a genuinely different city', () => {
      // This is the guard that matters most: an unbounded Hebrew query matches
      // on the house NUMBER alone and returns a confident result in the wrong
      // city. Herzl 45, Tel Aviv resolving to Jerusalem must never be accepted.
      expect(citiesAgree('תל אביב', 'ירושלים')).toBe(false)
      expect(citiesAgree('תל אביב', 'כסיפה')).toBe(false)
      expect(citiesAgree('רמת גן', 'רמת השרון')).toBe(false)
      expect(citiesAgree('תל אביב', null)).toBe(false)
      expect(citiesAgree(null, 'תל אביב')).toBe(false)
    })

    it('normalises away maqaf, dashes, quotes and whitespace', () => {
      expect(normalizePlaceName('תל־אביב–יפו')).toBe(normalizePlaceName('תל אביב יפו'))
      expect(normalizePlaceName(null)).toBe('')
    })

    it('ranks a city centroid below the minimum acceptable precision', () => {
      // A LOCALITY match is a city centroid; placing a building there would
      // imply a precision that does not exist.
      expect(qualityRank('LOCALITY')).toBeLessThan(qualityRank(MIN_ACCEPTABLE_QUALITY))
      expect(qualityRank('AREA')).toBeLessThan(qualityRank(MIN_ACCEPTABLE_QUALITY))
      expect(qualityRank('STREET')).toBeGreaterThanOrEqual(qualityRank(MIN_ACCEPTABLE_QUALITY))
      expect(qualityRank('HOUSE_NUMBER')).toBeGreaterThan(qualityRank('STREET'))
    })

    it('measures candidate separation well enough to judge ambiguity', () => {
      expect(distanceKm(HERZL_45, HERZL_45)).toBeCloseTo(0, 5)
      // Tel Aviv → Jerusalem is ~54km; comfortably past any ambiguity radius.
      expect(distanceKm(HERZL_45, { lat: 31.78, lng: 35.22 })).toBeGreaterThan(50)
    })
  })

  // ───────────────────────── pending candidates ─────────────────────────
  describe('GET /gis/geocode/pending', () => {
    it('requires authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/gis/geocode/pending')
      expect(res.status).toBe(401)
    })

    it('rejects a non-staff role with 403, not 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gis/geocode/pending')
        .set(asResident())
      expect(res.status).toBe(403)
    })

    it('lists this tenant’s addressed-but-unplaced entities', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gis/geocode/pending?projectId=${projectId}`)
        .set(asStaff())

      expect(res.status).toBe(200)
      const kinds = res.body.candidates.map((c: any) => `${c.kind}:${c.id}`)
      expect(kinds).toContain(`PROJECT:${projectId}`)
      expect(kinds).toContain(`COMPLEX:${complexId}`)
      expect(kinds).toContain(`BUILDING:${buildingId}`)
    })

    it('omits an entity that has no address at all', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gis/geocode/pending?projectId=${addresslessProjectId}`)
        .set(asStaff())

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(0)
    })

    it('never lists another tenant’s entities', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gis/geocode/pending')
        .set(asStaff())

      expect(res.status).toBe(200)
      const ids = res.body.candidates.map((c: any) => c.id)
      expect(ids).not.toContain(otherProjectId)
    })
  })

  // ───────────────────────── manual override ────────────────────────────
  describe('PUT /gis/coordinates/:kind/:id', () => {
    it('rejects a non-manager staff role with 403', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/gis/coordinates/PROJECT/${projectId}`)
        .set(asStaff())
        .send(HERZL_45)
      expect(res.status).toBe(403)
    })

    it('rejects an unknown entity kind with 400', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/gis/coordinates/PLANET/${projectId}`)
        .set(asManager())
        .send(HERZL_45)
      expect(res.status).toBe(400)
    })

    it('rejects out-of-range coordinates', async () => {
      for (const bad of [{ lat: 999, lng: 34 }, { lat: 32, lng: 999 }, { lat: 'abc', lng: 34 }]) {
        const res = await request(app.getHttpServer())
          .put(`/api/v1/gis/coordinates/PROJECT/${projectId}`)
          .set(asManager())
          .send(bad)
        expect(res.status).toBe(400)
      }
    })

    it('rejects a field that is not on the allow-list', async () => {
      // Provenance is an assertion the SERVER makes. A caller must not be able
      // to claim its hand-typed guess came from a provider.
      const res = await request(app.getHttpServer())
        .put(`/api/v1/gis/coordinates/PROJECT/${projectId}`)
        .set(asManager())
        .send({ ...HERZL_45, source: 'GEOCODED', provider: 'nominatim', confidence: 1 })
      expect(res.status).toBe(400)
    })

    it('returns 404 for a project in another tenant', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/gis/coordinates/PROJECT/${otherProjectId}`)
        .set(asManager())
        .send(HERZL_45)
      // Cross-tenant must be indistinguishable from "does not exist".
      expect(res.status).toBe(404)

      const untouched = await prisma.project.findUnique({ where: { id: otherProjectId } })
      expect(parseStoredCoordinates(untouched?.coordinates)).toBeNull()
    })

    it('persists a manual coordinate with MANUAL provenance and the actor id', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/gis/coordinates/PROJECT/${projectId}`)
        .set(asManager())
        .send({ ...HERZL_45, note: 'אומת מול תשריט' })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        lat: HERZL_45.lat, lng: HERZL_45.lng, source: 'MANUAL', provider: 'manual',
        note: 'אומת מול תשריט',
      })
      expect(typeof res.body.setByUserId).toBe('string')

      const row = await prisma.project.findUnique({ where: { id: projectId } })
      const stored = parseStoredCoordinates(row?.coordinates)
      expect(stored).toMatchObject({ lat: HERZL_45.lat, lng: HERZL_45.lng, source: 'MANUAL' })
    })

    it('audits the override against this tenant', async () => {
      const rows = await prisma.auditLog.findMany({
        where: { tenantId, entity: 'Project', entityId: projectId },
      })
      expect(rows.length).toBeGreaterThan(0)
      // `metadata` is a Json column, so String() on it yields "[object Object]".
      const meta = rows.map((r) => JSON.stringify(r.metadata ?? null))
      expect(meta.some((m) => m.includes('manual-coordinate-override'))).toBe(true)
      // The actor, not "system", must be on the row.
      expect(rows.every((r) => typeof r.userId === 'string' && r.userId.length > 0)).toBe(true)
    })

    it('surfaces the manual point on the map overview with its provenance', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gis/overview?projectId=${projectId}`)
        .set(asStaff())

      expect(res.status).toBe(200)
      const feature = res.body.features.find((f: any) => f.id === projectId)
      expect(feature).toBeDefined()
      expect(feature.coordinates).toMatchObject(HERZL_45)
      expect(feature.provenance).toMatchObject({ source: 'MANUAL', provider: 'manual' })
      expect(res.body.coverage.projects.withCoordinates).toBe(1)
      expect(res.body.hasAnyGeoData).toBe(true)
    })

    it('drops the entity from the pending queue once placed', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gis/geocode/pending?projectId=${projectId}`)
        .set(asStaff())

      const ids = res.body.candidates.map((c: any) => `${c.kind}:${c.id}`)
      expect(ids).not.toContain(`PROJECT:${projectId}`)
      // The complex and building are still unplaced and still queued.
      expect(ids).toContain(`COMPLEX:${complexId}`)
    })
  })

  // ───────────────────────── sweep endpoint ─────────────────────────────
  describe('POST /gis/geocode/run', () => {
    it('rejects a non-manager staff role with 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gis/geocode/run')
        .set(asStaff())
        .send({ projectId: addresslessProjectId })
      expect(res.status).toBe(403)
    })

    it('rejects a limit above the batch cap', async () => {
      // A larger batch would be bulk geocoding, which the provider's usage
      // policy forbids outright.
      const res = await request(app.getHttpServer())
        .post('/api/v1/gis/geocode/run')
        .set(asManager())
        .send({ limit: 999 })
      expect(res.status).toBe(400)
    })

    it('rejects an unknown entity kind', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gis/geocode/run')
        .set(asManager())
        .send({ kinds: ['PLANET'] })
      expect(res.status).toBe(400)
    })

    it('rejects a field that is not on the allow-list', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gis/geocode/run')
        .set(asManager())
        .send({ tenantId: 'tnt_01' })
      expect(res.status).toBe(400)
    })

    it('reports an empty run without contacting the provider', async () => {
      // Scoped to the address-less project, so the candidate set is provably
      // empty and the sweep cannot make a network request.
      const res = await request(app.getHttpServer())
        .post('/api/v1/gis/geocode/run')
        .set(asManager())
        .send({ projectId: addresslessProjectId, limit: 1 })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        provider: 'nominatim', pending: 0, attempted: 0, matched: 0, failed: 0, stoppedEarly: false,
      })
      expect(res.body.results).toHaveLength(0)
      expect(typeof res.body.attribution).toBe('string')
    })

    it('cannot be pointed at another tenant’s project', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/gis/geocode/run')
        .set(asManager())
        .send({ projectId: otherProjectId, limit: 1 })

      // The project is invisible to this tenant, so there is nothing to sweep.
      expect(res.status).toBe(200)
      expect(res.body.pending).toBe(0)
      expect(res.body.attempted).toBe(0)

      const untouched = await prisma.project.findUnique({ where: { id: otherProjectId } })
      expect(parseStoredCoordinates(untouched?.coordinates)).toBeNull()
    })
  })

  // ───────────────────────── clearing ───────────────────────────────────
  describe('DELETE /gis/coordinates/:kind/:id', () => {
    it('rejects a non-manager staff role with 403', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/gis/coordinates/PROJECT/${projectId}`)
        .set(asStaff())
      expect(res.status).toBe(403)
    })

    it('clears the coordinate and returns the entity to being unplaced', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/gis/coordinates/PROJECT/${projectId}`)
        .set(asManager())
      expect(res.status).toBe(200)

      const row = await prisma.project.findUnique({ where: { id: projectId } })
      expect(parseStoredCoordinates(row?.coordinates)).toBeNull()

      const overview = await request(app.getHttpServer())
        .get(`/api/v1/gis/overview?projectId=${projectId}`)
        .set(asStaff())
      expect(overview.body.features.find((f: any) => f.id === projectId)).toBeUndefined()
      expect(overview.body.coverage.projects.withCoordinates).toBe(0)
      // Back in the queue, counted as geocodable rather than placed.
      expect(overview.body.coverage.projects.geocodable).toBe(1)
    })
  })
})
