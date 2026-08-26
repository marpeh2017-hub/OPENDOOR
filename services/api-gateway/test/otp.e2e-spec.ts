/**
 * OTP E2E tests
 * Verifies that OTP flow is secure ג€” no OTP value leaks in responses or logs.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType, Logger } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'

/** Every phone this suite sends an OTP to — cleared from Redis before each run. */
const OTP_TEST_PHONES = ['0501234567', '0507654321', '0509876543', '0501111111']

describe('OTP (e2e)', () => {
  let app: INestApplication
  const logMessages: string[] = []

  beforeAll(async () => {
    // Spy on Logger to capture any log output
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((msg: string) => {
      logMessages.push(msg)
    })

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    // sendOtp() rate-limits to 3 sends per phone per hour in Redis. When these
    // tests run against a real Redis, that counter survives the process and the
    // quota is exhausted by the *previous* run — the first send then answers
    // 400 and the suite fails for reasons unrelated to the code under test.
    // Reset the counters this suite owns so each run starts from a clean slate.
    const redis = app.get<{ del: (...k: string[]) => Promise<number> }>('REDIS')
    await redis.del(
      ...OTP_TEST_PHONES.flatMap(p => [`otp:rate:${p}`, `otp:${p}`]),
    )
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    await app.close()
  })

  describe('POST /api/v1/auth/otp/send', () => {
    it('returns 200 for a valid Israeli phone number', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/send')
        .send({ phone: '0501234567' })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('expiresIn')
      // OTP value must NOT appear in response body
      expect(JSON.stringify(res.body)).not.toMatch(/\d{6}/)
    })

    it('returns 400 for an invalid phone number', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/send')
        .send({ phone: '12345' })
      expect(res.status).toBe(400)
    })

    it('OTP value does NOT appear in any logged message', () => {
      // All logged messages should not contain a 6-digit OTP
      for (const msg of logMessages) {
        // Allow masked phone (e.g. ****4567) but not a plain 6-digit code
        expect(msg).not.toMatch(/ג†’\s*\d{6}/)
        expect(msg).not.toMatch(/otp[:\s]+\d{6}/i)
      }
    })
  })

  describe('POST /api/v1/auth/otp/verify', () => {
    it('returns 401 for wrong OTP code', async () => {
      // Send OTP first
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/send')
        .send({ phone: '0507654321' })

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone: '0507654321', code: '000000' })

      expect(res.status).toBe(401)
    })

    it('OTP response body does not contain OTP value', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/otp/send')
        .send({ phone: '0509876543' })

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify')
        .send({ phone: '0509876543', code: '000000' })

      // Body should not contain any 6-digit code
      expect(JSON.stringify(res.body)).not.toMatch(/\b\d{6}\b/)
    })
  })

  describe('OTP rate limiting', () => {
    it('returns 400 (rate limit) after 3+ sends within 1 hour', async () => {
      const phone = '0501111111'

      // Exhaust rate limit
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/otp/send')
          .send({ phone })
      }

      // 4th attempt should be rate-limited
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/send')
        .send({ phone })

      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(/יותר מדי בקשות OTP/)
    })
  })
})
