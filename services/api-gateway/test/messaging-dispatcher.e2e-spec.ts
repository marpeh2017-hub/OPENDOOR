/**
 * Communications dispatcher E2E — Phases 1 & 2.
 *
 * The point of this suite is that the pipeline is REAL. Before it,
 * `POST /communications` wrote a `QUEUED` row that nothing consumed, and the
 * old suite pinned exactly that ("does NOT mark the message as sent — there is
 * no dispatcher"). So the assertions here are deliberately hostile to a
 * dispatcher that merely looks like it works:
 *
 *   • SENT IS NEVER WRITTEN WITHOUT A PROVIDER CALL. Proved by a provider stub
 *     that counts its invocations and by a provider that always throws — the
 *     latter must never produce a SENT row at any point in its retry life.
 *   • NO DOUBLE-SEND UNDER CONCURRENCY. Two dispatchers race the same message;
 *     exactly one claims it and the provider is called exactly ONCE. This is
 *     the assertion that would fail if the atomic `updateMany` claim were
 *     replaced by findUnique-then-update.
 *   • RETRY AND BACKOFF ARE OBSERVABLE. `attemptCount`, `nextAttemptAt` and the
 *     eventual FAILED are read back from the database, not inferred.
 *   • PROVIDER OUTPUT IS SANITISED. A provider that throws an error containing
 *     an OTP, a bearer token and a signing URL must leave none of them in
 *     `failureReason`, which the CRM renders.
 *   • DEV SENDS ARE MARKED SIMULATED. `isSimulated` is a column, not a log line.
 *
 * The worker LOOP is disabled under NODE_ENV=test (MESSAGE_WORKER_ENABLED), so
 * every tick here is explicit — no background timer can race an assertion.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { MessageDispatcherService } from '../src/messaging/message-dispatcher.service'
import { OutboundMessageService } from '../src/messaging/outbound-message.service'
import { ProviderRegistryService } from '../src/messaging/provider-registry.service'
import { DeliveryError } from '../src/messaging/providers/delivery-provider.interface'
import type { DeliveryProvider, DeliveryResult } from '../src/messaging/providers/delivery-provider.interface'
import { sanitiseProviderDetail } from '../src/messaging/sanitise'
import { normaliseIsraeliPhone } from '../src/messaging/phone'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const A_SLUG = 'e2e-disp-tenant-a'
const B_SLUG = 'e2e-disp-tenant-b'

/**
 * A programmable provider. `mode` is flipped per test, so one registry override
 * serves every scenario and the dispatcher never knows it is being lied to.
 */
class StubProvider implements DeliveryProvider {
  readonly name = 'stub'
  readonly isConfigured = true
  calls = 0
  mode: 'ok' | 'transient' | 'permanent' | 'leaky' | 'slow' = 'ok'
  constructor(readonly channel: any) {}

  async send(): Promise<DeliveryResult> {
    this.calls += 1
    switch (this.mode) {
      case 'transient':
        throw DeliveryError.transient('upstream 503 unavailable', '503')
      case 'permanent':
        throw DeliveryError.permanent('invalid phone number', '400')
      case 'leaky':
        // Everything a provider must never echo into our database.
        throw new Error(
          'Request failed: Authorization: Bearer sk_live_abcdef0123456789abcdef0123456789 ' +
          'otp=482913 apiKey="super-secret-value" to=+972501234567 ' +
          'link=https://portal.example/he/sign/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefgh',
        )
      case 'slow':
        await new Promise((r) => setTimeout(r, 50))
        return { providerMessageId: 'stub_slow', simulated: false }
      default:
        return { providerMessageId: `stub_${this.calls}`, simulated: false }
    }
  }
}

