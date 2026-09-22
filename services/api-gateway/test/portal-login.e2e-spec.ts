/**
 * Resident portal sign-in — Portal stage 1.
 *
 * ── WHAT THIS SUITE IS FOR ──────────────────────────────────────────────────
 *
 * The old resident login was `findFirst({ where: { phone } })`: it treated
 * "controls this handset" as "is entitled to this file" and issued a session
 * carrying whichever tenant the query planner reached first. The replacement
 * separates the two questions — an OTP proves the handset, and an invitation,
 * a tenant context or an explicit choice decides whose file opens.
 *
 * Every test here holds one of the properties that separation buys. They are
 * written as attacks wherever an attack is what the property defends against,
 * because a login that has only been exercised the happy way has not been
 * exercised.
 *
 * NO PASSWORDS ARE USED. Staff tokens are minted through `JwtService` against
 * users this suite creates, exactly as communication-templates.e2e-spec.ts does.
 * OTP codes are planted directly in Redis using the PRODUCTION `hashOtp`, so the
 * suite never depends on an SMS arriving and never re-implements the hashing it
 * is meant to be checking.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { hashOtp } from '../src/common/otp/otp'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const MARKER = `PORTAL-${Date.now().toString(36)}`
const SLUG_A = `portal-${Date.now().toString(36)}-a`
const SLUG_B = `portal-${Date.now().toString(36)}-b`

/** Distinct from every seeded number, so a stray match cannot make a test pass. */
const PHONE_SHARED = '0509900001'   // two resident records, one handset
const PHONE_SOLO   = '0509900002'   // exactly one record
const PHONE_OTHER  = '0509900003'   // tenant B
const PHONE_ATTACK = '0509900009'   // never belongs to anyone

const CODE = '424242'

