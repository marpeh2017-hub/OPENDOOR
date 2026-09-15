/**
 * Resident portal AI assistant — POST /api/v1/portal/chat.
 *
 * ── WHAT IS BEING PROVED ────────────────────────────────────────────────────
 *
 * The endpoint builds its system prompt from the database, scoped by the same
 * `PortalScope` every other portal route uses. The one way that scoping could
 * fail here and nowhere else is if the PROMPT ITSELF leaked another tenant's
 * facts into a resident's conversation — a failure mode invisible to a test
 * that only checks the HTTP response, since the leak would sit inside the
 * `system` string sent to Claude, not in anything returned to the caller. So
 * this suite intercepts what the mocked client was actually called with, not
 * just what the endpoint answered.
 *
 * `@anthropic-ai/sdk` is mocked at the top of the file — this suite never
 * makes a real network call, and never needs a real API key to run.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
process.env.ANTHROPIC_API_KEY = 'test-key-not-a-real-credential'

/** Captures every call's `system` prompt so a test can inspect it directly. */
const createMock = jest.fn()

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: createMock },
    })),
  }
})

// Imported AFTER the mock is registered, so PortalChatService picks up the
// mocked constructor rather than the real SDK.
// eslint-disable-next-line import/first
import { AppModule } from '../src/app.module'
// eslint-disable-next-line import/first
import { PrismaService } from '../src/prisma.service'

const STAMP = Date.now().toString(36)
const MARKER = `CHAT-${STAMP}`
const SLUG_A = `chat-${STAMP}-a`
const SLUG_B = `chat-${STAMP}-b`
const B_SECRET = `BTENANT${STAMP}`

const BASE = '/api/v1/portal/chat'

interface Fixture {
  tenantId: string
  projectId: string
  apartmentId: string
  residentId: string
  managerId: string
}

