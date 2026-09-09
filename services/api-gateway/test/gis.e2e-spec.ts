/**
 * GIS E2E.
 *
 * Pins three things:
 *   1. The overview endpoint is tenant-scoped and staff-only.
 *   2. RBAC — a token whose role is outside STAFF_ROLES gets 403, not 401.
 *   3. The endpoint never fabricates geography: every emitted feature carries
 *      real, finite coordinates, and entities without coordinates are reported
 *      as coverage gaps rather than placed on the map.
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
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SEED_EMAIL    = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'

describe('GIS (e2e)', () => {
  let app: INestApplication
  let token: string | undefined
  let tenantId: string
  let userId: string
  let jwtService: JwtService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })

    // Fail loudly rather than silently skipping the whole suite.
    expect(login.status).toBe(200)
    token = login.body.accessToken
    expect(typeof token).toBe('string')

    // Reuse the app's own JwtService rather than adding a signing dependency.
    jwtService = app.get(JwtService, { strict: false })
    const decoded = jwtService.decode(token as string) as any
    tenantId = decoded.tenantId
    userId   = decoded.sub
  })

  afterAll(async () => {
    await app?.close()
  })

  const auth = () => ({ Authorization: `Bearer ${token}` })

  it('GET /gis/overview without a token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/gis/overview')
    expect(res.status).toBe(401)
  })

  it('GET /gis/overview with a non-staff role → 403 (not 401)', async () => {
    // A structurally valid token signed with the real secret, but carrying a
    // role that is not in STAFF_ROLES — this must fail authorization, not
    // authentication.
    const outsiderToken = jwtService.sign(
      {
        sub: userId,
        email: SEED_EMAIL,
        role: 'RESIDENT',
        tenantId,
        // A resident token must carry its project and resident scope or
        // `JwtStrategy` rejects it outright — and this test is about
        // authorization, so it has to get past authentication first.
        projectId: 'prj_rbac_probe',
        residentId: 'res_rbac_probe',
        // sessionId is mandatory; a fresh random one is never revoked, so this
        // isolates the RBAC check without weakening authentication.
        sessionId: randomUUID(),
      },
      { secret: process.env.JWT_SECRET as string, expiresIn: '5m' },
    )

    const res = await request(app.getHttpServer())
      .get('/api/v1/gis/overview')
      .set({ Authorization: `Bearer ${outsiderToken}` })

    expect(res.status).toBe(403)
  })

  it('GET /gis/overview returns coverage statistics for the tenant', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/gis/overview').set(auth())

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.features)).toBe(true)
    expect(Array.isArray(res.body.cities)).toBe(true)
    expect(typeof res.body.hasAnyGeoData).toBe('boolean')

    for (const level of ['projects', 'complexes', 'buildings']) {
      const c = res.body.coverage[level]
      expect(typeof c.total).toBe('number')
      expect(typeof c.withCoordinates).toBe('number')
      expect(typeof c.geocodable).toBe('number')
      // Cannot have more geocoded entities than entities.
      expect(c.withCoordinates).toBeLessThanOrEqual(c.total)
      expect(c.geocodable).toBeLessThanOrEqual(c.total)
    }
  })

  it('never emits a feature without real, finite coordinates', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/gis/overview').set(auth())
    expect(res.status).toBe(200)

    for (const f of res.body.features) {
      expect(Number.isFinite(f.coordinates.lat)).toBe(true)
      expect(Number.isFinite(f.coordinates.lng)).toBe(true)
      expect(Math.abs(f.coordinates.lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(f.coordinates.lng)).toBeLessThanOrEqual(180)
      expect(['PROJECT', 'COMPLEX', 'BUILDING']).toContain(f.kind)
    }

    // The feature count must equal the number of entities that actually carry
    // coordinates — nothing invented, nothing dropped (unfiltered request).
    const c = res.body.coverage
    const expected =
      c.projects.withCoordinates + c.complexes.withCoordinates + c.buildings.withCoordinates
    expect(res.body.features.length).toBe(expected)
    expect(res.body.hasAnyGeoData).toBe(expected > 0)
  })

  it('a search that matches nothing returns no features', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/gis/overview?search=zzz-no-such-place-zzz')
      .set(auth())

    expect(res.status).toBe(200)
    expect(res.body.features).toHaveLength(0)
  })

  it('filtering by a project outside the tenant yields an empty portfolio', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/gis/overview?projectId=prj_not_in_this_tenant')
      .set(auth())

    expect(res.status).toBe(200)
    expect(res.body.features).toHaveLength(0)
    expect(res.body.coverage.projects.total).toBe(0)
  })

  it('does not leak sensitive fields', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/gis/overview').set(auth())
    const body = JSON.stringify(res.body)
    expect(body).not.toContain('nationalId')
    expect(body).not.toContain('passwordHash')
    expect(body).not.toContain('s3Key')
  })
})
