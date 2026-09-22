/**
 * Rate limits on every path that authenticates somebody — Portal stage 5.
 *
 * ── WHY THIS SUITE KEEPS THE REAL THROTTLER ─────────────────────────────────
 *
 * Every other suite in this repository replaces `ThrottlerStorage` with a
 * counter that never accumulates, because 429s would stand in for the statuses
 * those suites actually assert. This one is the opposite: the limits ARE the
 * subject, so the real storage stays and the fixtures work around it.
 *
 * Each limit is checked twice — that it refuses at the right point, and that a
 * legitimate single use still passes. A limit that also blocks the honest case
 * is not a fix, it is an outage with good intentions.
 *
 * ── WHAT PROMPTED IT ────────────────────────────────────────────────────────
 *
 * A stage 5 sweep against the running gateway found four authenticating paths
 * with no route limit at all: `/auth/login`, `/auth/refresh`, and the signing
 * portal's `otp` and `verify`. Twelve wrong passwords in a row drew twelve 401s
 * and no 429 — three hundred password guesses a minute against COMPANY_ADMIN.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerStorage } from '@nestjs/throttler'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const SLUG = `rl-${STAMP}`

describe('Rate limits on authenticating paths (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let tenantId: string
  let projectId: string
  let residentId: string
  let throttler: { storage: Map<string, unknown> }

  const api = () => request(app.getHttpServer())

  /**
   * Fires until a 429 appears or the budget runs out.
   *
   * Returns every status seen, so a failure message says what actually happened
   * rather than just "expected true".
   */
  const hammer = async (
    fire: () => request.Test,
    times = 25,
  ): Promise<number[]> => {
    const seen: number[] = []
    for (let i = 0; i < times; i++) {
      const res = await fire()
      seen.push(res.status)
      if (res.status === 429) break
    }
    return seen
  }

  const purge = async () => {
    const stale = await prisma.tenant.findMany({
      where: { slug: { startsWith: 'rl-' } }, select: { id: true },
    })
    for (const t of stale) {
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } }).catch(() => undefined)
    }
  }

  beforeAll(async () => {
    // No ThrottlerStorage override — see the header.
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = mod.createNestApplication()
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
    jwt = app.get(JwtService, { strict: false })
    throttler = app.get(ThrottlerStorage) as unknown as { storage: Map<string, unknown> }

    await purge()
    const tenant = await prisma.tenant.create({ data: { name: SLUG, slug: SLUG } })
    tenantId = tenant.id
    const project = await prisma.project.create({
      data: { tenantId, code: SLUG, name: SLUG, city: 'תל אביב' },
    })
    projectId = project.id
    const complex = await prisma.complex.create({ data: { projectId, name: SLUG } })
    const building = await prisma.building.create({
      data: { complexId: complex.id, address: `${SLUG} street` },
    })
    const apartment = await prisma.apartment.create({
      data: { buildingId: building.id, apartmentNumber: '1' },
    })
    residentId = (await prisma.resident.create({
      data: {
        tenantId, apartmentId: apartment.id, firstName: 'RL', lastName: 'Resident',
        phone: '0509977001', isActive: true,
      },
      select: { id: true },
    })).id
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  /*
   * Every test starts from a clean limiter.
   *
   * The counter is per-IP and every test here comes from the same address, so
   * without this a test asserting "a legitimate login still works" would run
   * against a budget the previous test had just deliberately exhausted — and
   * fail for a reason that has nothing to do with what it is checking.
   *
   * Clearing the storage is not the same as switching the throttler off. Each
   * test still exercises the real guard, the real limits and the real counting;
   * it just does not inherit the last one's spend.
   */
  beforeEach(() => {
    throttler.storage.clear()
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  FIX 2 — staff login
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /auth/login', () => {
    it('stops a password guessing run', async () => {
      const seen = await hammer(() =>
        api().post('/api/v1/auth/login')
          .send({ email: `guess-${STAMP}@example.com`, password: 'wrong' }),
      )
      expect(seen).toContain(429)
      // Before the fix this ran to 25 without a single 429.
      expect(seen.indexOf(429)).toBeLessThan(10)
    })

    it('does not stand in the way of somebody typing their own password', async () => {
      // A person mistypes once and gets it right on the second go. Both must
      // pass — a limit that blocks the honest case is an outage.
      const bad = await api().post('/api/v1/auth/login')
        .send({ email: 'admin@opendoor.co.il', password: 'definitely-wrong' })
      expect(bad.status).toBe(401)

      const good = await api().post('/api/v1/auth/login')
        .send({ email: 'admin@opendoor.co.il', password: 'demo1234' })
      expect(good.status).toBe(200)
      expect(typeof good.body.accessToken).toBe('string')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  FIX 3 — refresh
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /auth/refresh', () => {
    it('is capped, though guessing a signed token was never the risk', async () => {
      const seen = await hammer(() =>
        api().post('/api/v1/auth/refresh').send({ refreshToken: 'not-a-real-token' }),
        30,
      )
      expect(seen).toContain(429)
    })

    it('a real refresh still works', async () => {
      // Set higher than login on purpose: a client refreshes on a timer and
      // several tabs may do it at once.
      const login = await api().post('/api/v1/auth/login')
        .send({ email: 'admin@opendoor.co.il', password: 'demo1234' })
      expect(login.status).toBe(200)

      const refreshed = await api().post('/api/v1/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
      expect(refreshed.status).toBe(200)
      expect(typeof refreshed.body.accessToken).toBe('string')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  FIX 4+5 — the signing portal's public token routes
  // ══════════════════════════════════════════════════════════════════════════

  describe('signing portal token routes', () => {
    it('caps the route that SENDS AN SMS', async () => {
      /*
       * The per-session caps already bound one link to five resends an hour.
       * This is about the route: without it, the global 300-a-minute default
       * was all that stood between somebody holding a handful of valid links
       * and a stream of real messages to real people.
       */
      const seen = await hammer(() =>
        api().post(`/api/v1/signatures/portal/${'a'.repeat(64)}/otp`).send({}),
      )
      expect(seen).toContain(429)
      expect(seen.indexOf(429)).toBeLessThan(8)
    })

    it('caps the OTP verification route', async () => {
      const seen = await hammer(() =>
        api().post(`/api/v1/signatures/portal/${'b'.repeat(64)}/verify`)
          .send({ code: '000000' }),
      )
      expect(seen).toContain(429)
    })

    it('caps opening a signing link', async () => {
      const seen = await hammer(() =>
        api().get(`/api/v1/signatures/portal/${'c'.repeat(64)}`),
      )
      expect(seen).toContain(429)
    })

    it('caps sign and decline', async () => {
      const signSeen = await hammer(() =>
        api().post(`/api/v1/signatures/portal/${'d'.repeat(64)}/sign`).send({}),
      )
      expect(signSeen).toContain(429)

      const declineSeen = await hammer(() =>
        api().post(`/api/v1/signatures/portal/${'e'.repeat(64)}/decline`)
          .send({ reason: 'no' }),
      )
      expect(declineSeen).toContain(429)
    })

    it('is in the same range as the meeting invitation routes it sits beside', async () => {
      // The gap was an accident of history, not a decision: two public token
      // flows of the same shape, one throttled since it was written and one
      // never. This asserts they now behave alike.
      const invite = await hammer(() =>
        api().get(`/api/v1/meeting-invitations/${'f'.repeat(64)}`),
      )
      const signing = await hammer(() =>
        api().get(`/api/v1/signatures/portal/${'g'.repeat(64)}`),
      )
      expect(invite).toContain(429)
      expect(signing).toContain(429)
      expect(Math.abs(invite.indexOf(429) - signing.indexOf(429))).toBeLessThanOrEqual(3)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  FIX 1 — the two identity claims must agree
  // ══════════════════════════════════════════════════════════════════════════

  describe('resident token identity consistency', () => {
    const token = (claims: Record<string, unknown>) =>
      jwt.sign(claims, { secret: process.env.JWT_SECRET as string, expiresIn: '10m' })

    it('REFUSES a resident token whose sub and residentId disagree', async () => {
      /*
       * Found by probing the running gateway: this was accepted, and answered
       * with the `residentId` resident's dashboard while every log line would
       * have named the `sub` one. Not an escalation — anyone minting tokens can
       * name anybody — but a divergence with no reason to exist, and the kind
       * that makes an audit trail confidently wrong.
       */
      const mismatched = token({
        sub: 'somebody-else', role: 'RESIDENT',
        tenantId, projectId, residentId, sessionId: randomUUID(),
      })
      const res = await api().get('/api/v1/portal/dashboard')
        .set({ Authorization: `Bearer ${mismatched}` })
      expect(res.status).toBe(401)
    })

    it('accepts one where they agree', async () => {
      const consistent = token({
        sub: residentId, role: 'RESIDENT',
        tenantId, projectId, residentId, sessionId: randomUUID(),
      })
      const res = await api().get('/api/v1/portal/dashboard')
        .set({ Authorization: `Bearer ${consistent}` })
      expect(res.status).toBe(200)
    })

    it('leaves staff tokens alone — they have no residentId to agree with', async () => {
      const staffUser = await prisma.user.findFirstOrThrow({
        where: { email: 'admin@opendoor.co.il' },
        select: { id: true, tenantId: true, role: true },
      })
      const staff = token({
        sub: staffUser.id, email: 'admin@opendoor.co.il', role: staffUser.role,
        tenantId: staffUser.tenantId, sessionId: randomUUID(),
      })
      const res = await api().get('/api/v1/auth/me').set({ Authorization: `Bearer ${staff}` })
      expect(res.status).toBe(200)
    })
  })
})