describe('Resident portal login (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let redis: {
    get: (k: string) => Promise<string | null>
    setex: (k: string, ttl: number, v: string) => Promise<unknown>
    del: (...k: string[]) => Promise<number>
    exists: (k: string) => Promise<number>
  }

  /** Tenant A — the staff actor's own tenant. */
  let tenantA: string
  let projectA: string
  let residentShared1: string   // apartment 1, PHONE_SHARED
  let residentShared2: string   // apartment 2, PHONE_SHARED — the ambiguity
  let residentSolo: string      // PHONE_SOLO

  /** Tenant B — everything here must stay unreachable from tenant A. */
  let tenantB: string
  let residentOther: string

  let managerToken: string          // RESIDENT_RELATIONS_MANAGER in tenant A
  let lawyerToken: string           // in tenant A, but not allowed to issue links
  let tenantBManagerToken: string

  const api = () => request(app.getHttpServer())
  const asManager = () => ({ Authorization: `Bearer ${managerToken}` })

  const staffToken = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const claimsOf = (accessToken: string) =>
    jwt.verify(accessToken, { secret: process.env.JWT_SECRET as string }) as Record<string, unknown>

  /** Plants a known-good code so verification can be exercised deterministically. */
  const plantOtp = async (phone: string, code = CODE) => {
    await redis.del(`otp:attempts:${phone}`)
    await redis.setex(`otp:${phone}`, 300, hashOtp(code))
  }

  const issueInvitation = async (
    residentId: string,
    headers: Record<string, string> = asManager(),
    body: Record<string, unknown> = {},
  ) => api().post('/api/v1/auth/portal/invitations').set(headers).send({ residentId, ...body })

  /**
   * One project per tenant, with a building and an apartment per call.
   *
   * A tenant whose every apartment sat in its own project would make the
   * project scope trivially equal to the tenant scope, and a test that cannot
   * tell the two apart proves nothing about either. Here tenant A is one real
   * project holding several homes — which is also what the two-records-one-phone
   * case looks like in the field: a spouse on two apartments in one project.
   */
  const projectOf: Record<string, { projectId: string; complexId: string }> = {}

  const makeProject = async (tenantId: string, label: string) => {
    const project = await prisma.project.create({
      data: { tenantId, code: `${MARKER}-${label}`, name: `${MARKER} ${label}`, city: 'תל אביב' },
    })
    const complex = await prisma.complex.create({ data: { projectId: project.id, name: `${MARKER} ${label}` } })
    projectOf[tenantId] = { projectId: project.id, complexId: complex.id }
    return project.id
  }

  const makeApartment = async (tenantId: string, label: string) => {
    const { projectId, complexId } = projectOf[tenantId]!
    const building = await prisma.building.create({
      data: { complexId, address: `רחוב הבדיקה ${label}` },
    })
    const apartment = await prisma.apartment.create({
      data: { buildingId: building.id, apartmentNumber: label },
    })
    return { projectId, buildingId: building.id, apartmentId: apartment.id }
  }

  const purge = async () => {
    const stale = await prisma.tenant.findMany({
      where: { slug: { startsWith: 'portal-' } }, select: { id: true },
    })
    for (const t of stale) {
      await prisma.residentInvitation.deleteMany({ where: { tenantId: t.id } })
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } }).catch(() => undefined)
    }
  }

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      /*
       * The per-IP login throttle is 2 sends and 3 verifies per 10 seconds —
       * deliberately tight, and far below what this suite fires. Its counter is
       * neutralised here so 429s do not stand in for the 401s being asserted.
       *
       * Nothing else is softened. The per-PHONE budget lives in Redis inside
       * the service and is untouched by this override — it is asserted for real
       * below — and the per-IP throttle itself is asserted against a second
       * application that keeps the real storage.
       */
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({ totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }),
      })
      .compile()

    app = mod.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    // Mirrors main.ts. `forbidNonWhitelisted` is what turns an unexpected body
    // field into a 400 instead of a silently ignored one — see the forged
    // tenantId test.
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService)
    jwt = app.get(JwtService, { strict: false })
    redis = app.get('REDIS')

    await purge()

    tenantA = (await prisma.tenant.create({ data: { name: SLUG_A, slug: SLUG_A } })).id
    tenantB = (await prisma.tenant.create({ data: { name: SLUG_B, slug: SLUG_B } })).id

    // Tenant A: one project, three apartments; two reachable from PHONE_SHARED.
    projectA = await makeProject(tenantA, 'A')
    const flat1 = await makeApartment(tenantA, '1')
    const flat2 = await makeApartment(tenantA, '2')
    const flat3 = await makeApartment(tenantA, '3')

    residentShared1 = (await prisma.resident.create({
      data: {
        tenantId: tenantA, apartmentId: flat1.apartmentId,
        firstName: 'שרה', lastName: 'כהן', phone: PHONE_SHARED, isActive: true,
      },
    })).id
    residentShared2 = (await prisma.resident.create({
      data: {
        tenantId: tenantA, apartmentId: flat2.apartmentId,
        firstName: 'שרה', lastName: 'כהן', phone: PHONE_SHARED, isActive: true,
      },
    })).id
    residentSolo = (await prisma.resident.create({
      data: {
        tenantId: tenantA, apartmentId: flat3.apartmentId,
        firstName: 'דוד', lastName: 'לוי', phone: PHONE_SOLO, isActive: true,
      },
    })).id

    // Tenant B — a separate world.
    await makeProject(tenantB, 'B')
    const flatB = await makeApartment(tenantB, 'B1')
    residentOther = (await prisma.resident.create({
      data: {
        tenantId: tenantB, apartmentId: flatB.apartmentId,
        firstName: 'רות', lastName: 'מזרחי', phone: PHONE_OTHER, isActive: true,
      },
    })).id

    const mkUser = async (tenantId: string, role: string) => (await prisma.user.create({
      data: {
        tenantId,
        email: `${MARKER}-${role}-${randomUUID().slice(0, 6)}@example.com`.toLowerCase(),
        firstName: 'E2E', lastName: role, passwordHash: 'not-a-usable-credential', role: role as never,
      },
      select: { id: true },
    })).id

    managerToken = staffToken(
      await mkUser(tenantA, 'RESIDENT_RELATIONS_MANAGER'), tenantA, 'RESIDENT_RELATIONS_MANAGER',
    )
    lawyerToken = staffToken(await mkUser(tenantA, 'LAWYER'), tenantA, 'LAWYER')
    tenantBManagerToken = staffToken(await mkUser(tenantB, 'COMPANY_ADMIN'), tenantB, 'COMPANY_ADMIN')
  }, 120_000)

  afterAll(async () => {
    for (const phone of [PHONE_SHARED, PHONE_SOLO, PHONE_OTHER, PHONE_ATTACK]) {
      await redis?.del(`otp:${phone}`, `otp:attempts:${phone}`, `otp:rate:${phone}`)
    }
    await purge()
    await app?.close()
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  1. Issuing a link is an access-granting act
  // ══════════════════════════════════════════════════════════════════════════

  describe('issuing an invitation', () => {
    it('returns the raw token exactly once, and stores only its hash', async () => {
      const res = await issueInvitation(residentSolo)
      expect(res.status).toBe(201)
      expect(typeof res.body.token).toBe('string')
      expect(res.body.token.length).toBeGreaterThan(30)
      expect(res.body.resident.id).toBe(residentSolo)

      const row = await prisma.residentInvitation.findUniqueOrThrow({
        where: { id: res.body.invitationId },
        select: { tokenHash: true, tenantId: true, projectId: true, phone: true, usedAt: true },
      })
      // The column holds a digest, never the credential. Anyone with read
      // access to the table still cannot sign in as this resident.
      expect(row.tokenHash).not.toBe(res.body.token)
      expect(row.tokenHash).toBe(hashOtp(res.body.token))
      expect(row.usedAt).toBeNull()
      // Scope was derived server-side, not supplied by the caller.
      expect(row.tenantId).toBe(tenantA)
      expect(row.projectId).toBe(projectA)
      expect(row.phone).toBe(PHONE_SOLO)
    })

    it('REFUSES to issue for a resident in another tenant', async () => {
      // The attack is by id, not by listing: the caller already knows the id
      // and is asking the API to mint a credential into a tenant they cannot
      // otherwise reach.
      const res = await issueInvitation(residentOther)
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('CROSS_TENANT_DENIED')

      expect(await prisma.residentInvitation.count({ where: { residentId: residentOther } })).toBe(0)
    })

    it('REFUSES a staff role that does not administer resident access', async () => {
      const res = await issueInvitation(residentSolo, { Authorization: `Bearer ${lawyerToken}` })
      expect(res.status).toBe(403)
    })

    it('REFUSES an anonymous caller', async () => {
      const res = await api().post('/api/v1/auth/portal/invitations').send({ residentId: residentSolo })
      expect(res.status).toBe(401)
    })

    it('rejects a caller-supplied tenantId rather than honouring it', async () => {
      // `forbidNonWhitelisted` is the mechanism. Without it this field would be
      // silently stripped — safe today, and one refactor from not being.
      const res = await api().post('/api/v1/auth/portal/invitations').set(asManager())
        .send({ residentId: residentSolo, tenantId: tenantB })
      expect(res.status).toBe(400)
    })

    it('a new link supersedes the outstanding one for that resident', async () => {
      const first = await issueInvitation(residentSolo)
      const second = await issueInvitation(residentSolo)
      expect(second.status).toBe(201)

      // The predecessor is a live bearer token sitting in somebody's SMS
      // history until it expires. Re-sending must kill it.
      const old = await prisma.residentInvitation.findUniqueOrThrow({
        where: { id: first.body.invitationId },
        select: { revokedAt: true, revokedReason: true },
      })
      expect(old.revokedAt).not.toBeNull()
      expect(old.revokedReason).toBe('SUPERSEDED_BY_NEW_INVITATION')

      await api().get(`/api/v1/auth/portal/invitation/${first.body.token}`).expect(401)
      await api().get(`/api/v1/auth/portal/invitation/${second.body.token}`).expect(200)
    })

    it('REFUSES to issue for an archived resident', async () => {
      await prisma.resident.update({ where: { id: residentSolo }, data: { isActive: false } })
      const res = await issueInvitation(residentSolo)
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('RESIDENT_INACTIVE')
      await prisma.resident.update({ where: { id: residentSolo }, data: { isActive: true } })
    })

    it('revoking is scoped to the actor tenant', async () => {
      const mine = await issueInvitation(residentSolo)
      const res = await api().delete(`/api/v1/auth/portal/invitations/${mine.body.invitationId}`)
        .set({ Authorization: `Bearer ${tenantBManagerToken}` }).send({ reason: 'nice try' })
      expect(res.status).toBe(404)

      const row = await prisma.residentInvitation.findUniqueOrThrow({
        where: { id: mine.body.invitationId }, select: { revokedAt: true },
      })
      expect(row.revokedAt).toBeNull()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  2. The preview must not become an oracle
  // ══════════════════════════════════════════════════════════════════════════

  describe('previewing an invitation', () => {
    it('shows the home, and a MASKED phone', async () => {
      const issued = await issueInvitation(residentSolo)
      const res = await api().get(`/api/v1/auth/portal/invitation/${issued.body.token}`).expect(200)

      expect(res.body.apartmentNumber).toBe('3')
      expect(res.body.maskedPhone).toBe('050-****002')
      // The link may be open on a device that is not the resident's.
      const body = JSON.stringify(res.body)
      expect(body).not.toContain(PHONE_SOLO)
      expect(body).not.toContain(residentSolo)
      expect(body).not.toContain(tenantA)
    })

    it('answers a revoked, a used, an expired and a never-existed token identically', async () => {
      const messages = new Set<string>()

      const revoked = await issueInvitation(residentSolo)
      await api().delete(`/api/v1/auth/portal/invitations/${revoked.body.invitationId}`)
        .set(asManager()).send({ reason: 'test' }).expect(204)

      const used = await issueInvitation(residentSolo)
      await prisma.residentInvitation.update({
        where: { id: used.body.invitationId }, data: { usedAt: new Date() },
      })

      const expired = await issueInvitation(residentSolo)
      await prisma.residentInvitation.update({
        where: { id: expired.body.invitationId }, data: { expiresAt: new Date(Date.now() - 1000) },
      })

      for (const token of [revoked.body.token, used.body.token, expired.body.token, 'x'.repeat(43)]) {
        const res = await api().get(`/api/v1/auth/portal/invitation/${token}`)
        expect(res.status).toBe(401)
        messages.add(JSON.stringify(res.body.message ?? res.body))
      }

      // Four different internal reasons, one external answer. Telling the
      // caller which is what turns a link checker into a token oracle.
      expect(messages.size).toBe(1)
    })

    it('refuses a token that no longer matches where the resident lives', async () => {
      const issued = await issueInvitation(residentSolo)
      await api().get(`/api/v1/auth/portal/invitation/${issued.body.token}`).expect(200)

      // The resident moves. The invitation still names the OLD apartment, so it
      // no longer describes reality — and a credential grants what it says or
      // it grants nothing.
      const original = await prisma.resident.findUniqueOrThrow({
        where: { id: residentSolo }, select: { apartmentId: true },
      })
      // Deliberately still inside the SAME project: the invitation names a
      // building and an apartment too, so a move across the corridor is enough
      // to make it stop describing reality.
      const elsewhere = await makeApartment(tenantA, '9')
      await prisma.resident.update({
        where: { id: residentSolo }, data: { apartmentId: elsewhere.apartmentId },
      })

      await api().get(`/api/v1/auth/portal/invitation/${issued.body.token}`).expect(401)

      await prisma.resident.update({
        where: { id: residentSolo }, data: { apartmentId: original.apartmentId },
      })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  3. A leaked link is not a login
  // ══════════════════════════════════════════════════════════════════════════

  describe('redeeming an invitation', () => {
    it('opens a session scoped to tenant, project and resident', async () => {
      const issued = await issueInvitation(residentSolo)
      await plantOtp(PHONE_SOLO)

      const res = await api().post('/api/v1/auth/otp/verify')
        .send({ phone: PHONE_SOLO, code: CODE, invitationToken: issued.body.token })
      expect(res.status).toBe(200)

      const claims = claimsOf(res.body.accessToken)
      expect(claims.role).toBe('RESIDENT')
      expect(claims.residentId).toBe(residentSolo)
      expect(claims.tenantId).toBe(tenantA)
      expect(claims.projectId).toBe(projectA)
      // Everything a later request may be scoped by is fixed HERE.
      expect(claims.sessionId).toEqual(expect.any(String))
    })

    it('is single use', async () => {
      const issued = await issueInvitation(residentSolo)
      await plantOtp(PHONE_SOLO)
      await api().post('/api/v1/auth/otp/verify')
        .send({ phone: PHONE_SOLO, code: CODE, invitationToken: issued.body.token }).expect(200)

      await plantOtp(PHONE_SOLO)
      const again = await api().post('/api/v1/auth/otp/verify')
        .send({ phone: PHONE_SOLO, code: CODE, invitationToken: issued.body.token })
      expect(again.status).toBe(401)
      expect(JSON.stringify(again.body)).not.toContain('accessToken')
    })

    it('CANNOT be redeemed from a different handset', async () => {
      // The whole point of requiring an OTP on top of the link: a forwarded
      // message, a shared inbox or a screenshot is not enough.
      const issued = await issueInvitation(residentSolo)
      await plantOtp(PHONE_ATTACK)

      const res = await api().post('/api/v1/auth/otp/verify')
        .send({ phone: PHONE_ATTACK, code: CODE, invitationToken: issued.body.token })
      expect(res.status).toBe(401)
      expect(JSON.stringify(res.body)).not.toContain('accessToken')

      const row = await prisma.residentInvitation.findUniqueOrThrow({
        where: { id: issued.body.invitationId }, select: { usedAt: true },
      })
      expect(row.usedAt).toBeNull()   // a failed attack does not burn the link
    })

    it('sends the code to the number the INVITATION names, not the one typed', async () => {
      const issued = await issueInvitation(residentSolo)
      await redis.del(`otp:${PHONE_ATTACK}`, `otp:rate:${PHONE_ATTACK}`)

      const res = await api().post('/api/v1/auth/otp/send')
        .send({ phone: PHONE_ATTACK, invitationToken: issued.body.token })

      // Answered like a success so the response cannot be used to discover the
      // invited number — but no code exists for the attacker's handset.
      expect(res.status).toBe(200)
      expect(await redis.get(`otp:${PHONE_ATTACK}`)).toBeNull()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  4. When one phone matches several files, a human chooses
  // ══════════════════════════════════════════════════════════════════════════

  describe('the selection challenge', () => {
    const beginSelection = async () => {
      await plantOtp(PHONE_SHARED)
      const res = await api().post('/api/v1/auth/otp/verify').send({ phone: PHONE_SHARED, code: CODE })
      expect(res.status).toBe(200)
      expect(res.body.selectionRequired).toBe(true)
      return res.body as { selectionToken: string; options: { residentId: string }[] }
    }

    it('issues no session, and offers both homes', async () => {
      const challenge = await beginSelection()
      expect(JSON.stringify(challenge)).not.toContain('accessToken')
      expect(challenge.options.map((o) => o.residentId).sort())
        .toEqual([residentShared1, residentShared2].sort())
    })

    it('completing it with an offered id opens exactly that file', async () => {
      const challenge = await beginSelection()
      const res = await api().post('/api/v1/auth/portal/select')
        .send({ selectionToken: challenge.selectionToken, residentId: residentShared2 })
      expect(res.status).toBe(200)

      const claims = claimsOf(res.body.accessToken)
      expect(claims.residentId).toBe(residentShared2)
      expect(claims.tenantId).toBe(tenantA)
    })

    it('REFUSES an id that was never offered', async () => {
      // Without this check the selection token is a licence to open ANY
      // resident file by id — a worse hole than the one this flow replaces.
      const challenge = await beginSelection()
      const res = await api().post('/api/v1/auth/portal/select')
        .send({ selectionToken: challenge.selectionToken, residentId: residentOther })
      expect(res.status).toBe(401)
      expect(JSON.stringify(res.body)).not.toContain('accessToken')
    })

    it('is single use', async () => {
      const challenge = await beginSelection()
      await api().post('/api/v1/auth/portal/select')
        .send({ selectionToken: challenge.selectionToken, residentId: residentShared1 }).expect(200)

      const again = await api().post('/api/v1/auth/portal/select')
        .send({ selectionToken: challenge.selectionToken, residentId: residentShared1 })
      expect(again.status).toBe(401)
    })

    it('rejects a fabricated selection token', async () => {
      const res = await api().post('/api/v1/auth/portal/select')
        .send({ selectionToken: 'z'.repeat(43), residentId: residentShared1 })
      expect(res.status).toBe(401)
    })

    it('re-reads the file at completion rather than trusting the offer', async () => {
      // Five minutes can pass between the list and the choice. If the resident
      // is archived in between, the stale list must not still open the file.
      const challenge = await beginSelection()
      await prisma.resident.update({ where: { id: residentShared1 }, data: { isActive: false } })

      const res = await api().post('/api/v1/auth/portal/select')
        .send({ selectionToken: challenge.selectionToken, residentId: residentShared1 })
      expect(res.status).toBe(401)

      await prisma.resident.update({ where: { id: residentShared1 }, data: { isActive: true } })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  5. What the session may be scoped by
  // ══════════════════════════════════════════════════════════════════════════

  describe('the session itself', () => {
    const openSession = async () => {
      await plantOtp(PHONE_SOLO)
      const res = await api().post('/api/v1/auth/otp/verify').send({ phone: PHONE_SOLO, code: CODE })
      expect(res.status).toBe(200)
      return res.body as { accessToken: string; refreshToken: string }
    }

    it('a RESIDENT token missing its project scope is rejected', async () => {
      /*
       * This is the shape every resident token minted before this stage has,
       * and some are still inside their 30-day refresh window. A portal
       * endpoint scoping by `undefined` does not return nothing — an absent
       * condition widens the query to the whole tenant. So the claim is
       * required, not defaulted.
       */
      const legacy = jwt.sign(
        { sub: residentSolo, role: 'RESIDENT', tenantId: tenantA, sessionId: randomUUID() },
        { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
      )
      const res = await api().get('/api/v1/auth/me').set({ Authorization: `Bearer ${legacy}` })
      expect(res.status).toBe(401)
    })

    it('a full resident token is accepted and carries its scope', async () => {
      const session = await openSession()
      const res = await api().get('/api/v1/auth/me')
        .set({ Authorization: `Bearer ${session.accessToken}` }).expect(200)
      expect(res.body.role).toBe('RESIDENT')
      expect(res.body.residentId).toBe(residentSolo)
      expect(res.body.projectId).toBe(projectA)
      expect(res.body.tenantId).toBe(tenantA)
    })

    it('a resident token opens no CRM route', async () => {
      const session = await openSession()
      const res = await api().get('/api/v1/residents')
        .set({ Authorization: `Bearer ${session.accessToken}` })
      expect([401, 403]).toContain(res.status)
    })

    it('refreshing re-derives the scope instead of copying it forward', async () => {
      const session = await openSession()
      const res = await api().post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken })
      expect(res.status).toBe(200)

      const claims = claimsOf(res.body.accessToken)
      expect(claims.residentId).toBe(residentSolo)
      expect(claims.projectId).toBe(projectA)
      expect(claims.tenantId).toBe(tenantA)
    })

    it('a refresh token stops working once the resident is archived', async () => {
      const session = await openSession()
      await prisma.resident.update({ where: { id: residentSolo }, data: { isActive: false } })

      const res = await api().post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken })
      expect(res.status).toBe(401)

      await prisma.resident.update({ where: { id: residentSolo }, data: { isActive: true } })
    })

    it('logout revokes the session, and the refresh token cannot resurrect it', async () => {
      const session = await openSession()
      await api().post('/api/v1/auth/logout')
        .set({ Authorization: `Bearer ${session.accessToken}` }).expect(204)

      await api().get('/api/v1/auth/me')
        .set({ Authorization: `Bearer ${session.accessToken}` }).expect(401)
      const refreshed = await api().post('/api/v1/auth/refresh').send({ refreshToken: session.refreshToken })
      expect(refreshed.status).toBe(401)
    })

    it('a phone with no resident record gets no session', async () => {
      await plantOtp(PHONE_ATTACK)
      const res = await api().post('/api/v1/auth/otp/verify').send({ phone: PHONE_ATTACK, code: CODE })
      expect(res.status).toBe(401)
      expect(JSON.stringify(res.body)).not.toContain('accessToken')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  6. Rate limiting — the layer that does not depend on the caller's IP
  // ══════════════════════════════════════════════════════════════════════════

  describe('rate limiting', () => {
    it('caps sends per PHONE, regardless of source', async () => {
      // Redis-backed, and therefore durable across restarts and independent of
      // the per-IP throttle: rotating IPs does not buy more codes.
      await redis.del(`otp:rate:${PHONE_SOLO}`)
      for (let i = 0; i < 3; i++) {
        await api().post('/api/v1/auth/otp/send').send({ phone: PHONE_SOLO }).expect(200)
      }
      const fourth = await api().post('/api/v1/auth/otp/send').send({ phone: PHONE_SOLO })
      expect(fourth.status).toBe(400)
      expect(fourth.body.code).toBe('OTP_RATE_LIMITED')
      await redis.del(`otp:rate:${PHONE_SOLO}`)
    })

    it('destroys the code after five wrong guesses', async () => {
      await plantOtp(PHONE_SOLO)
      for (let i = 0; i < 4; i++) {
        await api().post('/api/v1/auth/otp/verify').send({ phone: PHONE_SOLO, code: '000000' }).expect(401)
      }
      expect(await redis.exists(`otp:${PHONE_SOLO}`)).toBe(1)   // still alive

      const fifth = await api().post('/api/v1/auth/otp/verify').send({ phone: PHONE_SOLO, code: '000000' })
      expect(fifth.status).toBe(401)
      expect(fifth.body.code).toBe('OTP_ATTEMPTS_EXCEEDED')
      // Destroyed — so the correct code no longer works either.
      expect(await redis.exists(`otp:${PHONE_SOLO}`)).toBe(0)
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  The per-IP throttle, against an application that keeps the REAL storage
// ════════════════════════════════════════════════════════════════════════════

describe('Resident portal login — per-IP rate limit (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    // No ThrottlerStorage override here. This suite exists precisely to prove
    // the limits the other one has to switch off in order to run at all.
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = mod.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  }, 120_000)

  afterAll(async () => { await app?.close() })

  it('throttles OTP sends from one source', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/send').send({ phone: '0509911111' })
      statuses.push(res.status)
    }
    // The global default is 20/second, which is an invitation to enumerate
    // numbers. This route is 2 per 10 seconds.
    expect(statuses).toContain(429)
  })

  it('throttles invitation-token guessing hardest of all', async () => {
    // The one route where the secret is guessable without a handset, so the
    // one route where the limit has to be tightest.
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/auth/portal/invitation/${'q'.repeat(43)}`)
      statuses.push(res.status)
    }
    expect(statuses).toContain(429)
  })
})
