/**
 * Response leak sweep.
 *
 * Walks the real, authenticated API surface and asserts that no response body
 * carries secrets or PII that the CRM never needs. This is a server-side
 * contract: hiding a field in the frontend is not stripping it.
 *
 * Forbidden in ANY response:
 *   - nationalId (תעודת זהות) — PII, never needed by the CRM UI
 *   - passwordHash / password / mfaSecret — credentials
 *   - refreshToken / accessToken outside the auth endpoints that mint them
 *   - s3Key / pdfS3Key / evidencePackageKey / s3Bucket / storageKey — raw
 *     storage paths
 *   - AWS/S3 credentials and encryption keys
 *
 * The sweep walks the parsed JSON tree by KEY, so it catches a leak nested at
 * any depth rather than only at the top level.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
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

/** Keys that must never appear anywhere in an API response body. */
const FORBIDDEN_KEYS = [
  'nationalId',
  'passwordHash',
  'password',
  'mfaSecret',
  's3Key',
  's3Bucket',
  // ImportJob.storageKey — the MinIO object key for an uploaded workbook. Same
  // reasoning as s3Key: the key is a capability, and the workbook behind it is
  // a sheet full of national IDs.
  'storageKey',
  'pdfS3Key',
  'evidencePackageKey',
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'encryptionKey',
  'FIELD_ENCRYPTION_KEY',
  'JWT_SECRET',
]

/** Collect every path at which a forbidden key appears. */
function findForbiddenKeys(node: unknown, path = '$'): string[] {
  const hits: string[] = []

  if (Array.isArray(node)) {
    node.forEach((v, i) => hits.push(...findForbiddenKeys(v, `${path}[${i}]`)))
    return hits
  }

  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.includes(k)) hits.push(`${path}.${k}`)
      hits.push(...findForbiddenKeys(v, `${path}.${k}`))
    }
  }

  return hits
}

describe('Response leak sweep (e2e)', () => {
  let app: INestApplication
  let token: string
  let jwt: JwtService

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

    expect(login.status).toBe(200)
    token = login.body.accessToken
    jwt = app.get(JwtService, { strict: false })
  })

  afterAll(async () => {
    await app?.close()
  })

  const auth = () => ({ Authorization: `Bearer ${token}` })

  /* ── Broad sweep over list + detail endpoints ────────────────── */

  const listEndpoints = [
    '/api/v1/projects?limit=50',
    '/api/v1/residents?limit=50',
    '/api/v1/leads?limit=50',
    '/api/v1/tasks?limit=50',
    '/api/v1/documents?limit=50',
    '/api/v1/buildings?limit=50',
    '/api/v1/buildings/complexes',
    '/api/v1/buildings/apartments',
    '/api/v1/communications?limit=50',
    '/api/v1/signatures/packages?limit=50',
    '/api/v1/data-quality/issues?limit=50',
    '/api/v1/dashboard/stats',
    '/api/v1/gis/overview',
    '/api/v1/users',
    '/api/v1/imports?limit=50',
  ]

  it.each(listEndpoints)('%s leaks no sensitive keys', async (url) => {
    const res = await request(app.getHttpServer()).get(url).set(auth())
    expect([200, 404]).toContain(res.status)

    if (res.status !== 200) return
    const hits = findForbiddenKeys(res.body)
    expect(hits).toEqual([])
  })

  /* ── Detail endpoints, driven off real ids ───────────────────── */

  it('project detail leaks no sensitive keys', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/projects?limit=1').set(auth())
    const project = (list.body.data ?? list.body)[0]
    if (!project) return

    for (const url of [
      `/api/v1/projects/${project.id}`,
      `/api/v1/projects/${project.id}/signature-report`,
    ]) {
      const res = await request(app.getHttpServer()).get(url).set(auth())
      if (res.status !== 200) continue
      expect(findForbiddenKeys(res.body)).toEqual([])
    }
  })

  it('resident detail never exposes nationalId', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/residents?limit=1').set(auth())
    const resident = (list.body.data ?? list.body)[0]
    if (!resident) return

    const res = await request(app.getHttpServer())
      .get(`/api/v1/residents/${resident.id}`)
      .set(auth())

    expect(res.status).toBe(200)
    expect(findForbiddenKeys(res.body)).toEqual([])
    // Explicit, since this is the highest-risk field in the product.
    expect(JSON.stringify(res.body)).not.toContain('nationalId')
  })

  it('signature package detail and evidence expose no storage keys', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/signatures/packages?limit=1')
      .set(auth())
    const pkg = (list.body.data ?? list.body)[0]
    if (!pkg) return

    for (const url of [
      `/api/v1/signatures/packages/${pkg.id}`,
      `/api/v1/signatures/packages/${pkg.id}/progress`,
      `/api/v1/signatures/packages/${pkg.id}/events`,
      `/api/v1/signatures/packages/${pkg.id}/evidence`,
    ]) {
      const res = await request(app.getHttpServer()).get(url).set(auth())
      if (res.status !== 200) continue
      expect({ url, hits: findForbiddenKeys(res.body) }).toEqual({ url, hits: [] })
    }
  })

  /* ── Auth endpoints ──────────────────────────────────────────── */

  describe('auth responses', () => {
    it('login returns no passwordHash and no mfaSecret', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD })

      expect(res.status).toBe(200)
      const serialized = JSON.stringify(res.body)
      expect(serialized).not.toContain('passwordHash')
      expect(serialized).not.toContain('mfaSecret')
      expect(serialized).not.toContain('nationalId')
    })

    it('the JWT payload carries no PII beyond email and ids', async () => {
      const decoded = jwt.decode(token) as Record<string, unknown>
      const allowed = ['sub', 'email', 'role', 'tenantId', 'sessionId', 'iat', 'exp']
      expect(Object.keys(decoded).sort()).toEqual(
        Object.keys(decoded)
          .filter((k) => allowed.includes(k))
          .sort(),
      )
    })

    it('/auth/me exposes no credential material', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me').set(auth())
      if (res.status !== 200) return
      expect(findForbiddenKeys(res.body)).toEqual([])
    })
  })

  /* ── Error bodies must not leak internals ────────────────────── */

  describe('error responses', () => {
    it('a 404 body carries no stack trace or query text', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects/definitely-not-a-real-id')
        .set(auth())

      expect(res.status).toBe(404)
      const serialized = JSON.stringify(res.body)
      expect(serialized).not.toContain('prisma')
      expect(serialized).not.toContain('SELECT')
      expect(serialized).not.toMatch(/at .*\.ts:\d+/)
    })
  })
})