describe('Resident portal AI assistant (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let A: Fixture
  let B: Fixture
  let residentAToken: string

  const api = () => request(app.getHttpServer())
  const asResidentA = () => ({ Authorization: `Bearer ${residentAToken}` })

  const residentToken = (claims: { residentId: string; tenantId: string; projectId?: string }) =>
    jwt.sign(
      {
        sub: claims.residentId,
        role: 'RESIDENT',
        tenantId: claims.tenantId,
        ...(claims.projectId ? { projectId: claims.projectId } : {}),
        residentId: claims.residentId,
        sessionId: randomUUID(),
      },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const makeTenant = async (slug: string, label: string, mark: string): Promise<Fixture> => {
    const tenant = await prisma.tenant.create({ data: { name: slug, slug } })

    const manager = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `${mark}-pm-${randomUUID().slice(0, 6)}@example.com`.toLowerCase(),
        firstName: `${mark}Manager`, lastName: 'Cohen',
        phone: '0501112233',
        passwordHash: 'not-a-usable-credential', role: 'PROJECT_MANAGER' as never,
      },
      select: { id: true },
    })

    const project = await prisma.project.create({
      data: {
        tenantId: tenant.id, code: `${MARKER}-${label}`, name: `${mark} Project`,
        city: 'תל אביב', stage: 'PLANNING', status: 'ACTIVE',
        projectManagerId: manager.id, totalUnits: 40, signedUnits: 25,
      },
    })
    const complex = await prisma.complex.create({
      data: { projectId: project.id, name: `${mark} complex` },
    })
    const building = await prisma.building.create({
      data: { complexId: complex.id, address: `${mark} street 1` },
    })
    const apartment = await prisma.apartment.create({
      data: { buildingId: building.id, apartmentNumber: '4' },
    })
    const resident = await prisma.resident.create({
      data: {
        tenantId: tenant.id, apartmentId: apartment.id,
        firstName: `${mark}First`, lastName: 'Levi',
        phone: '0509900101', isActive: true, signatureStatus: 'SIGNED',
      },
    })

    return {
      tenantId: tenant.id, projectId: project.id,
      apartmentId: apartment.id, residentId: resident.id, managerId: manager.id,
    }
  }

  const purge = async () => {
    const stale = await prisma.tenant.findMany({
      where: { slug: { startsWith: 'chat-' } }, select: { id: true },
    })
    for (const t of stale) {
      await prisma.message.deleteMany({ where: { tenantId: t.id } })
      await prisma.residentDocument.deleteMany({ where: { document: { tenantId: t.id } } })
      await prisma.document.deleteMany({ where: { tenantId: t.id } })
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } }).catch(() => undefined)
    }
  }

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({ totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }),
      })
      .compile()

    app = mod.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()

    prisma = app.get(PrismaService)
    jwt = app.get(JwtService, { strict: false })

    await purge()

    A = await makeTenant(SLUG_A, 'A', 'Alpha')
    B = await makeTenant(SLUG_B, 'B', B_SECRET)

    await prisma.message.create({
      data: {
        tenantId: A.tenantId, residentId: A.residentId, channel: 'SMS', direction: 'OUTBOUND',
        status: 'DELIVERED', body: 'AlphaSentMessage: פגישה ביום שני',
      },
    })
    await prisma.message.create({
      data: {
        tenantId: B.tenantId, residentId: B.residentId, channel: 'SMS', direction: 'OUTBOUND',
        status: 'DELIVERED', body: `${B_SECRET} confidential message`,
      },
    })

    residentAToken = residentToken({
      residentId: A.residentId, tenantId: A.tenantId, projectId: A.projectId,
    })
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  beforeEach(() => {
    createMock.mockReset()
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'תשובה לדוגמה מהעוזר.' }],
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  1. The prompt is built from this resident's own data
  // ══════════════════════════════════════════════════════════════════════════

  describe('the prompt reflects the signed-in resident', () => {
    it('sends a system prompt naming their real project, signature status and units', async () => {
      const res = await api()
        .post(BASE)
        .set(asResidentA())
        .send({ messages: [{ role: 'user', content: 'מה שלב הפרויקט?' }] })
        .expect(200)

      expect(res.body.reply).toBe('תשובה לדוגמה מהעוזר.')
      expect(createMock).toHaveBeenCalledTimes(1)

      const call = createMock.mock.calls[0][0]
      expect(call.model).toBe('claude-sonnet-4-6')
      expect(call.max_tokens).toBe(1000)
      expect(call.system).toContain('Alpha Project')
      expect(call.system).toContain('חתם/ה')
      expect(call.system).toContain('40 סה"כ, 25 חתמו')
      expect(call.system).toContain('AlphaSentMessage')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  2. Tenant isolation — the property this suite exists for
  // ══════════════════════════════════════════════════════════════════════════

  describe('tenant isolation', () => {
    it("never puts another tenant's facts into THIS resident's prompt", async () => {
      await api()
        .post(BASE)
        .set(asResidentA())
        .send({ messages: [{ role: 'user', content: 'שלום' }] })
        .expect(200)

      const call = createMock.mock.calls[0][0]
      expect(call.system).not.toContain(B_SECRET)
      expect(call.system).not.toContain(B.tenantId)
      expect(call.system).not.toContain(B.residentId)
    })

    it('a resident token forged with another tenant claim is refused before Claude is ever called', async () => {
      const forged = residentToken({
        residentId: A.residentId, tenantId: B.tenantId, projectId: A.projectId,
      })
      const res = await api()
        .post(BASE)
        .set({ Authorization: `Bearer ${forged}` })
        .send({ messages: [{ role: 'user', content: 'שלום' }] })

      expect(res.status).toBe(401)
      expect(res.body.code).toBe('PORTAL_SCOPE_CHANGED')
      expect(createMock).not.toHaveBeenCalled()
    })

    it("resident B's own reply never mentions tenant A", async () => {
      const tokenB = residentToken({
        residentId: B.residentId, tenantId: B.tenantId, projectId: B.projectId,
      })
      await api()
        .post(BASE)
        .set({ Authorization: `Bearer ${tokenB}` })
        .send({ messages: [{ role: 'user', content: 'שלום' }] })
        .expect(200)

      const call = createMock.mock.calls[0][0]
      expect(call.system).toContain(B_SECRET)
      expect(call.system).not.toContain('Alpha')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  //  3. Access
  // ══════════════════════════════════════════════════════════════════════════

  describe('access', () => {
    it('rejects an anonymous caller with 401, and never calls Claude', async () => {
      await api()
        .post(BASE)
        .send({ messages: [{ role: 'user', content: 'שלום' }] })
        .expect(401)
      expect(createMock).not.toHaveBeenCalled()
    })

    it('rejects a request with no messages', async () => {
      await api().post(BASE).set(asResidentA()).send({ messages: [] }).expect(400)
    })

    it('never makes a real network call — the SDK constructor itself is mocked', async () => {
      // Belt and braces on top of every test above: this asserts the mock
      // module, not just its return value, is what the service constructed.
      const sdk = jest.requireMock('@anthropic-ai/sdk') as { default: jest.Mock }
      await api()
        .post(BASE)
        .set(asResidentA())
        .send({ messages: [{ role: 'user', content: 'שלום' }] })
        .expect(200)
      expect(sdk.default).toHaveBeenCalled()
    })
  })
})
