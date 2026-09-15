/**
 * Auth E2E tests
 * Requires: PostgreSQL dev database (DATABASE_URL=postgresql://...)
 *           NODE_ENV=test (Redis falls back to in-memory mock)
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'

// Ensure test environment uses in-memory Redis fallback
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'

describe('Auth (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/v1/auth/login', () => {
    it('returns 401 with wrong credentials', async () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrongpassword' })
        .expect(401)
    })

    it('returns tokens with valid seed credentials (if seed data exists)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@opendoor.co.il', password: 'demo1234' })

      // Accept 200 (seed present) or 401 (seed not run) ג€” we verify shape if 200
      if (res.status === 200) {
        expect(res.body).toHaveProperty('accessToken')
        expect(res.body).toHaveProperty('refreshToken')
        expect(res.body.user).toHaveProperty('role')
      } else {
        expect(res.status).toBe(401)
      }
    })
  })

  describe('GET /api/v1/projects (unauthenticated)', () => {
    it('returns 401 without token', async () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .expect(401)
    })
  })

  describe('GET /api/v1/projects (expired/invalid token)', () => {
    it('returns 401 with a tampered token', async () => {
      return request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401)
    })
  })

  describe('POST /api/v1/auth/logout', () => {
    it('returns 204 when authenticated', async () => {
      // Login first
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@opendoor.co.il', password: 'demo1234' })

      if (loginRes.status !== 200) {
        return // Skip if no seed data
      }

      const { accessToken } = loginRes.body

      const logoutRes = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(logoutRes.status).toBe(204)

      // Subsequent request with same token should now be 401 (session revoked)
      const afterLogout = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(afterLogout.status).toBe(401)
    })
  })
})
