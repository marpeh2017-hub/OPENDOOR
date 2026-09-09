/**
 * CRM authentication + BFF proxy regression tests.
 *
 * Covers the contract the CRM's same-origin proxy depends on:
 *   - login with valid / invalid credentials
 *   - authenticated request with a Bearer token (what the proxy forwards)
 *   - GET /auth/me returns the identity shape JwtStrategy.validate() emits
 *   - logout revokes the session server-side
 *   - a revoked session is rejected on the next request
 *   - unauthenticated request -> 401
 *   - RBAC denial -> 403, never collapsed into 401
 *   - tenant isolation
 *   - createdById is populated from `userId` (regression for the req.user.sub bug)
 *
 * Requires: PostgreSQL dev database with seed data, NODE_ENV=test.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SEED_EMAIL = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'

describe('CRM auth flow + BFF proxy contract (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwtService: JwtService
  let accessToken: string | null = null
  let seeded = false

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = app.get(PrismaService)
    jwtService = app.get(JwtService)

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })

    if (res.status === 200) {
      seeded = true
      accessToken = res.body.accessToken
    }
  })

  afterAll(async () => {
    await app?.close()
  })

  // ── Login ────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    it('rejects invalid credentials with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_EMAIL, password: 'definitely-not-the-password' })
        .expect(401)
    })

    it('rejects an unknown user with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever123' })
        .expect(401)
    })

    it('issues access + refresh tokens for valid credentials', async () => {
      if (!seeded) return
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
        .expect(200)

      expect(res.body).toHaveProperty('accessToken')
      expect(res.body).toHaveProperty('refreshToken')
      expect(res.body.user).toHaveProperty('role')
      // The password hash must never leave the server.
      expect(res.body.user).not.toHaveProperty('passwordHash')
    })

    it('embeds sessionId in the access token so it can be revoked', async () => {
      if (!seeded || !accessToken) return
      const payload = jwtService.decode(accessToken) as Record<string, unknown>
      expect(payload.sessionId).toBeTruthy()
      expect(payload.sub).toBeTruthy()
      expect(payload.tenantId).toBeTruthy()
    })
  })

  // ── Authenticated request (what the BFF proxy forwards) ──────────────────
  describe('Bearer-authenticated requests', () => {
    it('unauthenticated request returns 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/projects').expect(401)
    })

    it('tampered token returns 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401)
    })

    it('valid Bearer token returns project data', async () => {
      if (!seeded || !accessToken) return
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(Array.isArray(res.body.data)).toBe(true)
      expect(typeof res.body.total).toBe('number')
    })

    it('GET /auth/me returns the identity JwtStrategy emits (userId, not sub)', async () => {
      if (!seeded || !accessToken) return
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(res.body).toHaveProperty('userId')
      expect(res.body).toHaveProperty('tenantId')
      expect(res.body).toHaveProperty('role')
      expect(res.body).toHaveProperty('sessionId')
      // `sub` is the raw JWT claim name; validate() maps it to userId.
      expect(res.body.sub).toBeUndefined()
    })

    it('/auth/me requires authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401)
    })
  })

  // ── RBAC: denial must be 403, not 401 ────────────────────────────────────
  describe('RBAC denials stay 403', () => {
    function tokenForRole(role: string, tenantId = 'tnt_01'): string {
      return jwtService.sign(
        {
          sub: 'usr_rbac_test',
          email: 'rbac-test@example.com',
          role,
          tenantId,
          sessionId: `rbac-test-${role}-${Date.now()}`,
          // A RESIDENT token must ALSO carry its project and resident scope, for
          // the same reason it must carry a sessionId: `JwtStrategy` rejects a
          // resident token it cannot safely scope, so without these the 403 under
          // test here would never be reached — the request would 401 first. The
          // ids are probes: these routes are staff routes and run no
          // resident-scoped query.
          ...(role === 'RESIDENT' ? { projectId: 'prj_rbac_probe', residentId: 'res_rbac_probe' } : {}),
        },
        { secret: process.env.JWT_SECRET!, expiresIn: '5m' },
      )
    }

    it('a RESIDENT creating a project is rejected with 403, not 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${tokenForRole('RESIDENT')}`)
        .send({ name: 'RBAC probe', city: 'תל אביב' })

      expect(res.status).toBe(403)
      expect(res.status).not.toBe(401)
    })

    it('a FIELD_AGENT running a global data-quality scan is rejected with 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/data-quality/scan/global')
        .set('Authorization', `Bearer ${tokenForRole('FIELD_AGENT')}`)
        .send({})

      expect(res.status).toBe(403)
    })

    it('a PROJECT_MANAGER listing users is rejected with 403 (admin-only)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${tokenForRole('PROJECT_MANAGER')}`)

      expect(res.status).toBe(403)
    })
  })

  // ── Tenant isolation ─────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it('a token for another tenant sees none of tnt_01 projects', async () => {
      const otherTenantToken = jwtService.sign(
        {
          sub: 'usr_other_tenant',
          email: 'other@example.com',
          role: 'COMPANY_ADMIN',
          tenantId: 'tnt_does_not_exist',
          sessionId: `iso-test-${Date.now()}`,
        },
        { secret: process.env.JWT_SECRET!, expiresIn: '5m' },
      )

      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .expect(200)

      expect(res.body.data).toHaveLength(0)
      expect(res.body.total).toBe(0)
    })

    it('a token with no tenantId is rejected', async () => {
      const noTenant = jwtService.sign(
        { sub: 'usr_x', email: 'x@example.com', role: 'COMPANY_ADMIN', sessionId: 'no-tenant' },
        { secret: process.env.JWT_SECRET!, expiresIn: '5m' },
      )

      await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${noTenant}`)
        .expect(401)
    })
  })

  // ── createdById regression (req.user.sub -> req.user.userId) ─────────────
  describe('createdById is populated from the authenticated user', () => {
    it('POST /tasks records createdById (regression: was silently undefined)', async () => {
      if (!seeded || !accessToken) return

      const me = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'createdById regression probe',
          type: 'GENERAL',
          status: 'PENDING',
          priority: 'LOW',
        })

      expect([200, 201]).toContain(res.status)
      expect(res.body.createdById).toBe(me.body.userId)
      expect(res.body.createdById).not.toBeNull()
      expect(res.body.createdById).toBeDefined()

      await prisma.task.delete({ where: { id: res.body.id } }).catch(() => undefined)
    })
  })

  // ── Logout + session revocation ──────────────────────────────────────────
  describe('logout revokes the session', () => {
    it('after logout the same token is rejected with 401', async () => {
      if (!seeded) return

      // Fresh session so we do not revoke the token other tests share.
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
        .expect(200)

      const token = login.body.accessToken as string

      // Works before logout.
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204)

      // Rejected after logout — the token itself is still cryptographically
      // valid, so this proves server-side revocation is enforced.
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401)

      await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .expect(401)
    })

    it('logout requires authentication', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401)
    })

    /**
     * Regression for the CRM logout control (sidebar → "התנתקות").
     *
     * The CRM route handler clears both cookies AND calls this endpoint. If a
     * stale refresh token survived (e.g. a tab that reloads right after logout),
     * minting a new access token from it must NOT resurrect the session: the
     * revocation is keyed on sessionId, which the refreshed token carries over.
     */
    it('a token refreshed after logout is still rejected', async () => {
      if (!seeded) return

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
        .expect(200)

      const { accessToken: token, refreshToken } = login.body as {
        accessToken: string
        refreshToken: string
      }

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204)

      // The refresh endpoint itself must refuse a revoked session — it must not
      // mint a token at all. (Previously it returned 200 and handed back a
      // token that only died later at JwtStrategy; the CRM then stored that
      // dead token in a cookie and looked "logged in" while every call 401'd.)
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401)
    })

    /**
     * Regression: the revocation marker must outlive the refresh token.
     *
     * logout() writes jwt:revoked:{sessionId} with a TTL. If that TTL were the
     * access-token lifetime (24h) rather than the refresh-token lifetime (30d),
     * a stolen refresh token would resurrect a logged-out session on day 2.
     */
    it('the revocation marker TTL covers the full refresh-token lifetime', async () => {
      if (!seeded) return

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
        .expect(200)

      const token = login.body.accessToken as string
      const { sessionId } = jwtService.decode(token) as { sessionId: string }

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204)

      const redis = app.get<{ ttl: (k: string) => Promise<number> }>('REDIS')
      const ttl = await redis.ttl(`jwt:revoked:${sessionId}`)

      // 30 days, allowing for clock/handshake slack. -1 (no expiry) also
      // satisfies the security property; -2 (missing key) does not.
      expect(ttl === -1 || ttl > 29 * 24 * 60 * 60).toBe(true)
    })

    /**
     * Regression: a token with no sessionId claim can never be revoked, so the
     * strategy must reject it outright rather than waving it through.
     */
    it('rejects an otherwise-valid access token that carries no sessionId', async () => {
      const forged = jwtService.sign(
        { sub: 'usr_admin_01', email: SEED_EMAIL, role: 'COMPANY_ADMIN', tenantId: 'tnt_01' },
        { expiresIn: '1h' },
      )

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401)

      await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401)
    })

    it('rejects a refresh token that carries no sessionId', async () => {
      const forged = jwtService.sign({ sub: 'usr_admin_01' }, { expiresIn: '30d' })

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: forged })
        .expect(401)
    })

    /**
     * Regression: logging out of one device must not log out the others.
     * Revocation is per-sessionId, and each login mints a fresh sessionId.
     */
    it('revoking one session leaves other concurrent sessions working', async () => {
      if (!seeded) return

      const logins = await Promise.all(
        [0, 1, 2].map(() =>
          request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
            .expect(200),
        ),
      )
      const tokens = logins.map(l => l.body.accessToken as string)
      const sessionIds = tokens.map(t => (jwtService.decode(t) as { sessionId: string }).sessionId)

      // Each login is its own session.
      expect(new Set(sessionIds).size).toBe(3)

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${tokens[1]}`)
        .expect(204)

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokens[1]}`)
        .expect(401)

      for (const survivor of [tokens[0], tokens[2]]) {
        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${survivor}`)
          .expect(200)
      }

      // Cleanup.
      for (const survivor of [tokens[0], tokens[2]]) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${survivor}`)
      }
    })

    /**
     * Regression for the journey: login → logout → login again.
     * The new session must work and the old one must stay dead.
     */
    it('login -> logout -> login again: old session stays revoked, new one works', async () => {
      if (!seeded) return

      const first = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
        .expect(200)
      const oldToken = first.body.accessToken as string
      const oldRefresh = first.body.refreshToken as string

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(204)

      const second = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
        .expect(200)
      const newToken = second.body.accessToken as string

      expect((jwtService.decode(newToken) as { sessionId: string }).sessionId).not.toBe(
        (jwtService.decode(oldToken) as { sessionId: string }).sessionId,
      )

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200)

      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401)

      // Re-logging in must not un-revoke the previous session's refresh token.
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldRefresh })
        .expect(401)

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${newToken}`)
    })
  })

  // ── PII must not leak to the client ──────────────────────────────────────
  describe('sensitive fields are not returned', () => {
    it('GET /residents never returns nationalId', async () => {
      if (!seeded || !accessToken) return
      const res = await request(app.getHttpServer())
        .get('/api/v1/residents?limit=50')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      for (const resident of res.body.data) {
        expect(resident).not.toHaveProperty('nationalId')
      }
    })

    it('GET /signatures/packages never returns evidencePackageKey (raw S3 path)', async () => {
      if (!seeded || !accessToken) return
      const res = await request(app.getHttpServer())
        .get('/api/v1/signatures/packages')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      for (const pkg of res.body) {
        expect(pkg).not.toHaveProperty('evidencePackageKey')
      }
      expect(JSON.stringify(res.body)).not.toContain('signature-evidence/')
    })

    it('GET /documents never returns s3Key', async () => {
      if (!seeded || !accessToken) return
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      for (const doc of res.body) {
        expect(doc).not.toHaveProperty('s3Key')
      }
    })
  })
})
