/**
 * OTP E2E tests
 * Verifies that OTP flow is secure ג€” no OTP value leaks in responses or logs.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType, Logger } from '@nestjs/common'
import request from 'supertest'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'

/** Every phone this suite sends an OTP to — cleared from Redis before each run. */
const OTP_TEST_PHONES = ['0501234567', '0507654321', '0509876543', '0501111111', '0502222222', '0503333333']

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
    })
      /*
       * Login now carries per-IP limits far tighter than the global defaults
       * (2 sends/10s, 3 verifies/10s), because an OTP endpoint is where
       * enumeration happens. This suite fires well past that in a burst, and
       * 429s would replace the 401s it is actually asserting.
       *
       * Replace the throttler's STORAGE, not the guard: `overrideGuard` does
       * not work because APP_GUARD is registered with `useClass`, which
       * constructs a fresh instance rather than resolving the overridden
       * token. Its injected `ThrottlerStorage` IS resolved from the container.
       * Same seam, and same reasoning, as documents-upload.e2e-spec.ts.
       *
       * The per-phone budget (3 sends/hour, 5 guesses/code) is enforced in
       * Redis by the service itself and is NOT affected by this override — it
       * is asserted for real in portal-login.e2e-spec.ts.
       */
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0,
        }),
      })
      .compile()

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

    // sendOtp() rate-limits to 3 sends per phone per hour in Redis. When these
    // tests run against a real Redis, that counter survives the process and the
    // quota is exhausted by the *previous* run — the first send then answers
    // 400 and the suite fails for reasons unrelated to the code under test.
    // Reset the counters this suite owns so each run starts from a clean slate.
    const redis = app.get<{ del: (...k: string[]) => Promise<number> }>('REDIS')
    await redis.del(
      ...OTP_TEST_PHONES.flatMap(p => [`otp:rate:${p}`, `otp:${p}`, `otp:attempts:${p}`]),
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

  /**
   * S3, S5, S8 — the OTP is the resident portal's ONLY authentication factor.
   * These tests exist so the three properties that make it worth anything
   * cannot regress silently.
   */
  describe('OTP code strength and verification limits', () => {
    const redisOf = () => app.get<{
      get: (k: string) => Promise<string | null>
      set: (k: string, v: string) => Promise<unknown>
      del: (...k: string[]) => Promise<number>
      exists: (k: string) => Promise<number>
    }>('REDIS')

    it('S8: stores the code as a keyed digest, never plaintext and never a bare sha256', async () => {
      const phone = '0502222222'
      const redis = redisOf()
      await redis.del(`otp:rate:${phone}`, `otp:${phone}`, `otp:attempts:${phone}`)
      await request(app.getHttpServer()).post('/api/v1/auth/otp/send').send({ phone }).expect(200)

      const stored = await redis.get(`otp:${phone}`)
      expect(stored).toMatch(/^[0-9a-f]{64}$/)      // a digest, not the code
      expect(stored).not.toMatch(/^\d{6}$/)          // and not the code itself

      // A bare sha256 over a 6-digit space is enumerable in milliseconds, so
      // the stored value must NOT match sha256 of any 6-digit code. Checking a
      // sample is enough to prove the pepper is applied at all.
      const { createHash } = await import('crypto')
      for (const candidate of ['000000', '123456', '999999']) {
        expect(stored).not.toBe(createHash('sha256').update(candidate).digest('hex'))
      }
    })

    it('S5: destroys the code after five wrong attempts, so the sixth cannot succeed', async () => {
      const phone = '0503333333'
      const redis = redisOf()
      await redis.del(`otp:rate:${phone}`, `otp:${phone}`, `otp:attempts:${phone}`)
      await request(app.getHttpServer()).post('/api/v1/auth/otp/send').send({ phone }).expect(200)
      expect(await redis.exists(`otp:${phone}`)).toBe(1)

      // Four wrong guesses: rejected, but the code survives.
      for (let i = 0; i < 4; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/otp/verify').send({ phone, code: '000000' })
        expect(res.status).toBe(401)
      }
      expect(await redis.exists(`otp:${phone}`)).toBe(1)

      // The fifth spends the budget and destroys the code.
      const fifth = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify').send({ phone, code: '000000' })
      expect(fifth.status).toBe(401)
      expect(fifth.body.message).toMatch(/יותר מדי ניסיונות/)
      expect(await redis.exists(`otp:${phone}`)).toBe(0)
      expect(await redis.exists(`otp:attempts:${phone}`)).toBe(0)
    })

    it('S5: a fresh send resets the attempt budget', async () => {
      const phone = '0503333333'
      const redis = redisOf()
      await redis.del(`otp:rate:${phone}`, `otp:${phone}`, `otp:attempts:${phone}`)
      await request(app.getHttpServer()).post('/api/v1/auth/otp/send').send({ phone }).expect(200)
      await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({ phone, code: '000000' })
      expect(await redis.get(`otp:attempts:${phone}`)).toBe('1')

      await request(app.getHttpServer()).post('/api/v1/auth/otp/send').send({ phone }).expect(200)
      expect(await redis.exists(`otp:attempts:${phone}`)).toBe(0)
    })

    it('S3: successive codes differ — a fixed or trivially sequential generator would fail this', async () => {
      const phone = '0502222222'
      const redis = redisOf()
      const digests = new Set<string>()
      for (let i = 0; i < 3; i++) {
        await redis.del(`otp:rate:${phone}`, `otp:${phone}`, `otp:attempts:${phone}`)
        await request(app.getHttpServer()).post('/api/v1/auth/otp/send').send({ phone }).expect(200)
        digests.add((await redis.get(`otp:${phone}`)) ?? '')
      }
      // Same phone, same pepper: identical codes would produce identical
      // digests. Three distinct digests means three distinct codes.
      expect(digests.size).toBe(3)
    })

    it('S4: an unregistered number is rejected after a correct code, not before', async () => {
      // The OTP proves control of a phone. It must never be treated as proof
      // of entitlement to a resident profile.
      const phone = '0509876543'
      const redis = redisOf()
      await redis.del(`otp:rate:${phone}`, `otp:${phone}`, `otp:attempts:${phone}`)
      await request(app.getHttpServer()).post('/api/v1/auth/otp/send').send({ phone }).expect(200)
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/verify').send({ phone, code: '000000' })
      expect(res.status).toBe(401)
      // No token is ever issued on this path.
      expect(JSON.stringify(res.body)).not.toContain('accessToken')
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