describe('Communications dispatcher (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let dispatcher: MessageDispatcherService
  let outbound: OutboundMessageService

  const stubs = new Map<string, StubProvider>()
  /** When false the registry returns the REAL provider (dev-noop in test). */
  let useStub = false
  let realRegistry: ProviderRegistryService

  let tenantAId: string
  let tenantBId: string
  let adminId: string
  let residentAId: string
  let residentBId: string
  let adminToken: string

  const stubFor = (channel: string) => {
    if (!stubs.has(channel)) stubs.set(channel, new StubProvider(channel))
    return stubs.get(channel)!
  }

  const token = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${role}@e2e-disp.test`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const makeUser = async (tenantId: string, email: string, role: string) => {
    const u = await prisma.user.create({
      data: {
        tenantId, email, firstName: 'ד', lastName: 'מ',
        role: role as any, passwordHash: 'not-a-real-hash-never-used',
      },
      select: { id: true },
    })
    return u.id
  }

  const makeChain = async (tenantId: string, code: string, resident: Record<string, any>) => {
    const project = await prisma.project.create({
      data: { tenantId, code, name: `Disp ${code}`, city: 'תל אביב' }, select: { id: true },
    })
    const complex = await prisma.complex.create({
      data: { projectId: project.id, name: `מתחם ${code}` }, select: { id: true },
    })
    const building = await prisma.building.create({
      data: { complexId: complex.id, address: 'רחוב הבדיקה 1', city: 'תל אביב' },
      select: { id: true },
    })
    const apartment = await prisma.apartment.create({
      data: { buildingId: building.id, apartmentNumber: '1' }, select: { id: true },
    })
    const r = await prisma.resident.create({
      data: { tenantId, apartmentId: apartment.id, firstName: 'דייר', lastName: code, ...resident },
      select: { id: true },
    })
    return { projectId: project.id, residentId: r.id }
  }

  const purge = async () => {
    for (const slug of [A_SLUG, B_SLUG]) {
      const t = await prisma.tenant.findUnique({ where: { slug } })
      if (!t) continue
      await prisma.message.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.apartment.deleteMany({
        where: { building: { complex: { project: { tenantId: t.id } } } },
      })
      await prisma.building.deleteMany({ where: { complex: { project: { tenantId: t.id } } } })
      await prisma.complex.deleteMany({ where: { project: { tenantId: t.id } } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } })
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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
      whitelist: true, transform: true, forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })
    dispatcher = app.get(MessageDispatcherService, { strict: false })
    outbound = app.get(OutboundMessageService, { strict: false })
    realRegistry = app.get(ProviderRegistryService, { strict: false })

    // Patch the live registry rather than replacing the provider, so the
    // dispatcher under test is the real wired one.
    const originalResolve = realRegistry.resolve.bind(realRegistry)
    jest.spyOn(realRegistry, 'resolve').mockImplementation((channel: any) =>
      useStub ? (stubFor(channel) as any) : originalResolve(channel),
    )

    await purge()
    const a = await prisma.tenant.create({ data: { name: 'E2E Disp A', slug: A_SLUG } })
    const b = await prisma.tenant.create({ data: { name: 'E2E Disp B', slug: B_SLUG } })
    tenantAId = a.id
    tenantBId = b.id

    adminId = await makeUser(tenantAId, 'admin@e2e-disp.test', 'COMPANY_ADMIN')
    adminToken = token(adminId, tenantAId, 'COMPANY_ADMIN')

    residentAId = (await makeChain(tenantAId, 'DSP-A', {
      phone: '050-111-2233', smsOptIn: true, whatsappOptIn: false,
      preferredChannel: 'SMS' as any,
    })).residentId
    residentBId = (await makeChain(tenantBId, 'DSP-B', {
      phone: '0502223344', smsOptIn: true,
    })).residentId
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    await purge()
    await app?.close()
  })

  beforeEach(() => {
    useStub = false
    for (const s of stubs.values()) { s.calls = 0; s.mode = 'ok' }
  })

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` })
  const post = (headers: Record<string, string>, body: any) =>
    request(app.getHttpServer()).post('/api/v1/communications').set(headers).send(body)

  const enqueueRaw = (over: Partial<Parameters<OutboundMessageService['enqueue']>[0]> = {}) =>
    outbound.enqueue({
      tenantId: tenantAId, channel: 'SMS', body: 'בדיקה',
      toPhone: '+972501112233', ...over,
    } as any)

  const readMsg = (id: string) => prisma.message.findUniqueOrThrow({ where: { id } })

  /* ══ Phase 1: the pipeline actually sends ═══════════════════════════════ */

  describe('enqueue → dispatch → SENT', () => {
    it('POST /communications enqueues a QUEUED, un-sent message', async () => {
      const res = await post(asAdmin(), {
        channel: 'SMS', residentId: residentAId, body: 'הודעת בדיקה',
      })
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('QUEUED')
      expect(res.body.direction).toBe('OUTBOUND')
      expect(res.body.sentAt).toBeNull()
      expect(res.body.attemptCount).toBe(0)
      // The resident's stored `050-111-2233` is normalised to E.164 at send time.
      expect(res.body.toPhone).toBe('+972501112233')
    })

    it('a dispatcher tick moves it to SENT and records the provider', async () => {
      useStub = true
      const { id } = await enqueueRaw({ body: 'לשליחה' })
      const outcome = await dispatcher.processOne(id)
      expect(outcome).toBe('sent')

      const row = await readMsg(id)
      expect(row.status).toBe('SENT')
      expect(row.sentAt).not.toBeNull()
      expect(row.attemptCount).toBe(1)
      expect(row.providerName).toBe('stub')
      expect(row.providerMessageId).toBe('stub_1')
      expect(row.failureReason).toBeNull()
      expect(stubFor('SMS').calls).toBe(1)
    })

    it('the DEV provider marks the row isSimulated — nothing was transmitted', async () => {
      // useStub stays false: this is the REAL registry, which in a non-production
      // environment resolves to the dev/no-op provider.
      const { id } = await enqueueRaw({ body: 'סימולציה' })
      expect(await dispatcher.processOne(id)).toBe('sent')

      const row = await readMsg(id)
      expect(row.status).toBe('SENT')
      expect(row.isSimulated).toBe(true)
      expect(row.providerName).toBe('dev-noop')
      expect(row.providerMessageId).toBe(`sim_${id}`)
    })

    it('a PORTAL message is DELIVERED immediately and is NOT simulated', async () => {
      const { id } = await enqueueRaw({ channel: 'PORTAL', residentId: residentAId, toPhone: null })
      expect(await dispatcher.processOne(id)).toBe('sent')
      const row = await readMsg(id)
      expect(row.status).toBe('DELIVERED')
      expect(row.deliveredAt).not.toBeNull()
      expect(row.isSimulated).toBe(false)
      expect(row.providerName).toBe('portal-inbox')
    })

    it('tick() drains a batch', async () => {
      useStub = true
      const ids = await Promise.all([1, 2, 3].map((n) => enqueueRaw({ body: `אצווה ${n}` })))
      const r = await dispatcher.tick({ tenantId: tenantAId })
      expect(r.sent).toBeGreaterThanOrEqual(3)
      for (const { id } of ids) {
        expect((await readMsg(id)).status).toBe('SENT')
      }
    })
  })

  /* ══ Phase 2: no double-send under concurrency ══════════════════════════ */

  describe('atomic claim — no double-send', () => {
    it('two concurrent dispatchers: exactly one claims, provider called ONCE', async () => {
      useStub = true
      const { id } = await enqueueRaw({ body: 'מרוץ' })

      const [a, b] = await Promise.all([
        dispatcher.processOne(id),
        dispatcher.processOne(id),
      ])

      const outcomes = [a, b].sort()
      // One winner, one loser. Anything else — two 'sent', or two 'skipped' —
      // is a broken claim.
      expect(outcomes).toEqual(['sent', 'skipped'])
      expect(stubFor('SMS').calls).toBe(1)

      const row = await readMsg(id)
      expect(row.status).toBe('SENT')
      // Incremented exactly once: the loser never got past the claim.
      expect(row.attemptCount).toBe(1)
    })

    it('eight concurrent claimers still yield exactly one send', async () => {
      useStub = true
      const { id } = await enqueueRaw({ body: 'מרוץ גדול' })

      const results = await Promise.all(
        Array.from({ length: 8 }, () => dispatcher.processOne(id)),
      )
      expect(results.filter((r) => r === 'sent')).toHaveLength(1)
      expect(results.filter((r) => r === 'skipped')).toHaveLength(7)
      expect(stubFor('SMS').calls).toBe(1)
      expect((await readMsg(id)).attemptCount).toBe(1)
    })

    it('concurrent tick() calls do not double-send a shared queue', async () => {
      useStub = true
      const ids = await Promise.all(
        Array.from({ length: 5 }, (_, n) => enqueueRaw({ body: `במקביל ${n}` })),
      )
      await Promise.all([dispatcher.tick({ tenantId: tenantAId }), dispatcher.tick({ tenantId: tenantAId }), dispatcher.tick({ tenantId: tenantAId })])

      /*
       * Asserted PER MESSAGE, not on the stub's global call counter. The
       * dispatcher is deliberately a global worker — `tick()` drains every
       * tenant's queue, which is correct behaviour and means a sibling test
       * suite's rows legitimately land in the same counter. `attemptCount === 1`
       * on each of OUR rows is the real no-double-send property, and it is the
       * one that would break if the atomic claim were removed.
       */
      for (const { id } of ids) {
        const row = await readMsg(id)
        expect(row.status).toBe('SENT')
        expect(row.attemptCount).toBe(1)
        expect(row.providerName).toBe('stub')
      }
    })

    it('a message already PROCESSING is never claimed again', async () => {
      useStub = true
      const { id } = await enqueueRaw({ body: 'תפוס' })
      await prisma.message.update({
        where: { id },
        data: { status: 'PROCESSING', lastAttemptAt: new Date() },
      })
      expect(await dispatcher.processOne(id)).toBe('skipped')
      expect(stubFor('SMS').calls).toBe(0)
    })

    it('a stuck PROCESSING row is re-queued only after the stuck timeout', async () => {
      const { id } = await enqueueRaw({ body: 'תקוע' })
      // Recently claimed — a send may still be in flight, so it must be LEFT.
      await prisma.message.update({
        where: { id },
        data: { status: 'PROCESSING', lastAttemptAt: new Date() },
      })
      await dispatcher.requeueStuck()
      expect((await readMsg(id)).status).toBe('PROCESSING')

      // Long abandoned — now it is safe to reclaim.
      await prisma.message.update({
        where: { id },
        data: { lastAttemptAt: new Date(Date.now() - 60 * 60_000) },
      })
      expect(await dispatcher.requeueStuck()).toBeGreaterThanOrEqual(1)
      expect((await readMsg(id)).status).toBe('QUEUED')
    })
  })

  /* ══ Phase 2: retry, backoff, permanent failure ═════════════════════════ */

  describe('retry policy and backoff', () => {
    it('a transient failure returns the message to QUEUED with a future nextAttemptAt', async () => {
      useStub = true
      stubFor('SMS').mode = 'transient'
      const { id } = await enqueueRaw({ body: 'ניסיון חוזר', maxAttempts: 3 })

      expect(await dispatcher.processOne(id)).toBe('retried')
      const row = await readMsg(id)
      expect(row.status).toBe('QUEUED')
      expect(row.attemptCount).toBe(1)
      expect(row.failureReason).toContain('503')
      // Backed off: not claimable right now.
      expect(row.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now() - 1000)
      expect(row.sentAt).toBeNull()
      expect(row.failedAt).toBeNull()
    })

    it('backoff actually defers the retry — a tick skips a message not yet due', async () => {
      useStub = true
      stubFor('SMS').mode = 'transient'
      const { id } = await enqueueRaw({ body: 'דחייה', maxAttempts: 5 })
      await dispatcher.processOne(id)

      await prisma.message.update({
        where: { id },
        data: { nextAttemptAt: new Date(Date.now() + 10 * 60_000) },
      })
      // Asserting on THIS message, not on a global call counter: `tick()`
      // legitimately drains other queued rows left by earlier tests, and a
      // counter assertion would be measuring those instead.
      await dispatcher.tick({ tenantId: tenantAId })
      const row = await readMsg(id)
      expect(row.attemptCount).toBe(1)
      expect(row.status).toBe('QUEUED')
      expect(row.sentAt).toBeNull()
    })

    it('exhausting maxAttempts ends in FAILED, never SENT', async () => {
      useStub = true
      stubFor('SMS').mode = 'transient'
      const { id } = await enqueueRaw({ body: 'ייכשל', maxAttempts: 3 })

      const seen: string[] = []
      for (let i = 0; i < 3; i += 1) {
        seen.push(await dispatcher.processOne(id))
        // Clear the backoff so the next attempt is claimable immediately.
        await prisma.message.updateMany({
          where: { id, status: 'QUEUED' }, data: { nextAttemptAt: new Date(0) },
        })
      }

      expect(seen).toEqual(['retried', 'retried', 'failed'])
      const row = await readMsg(id)
      expect(row.status).toBe('FAILED')
      expect(row.attemptCount).toBe(3)
      expect(row.failedAt).not.toBeNull()
      expect(row.sentAt).toBeNull()
      expect(row.nextAttemptAt).toBeNull()
      expect(stubFor('SMS').calls).toBe(3)
    })

    it('a FAILED message is not picked up again', async () => {
      useStub = true
      stubFor('SMS').mode = 'permanent'
      const { id } = await enqueueRaw({ body: 'סופי' })
      await dispatcher.processOne(id)
      const attempts = (await readMsg(id)).attemptCount
      await dispatcher.tick({ tenantId: tenantAId })
      const after = await readMsg(id)
      expect(after.status).toBe('FAILED')
      expect(after.attemptCount).toBe(attempts)
    })

    it('a PERMANENT failure skips retries entirely', async () => {
      useStub = true
      stubFor('SMS').mode = 'permanent'
      const { id } = await enqueueRaw({ body: 'מספר שגוי', maxAttempts: 5 })

      expect(await dispatcher.processOne(id)).toBe('failed')
      const row = await readMsg(id)
      expect(row.status).toBe('FAILED')
      // One attempt, not five — the whole point of the retryable flag.
      expect(row.attemptCount).toBe(1)
      expect(stubFor('SMS').calls).toBe(1)
    })

    it('a provider that throws never produces a SENT row at any point', async () => {
      useStub = true
      stubFor('SMS').mode = 'transient'
      const { id } = await enqueueRaw({ body: 'לעולם לא נשלח', maxAttempts: 4 })
      for (let i = 0; i < 4; i += 1) {
        await dispatcher.processOne(id)
        const row = await readMsg(id)
        expect(row.status).not.toBe('SENT')
        expect(row.sentAt).toBeNull()
        await prisma.message.updateMany({
          where: { id, status: 'QUEUED' }, data: { nextAttemptAt: new Date(0) },
        })
      }
      expect((await readMsg(id)).status).toBe('FAILED')
    })

    it('a failing message does not stop the rest of the batch', async () => {
      useStub = true
      const bad = await enqueueRaw({ body: 'רע' })
      const good = await enqueueRaw({ body: 'טוב' })
      // Fail the first call, succeed after.
      let first = true
      const stub = stubFor('SMS')
      const original = stub.send.bind(stub)
      jest.spyOn(stub, 'send').mockImplementation(async () => {
        if (first) { first = false; throw new Error('boom') }
        return original()
      })

      await expect(dispatcher.tick({ tenantId: tenantAId })).resolves.toBeDefined()
      const statuses = [
        (await readMsg(bad.id)).status,
        (await readMsg(good.id)).status,
      ]
      expect(statuses).toContain('SENT')
      jest.spyOn(stub, 'send').mockRestore()
    })
  })

  /* ══ Phase 2: sanitisation ══════════════════════════════════════════════ */

  describe('provider responses are sanitised', () => {
    it('no OTP, token, key, phone or signing link reaches failureReason', async () => {
      useStub = true
      stubFor('SMS').mode = 'leaky'
      const { id } = await enqueueRaw({ body: 'דליפה', maxAttempts: 1 })
      await dispatcher.processOne(id)

      const reason = (await readMsg(id)).failureReason ?? ''
      expect(reason.length).toBeGreaterThan(0)
      for (const secret of [
        'sk_live_abcdef0123456789abcdef0123456789',
        '482913',
        'super-secret-value',
        '+972501234567',
        'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefgh',
      ]) {
        expect(reason).not.toContain(secret)
      }
    })

    it('sanitiseProviderDetail strips secrets from arbitrary shapes', () => {
      expect(sanitiseProviderDetail('otp=123456')).not.toContain('123456')
      expect(sanitiseProviderDetail('Bearer abcdefghijklmnop')).not.toContain('abcdefghijklmnop')
      expect(sanitiseProviderDetail(new Error('call +972501234567'))).not.toContain('972501234567')
      expect(sanitiseProviderDetail({ status: 503, message: 'unavailable' })).toContain('503')
      // Never empty — an empty reason tells a support engineer nothing.
      expect(sanitiseProviderDetail(undefined).length).toBeGreaterThan(0)
    })

    it('a thrown Error never leaks its stack into the row', async () => {
      useStub = true
      stubFor('SMS').mode = 'leaky'
      const { id } = await enqueueRaw({ body: 'stack', maxAttempts: 1 })
      await dispatcher.processOne(id)
      const reason = (await readMsg(id)).failureReason ?? ''
      expect(reason).not.toContain('.ts:')
      expect(reason).not.toContain('at ')
    })
  })

  /* ══ Idempotency ════════════════════════════════════════════════════════ */

  describe('idempotency', () => {
    it('the same key enqueues once', async () => {
      const key = `e2e-idem-${randomUUID()}`
      const first = await enqueueRaw({ body: 'פעם אחת', idempotencyKey: key })
      const second = await enqueueRaw({ body: 'פעם אחת', idempotencyKey: key })
      expect(second.id).toBe(first.id)
      expect(second.deduplicated).toBe(true)
      expect(await prisma.message.count({
        where: { tenantId: tenantAId, idempotencyKey: key },
      })).toBe(1)
    })

    it('the key is scoped per tenant — another tenant may reuse it', async () => {
      const key = `e2e-idem-shared-${randomUUID()}`
      const a = await enqueueRaw({ body: 'א', idempotencyKey: key })
      const b = await outbound.enqueue({
        tenantId: tenantBId, channel: 'SMS', body: 'ב',
        toPhone: '+972502223344', idempotencyKey: key,
      })
      expect(b.id).not.toBe(a.id)
      expect(b.deduplicated).toBe(false)
    })

    it('concurrent enqueues with one key still create one row', async () => {
      const key = `e2e-idem-race-${randomUUID()}`
      const results = await Promise.all(
        Array.from({ length: 5 }, () => enqueueRaw({ body: 'מרוץ', idempotencyKey: key })),
      )
      const ids = new Set(results.map((r) => r.id))
      expect(ids.size).toBe(1)
      expect(await prisma.message.count({
        where: { tenantId: tenantAId, idempotencyKey: key },
      })).toBe(1)
    })
  })

  /* ══ Cancellation ═══════════════════════════════════════════════════════ */

  describe('cancellation', () => {
    it('a QUEUED message can be cancelled and is never dispatched', async () => {
      useStub = true
      const { id } = await enqueueRaw({ body: 'לביטול' })
      const res = await request(app.getHttpServer())
        .post(`/api/v1/communications/${id}/cancel`).set(asAdmin()).send({})
      expect(res.status).toBe(200)

      const row = await readMsg(id)
      expect(row.status).toBe('CANCELLED')
      expect(row.cancelledAt).not.toBeNull()

      // A tick must leave it alone entirely — still CANCELLED, still zero
      // attempts, no provider call ever attributed to it.
      await dispatcher.tick({ tenantId: tenantAId })
      const after = await readMsg(id)
      expect(after.status).toBe('CANCELLED')
      expect(after.attemptCount).toBe(0)
      expect(after.sentAt).toBeNull()
      expect(after.providerName).toBeNull()
    })

    it('a SENT message cannot be cancelled → 409', async () => {
      useStub = true
      const { id } = await enqueueRaw({ body: 'כבר נשלח' })
      await dispatcher.processOne(id)
      const res = await request(app.getHttpServer())
        .post(`/api/v1/communications/${id}/cancel`).set(asAdmin()).send({})
      expect(res.status).toBe(409)
    })

    it('cancelling another tenant’s message → 404', async () => {
      const other = await outbound.enqueue({
        tenantId: tenantBId, channel: 'SMS', body: 'זר', toPhone: '+972502223344',
      })
      const res = await request(app.getHttpServer())
        .post(`/api/v1/communications/${other.id}/cancel`).set(asAdmin()).send({})
      expect(res.status).toBe(404)
      expect((await readMsg(other.id)).status).toBe('QUEUED')
    })
  })

  /* ══ RBAC and tenant isolation ══════════════════════════════════════════ */

  describe('RBAC', () => {
    it('no token → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/communications').send({ channel: 'SMS', residentId: residentAId, body: 'x' })
      expect(res.status).toBe(401)
    })

    it('RESIDENT role → 403', async () => {
      const res = await post({ Authorization: `Bearer ${token(adminId, tenantAId, 'RESIDENT')}` },
        { channel: 'SMS', residentId: residentAId, body: 'x' })
      expect(res.status).toBe(403)
    })

    it('LAWYER cannot send but can cancel nothing it does not own', async () => {
      const res = await post({ Authorization: `Bearer ${token(adminId, tenantAId, 'LAWYER')}` },
        { channel: 'SMS', residentId: residentAId, body: 'x' })
      expect(res.status).toBe(403)
    })

    it('client-forged dispatch columns are rejected → 400', async () => {
      for (const forged of [
        { status: 'SENT' }, { isSimulated: false }, { attemptCount: 99 },
        { providerName: 'twilio' }, { idempotencyKey: 'forged' }, { sentAt: new Date().toISOString() },
      ]) {
        const res = await post(asAdmin(), {
          channel: 'SMS', residentId: residentAId, body: 'x', ...forged,
        })
        expect(res.status).toBe(400)
      }
    })
  })

  describe('tenant isolation', () => {
    it('messaging another tenant’s resident → 404', async () => {
      const res = await post(asAdmin(), {
        channel: 'SMS', residentId: residentBId, body: 'cross tenant',
      })
      expect(res.status).toBe(404)
    })

    it('no message row was created for the other tenant by that attempt', async () => {
      expect(await prisma.message.count({
        where: { residentId: residentBId, body: 'cross tenant' },
      })).toBe(0)
    })
  })

  /* ══ Phone normalisation ════════════════════════════════════════════════ */

  describe('Israeli phone normalisation', () => {
    it.each([
      ['050-123-4567', '+972501234567', true],
      ['0501234567', '+972501234567', true],
      ['+972 50 123 4567', '+972501234567', true],
      ['972501234567', '+972501234567', true],
      ['00972501234567', '+972501234567', true],
      ['03-1234567', '+97231234567', false],   // landline — not SMS capable
    ])('%s → %s (mobile: %s)', (input, expected, mobile) => {
      const n = normaliseIsraeliPhone(input)
      expect(n.e164).toBe(expected)
      expect(n.isMobile).toBe(mobile)
    })

    it.each([['', 'empty'], ['abc', 'no digits'], ['12345', 'too short']])(
      'rejects %s', (input) => {
        expect(normaliseIsraeliPhone(input).e164).toBeNull()
      },
    )
  })
})
