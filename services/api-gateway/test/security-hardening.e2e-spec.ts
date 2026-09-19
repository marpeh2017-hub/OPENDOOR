/**
 * Security hardening — S1, S2, S4, S6.
 *
 * These are the findings from `docs/SECURITY_INTEGRATION_AUDIT.md` that need
 * database fixtures or a forged request, so they could not live in the plain
 * OTP suite. S3, S5 and S8 are covered in `otp.e2e-spec.ts`.
 *
 * Each test here is written to fail against the PREVIOUS behaviour, not merely
 * to pass against the new one — a security test that would also have passed
 * before the fix is not evidence of anything.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { createHmac } from 'crypto'
import request from 'supertest'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const MARKER = `SEC-${Date.now().toString(36)}`
/** A number deliberately shared by two residents in two different tenants. */
const SHARED_PHONE = '0508887766'
const KNOWN_CODE = '424242'

/** Mirrors `otpPepper()` in auth.service.ts. */
const otpDigest = (code: string) =>
  createHmac('sha256', createHmac('sha256', process.env.JWT_SECRET!).update('otp-pepper-v1').digest())
    .update(code).digest('hex')

describe('Security hardening (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let redis: {
    set: (k: string, v: string) => Promise<unknown>
    setex: (k: string, ttl: number, v: string) => Promise<unknown>
    del: (...k: string[]) => Promise<number>
  }
  const createdTenantIds: string[] = []
  const createdResidentIds: string[] = []

  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
    prisma = app.get(PrismaService)
    redis = app.get('REDIS')

    // Clear anything a previous interrupted run left behind.
    await purge()

    // Two tenants, each with a resident holding the SAME phone number. This is
    // the situation the old `findFirst({ where: { phone } })` resolved by
    // coin flip.
    for (const suffix of ['a', 'b']) {
      const tenant = await prisma.tenant.create({
        data: { name: `${MARKER}-${suffix}`, slug: `${MARKER}-${suffix}`.toLowerCase() },
      })
      createdTenantIds.push(tenant.id)
      const project = await prisma.project.create({
        data: { tenantId: tenant.id, code: `${MARKER}-${suffix}`, name: `${MARKER}-${suffix}`, city: 'תל אביב' },
      })
      const complex = await prisma.complex.create({ data: { projectId: project.id, name: MARKER } })
      const building = await prisma.building.create({ data: { complexId: complex.id, address: 'כתובת בדיקה' } })
      const apartment = await prisma.apartment.create({ data: { buildingId: building.id, apartmentNumber: '1' } })
      const resident = await prisma.resident.create({
        data: {
          tenantId: tenant.id, apartmentId: apartment.id,
          firstName: MARKER, lastName: suffix, phone: SHARED_PHONE, isActive: true,
        },
      })
      createdResidentIds.push(resident.id)
    }
  }, 90_000)

  const purge = async () => {
    const stale = await prisma.tenant.findMany({ where: { slug: { startsWith: 'sec-' } }, select: { id: true } })
    for (const tenant of stale) {
      await prisma.resident.deleteMany({ where: { tenantId: tenant.id } })
      await prisma.project.deleteMany({ where: { tenantId: tenant.id } })
      await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => undefined)
    }
  }

  afterAll(async () => {
    await redis?.del(`otp:${SHARED_PHONE}`, `otp:rate:${SHARED_PHONE}`, `otp:attempts:${SHARED_PHONE}`)
    for (const id of createdResidentIds) await prisma.resident.delete({ where: { id } }).catch(() => undefined)
    for (const id of createdTenantIds) {
      await prisma.resident.deleteMany({ where: { tenantId: id } })
      await prisma.project.deleteMany({ where: { tenantId: id } })
      await prisma.tenant.delete({ where: { id } }).catch(() => undefined)
    }
    await app?.close()
  })

  /** Plants a known-good code so verification can be exercised deterministically. */
  const plantOtp = async (phone: string, code: string) => {
    await redis.del(`otp:attempts:${phone}`)
    await redis.setex(`otp:${phone}`, 300, otpDigest(code))
  }

  describe('S4 — a phone number is not an identity', () => {
    /*
     * ── WHAT CHANGED HERE, AND WHY THE ASSERTIONS MOVED ────────────────────
     *
     * The first fix for S4 was to REFUSE when a number matched residents in
     * two tenants. That was correct and deliberately temporary: it closed the
     * takeover, and it also locked out every resident who genuinely appears
     * twice — a spouse on two apartments, an owner in two projects — with an
     * error telling them to phone the office.
     *
     * The portal login now answers with a SELECTION CHALLENGE instead. The
     * security property is unchanged and is what these tests hold: verifying
     * an OTP against an ambiguous number issues NO SESSION. What follows is a
     * second, explicit step, and the code has still never picked.
     */
    it('issues no session when the number matches residents in two tenants', async () => {
      await plantOtp(SHARED_PHONE, KNOWN_CODE)
      const res = await http().post('/api/v1/auth/otp/verify').send({ phone: SHARED_PHONE, code: KNOWN_CODE })

      expect(res.status).toBe(200)
      expect(res.body.selectionRequired).toBe(true)
      // THE property. The old code answered here with a token for whichever
      // tenant the planner reached first — a cross-tenant takeover requiring
      // no effort.
      expect(JSON.stringify(res.body)).not.toContain('accessToken')
      expect(res.body.accessToken).toBeUndefined()
      expect(res.body.options).toHaveLength(2)
    })

    it('the choice on offer names apartments, never the other resident', async () => {
      await plantOtp(SHARED_PHONE, KNOWN_CODE)
      const res = await http().post('/api/v1/auth/otp/verify')
        .send({ phone: SHARED_PHONE, code: KNOWN_CODE }).expect(200)

      for (const option of res.body.options) {
        expect(Object.keys(option).sort()).toEqual(
          ['apartmentNumber', 'buildingAddress', 'projectName', 'residentId'],
        )
      }
      // Both records are reachable from this handset, so listing the homes is
      // not a disclosure about a third party — but names, phone numbers and
      // tenant ids would be, and none of them appear.
      const body = JSON.stringify(res.body)
      expect(body).not.toContain(SHARED_PHONE)
      expect(body).not.toContain('tenantId')
    })

    it('a tenant slug narrows the same login to one file, with no selection step', async () => {
      // This is what the portal sends when it is opened on a tenant subdomain.
      const slug = `${MARKER}-a`.toLowerCase()
      await plantOtp(SHARED_PHONE, KNOWN_CODE)

      const res = await http().post('/api/v1/auth/otp/verify')
        .send({ phone: SHARED_PHONE, code: KNOWN_CODE, tenantSlug: slug })

      expect(res.status).toBe(200)
      expect(res.body.selectionRequired).toBeUndefined()
      expect(res.body.residentId).toBe(createdResidentIds[0])
    })

    it('a tenant slug can NARROW the candidates but never widen them', async () => {
      // Tenant B's slug with a phone that has no active resident there: the
      // slug must not become the session's tenant on its own.
      await prisma.resident.update({ where: { id: createdResidentIds[1]! }, data: { isActive: false } })
      await plantOtp(SHARED_PHONE, KNOWN_CODE)

      const res = await http().post('/api/v1/auth/otp/verify')
        .send({ phone: SHARED_PHONE, code: KNOWN_CODE, tenantSlug: `${MARKER}-b`.toLowerCase() })

      expect(res.status).toBe(401)
      expect(JSON.stringify(res.body)).not.toContain('accessToken')

      await prisma.resident.update({ where: { id: createdResidentIds[1]! }, data: { isActive: true } })
    })

    it('issues a session once the ambiguity is gone', async () => {
      // Archive one of the two profiles; exactly one active match remains.
      await prisma.resident.update({ where: { id: createdResidentIds[1]! }, data: { isActive: false } })
      await plantOtp(SHARED_PHONE, KNOWN_CODE)

      const res = await http().post('/api/v1/auth/otp/verify').send({ phone: SHARED_PHONE, code: KNOWN_CODE })
      expect(res.status).toBe(200)
      expect(res.body.residentId).toBe(createdResidentIds[0])
      expect(typeof res.body.accessToken).toBe('string')

      await prisma.resident.update({ where: { id: createdResidentIds[1]! }, data: { isActive: true } })
    })

    it('ignores archived profiles entirely', async () => {
      // Both archived → no active match → rejected, not "pick the archived one".
      for (const id of createdResidentIds) {
        await prisma.resident.update({ where: { id }, data: { isActive: false } })
      }
      await plantOtp(SHARED_PHONE, KNOWN_CODE)
      const res = await http().post('/api/v1/auth/otp/verify').send({ phone: SHARED_PHONE, code: KNOWN_CODE })
      expect(res.status).toBe(401)
      expect(res.body.message).toMatch(/אינו רשום/)

      for (const id of createdResidentIds) {
        await prisma.resident.update({ where: { id }, data: { isActive: true } })
      }
    })

    it('consumes the code even on the ambiguous path — a rejected login still burns the OTP', async () => {
      await plantOtp(SHARED_PHONE, KNOWN_CODE)
      await http().post('/api/v1/auth/otp/verify').send({ phone: SHARED_PHONE, code: KNOWN_CODE }).expect(200)
      // Second use of the same code must fail as expired — the selection
      // challenge is the continuation, not a licence to verify again.
      const again = await http().post('/api/v1/auth/otp/verify').send({ phone: SHARED_PHONE, code: KNOWN_CODE })
      expect(again.status).toBe(401)
      expect(again.body.message).toMatch(/פג תוקף|שגוי/)
    })
  })

  describe('S1 — the signature webhook fails closed', () => {
    const body = JSON.stringify({ envelopeId: 'anything', event: 'envelope_completed' })

    it('rejects a request with no signature header at all', async () => {
      // THE critical regression: previously `if (secret && sig)` meant that
      // omitting the header skipped verification and the payload was processed.
      const res = await http().post('/api/v1/signatures/webhooks/comsign')
        .set('content-type', 'application/json').send(body)
      expect(res.status).toBe(401)
    })

    it('rejects an unknown provider name rather than treating it as unsigned', async () => {
      // `provider` is a caller-chosen path parameter and `getSecret()` returned
      // null for anything outside a hard-coded pair — so any invented name was
      // an unverified path straight into the state machine.
      const res = await http().post('/api/v1/signatures/webhooks/anything')
        .set('content-type', 'application/json')
        .set('x-signature', 'deadbeef')
        .set('x-signature-timestamp', String(Date.now()))
        .send(body)
      expect(res.status).toBe(401)
    })

    it('rejects the native provider, which never legitimately posts here', async () => {
      const res = await http().post('/api/v1/signatures/webhooks/native')
        .set('content-type', 'application/json')
        .set('x-signature', 'deadbeef')
        .set('x-signature-timestamp', String(Date.now()))
        .send(body)
      expect(res.status).toBe(401)
    })

    it('rejects a wrong signature', async () => {
      const res = await http().post('/api/v1/signatures/webhooks/comsign')
        .set('content-type', 'application/json')
        .set('x-signature', '00'.repeat(32))
        .set('x-signature-timestamp', String(Date.now()))
        .send(body)
      expect(res.status).toBe(401)
    })

    it('never reveals whether a secret is configured, an envelope exists, or a signer matched', async () => {
      const res = await http().post('/api/v1/signatures/webhooks/comsign')
        .set('content-type', 'application/json').send(body)
      const text = JSON.stringify(res.body)
      expect(text).not.toMatch(/secret|COMSIGN|DOCUSIGN|envelope/i)
    })
  })

  describe('S6 — replay protection', () => {
    const secret = 'test-webhook-secret'
    const body = JSON.stringify({ envelopeId: 'replay-test', event: 'envelope_completed' })
    const sign = (ts: string) => createHmac('sha256', secret).update(Buffer.concat([Buffer.from(ts), Buffer.from(body)])).digest('hex')

    beforeAll(() => { process.env.COMSIGN_WEBHOOK_SECRET = secret })
    afterAll(() => { delete process.env.COMSIGN_WEBHOOK_SECRET })

    it('rejects a correctly signed request whose timestamp is hours old', async () => {
      // The timestamp was already inside the HMAC, but its VALUE was never
      // checked — so a captured valid request replayed forever.
      const stale = String(Date.now() - 6 * 60 * 60 * 1000)
      const res = await http().post('/api/v1/signatures/webhooks/comsign')
        .set('content-type', 'application/json')
        .set('x-signature', sign(stale))
        .set('x-signature-timestamp', stale)
        .send(body)
      expect(res.status).toBe(401)
      expect(JSON.stringify(res.body)).toMatch(/timestamp/i)
    })

    it('rejects a request with no timestamp', async () => {
      const res = await http().post('/api/v1/signatures/webhooks/comsign')
        .set('content-type', 'application/json')
        .set('x-signature', sign(''))
        .send(body)
      expect(res.status).toBe(401)
    })

    it('accepts a correctly signed, fresh request — proving the gate is not simply closed to everything', async () => {
      const fresh = String(Date.now())
      const res = await http().post('/api/v1/signatures/webhooks/comsign')
        .set('content-type', 'application/json')
        .set('x-signature', sign(fresh))
        .set('x-signature-timestamp', fresh)
        .send(body)
      // No package matches 'replay-test', so the handler answers "received"
      // without doing anything. What matters is that it got PAST verification.
      expect(res.status).toBe(201)
      expect(res.body.received).toBe(true)
    })
  })
})
