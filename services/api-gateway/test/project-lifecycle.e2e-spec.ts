/**
 * Project lifecycle closure E2E.
 *
 * Until now a project could be created and edited but never closed, so a
 * completed or abandoned project stayed in the working list forever. This suite
 * pins the closure contract:
 *
 *   1. Archive is a SOFT close — the row survives, it just leaves the default
 *      list. Restore puts it back at the status it held before.
 *   2. Archived projects are hidden from `GET /projects` by default and are
 *      reachable only via an explicit opt-in (`status=ARCHIVED` /
 *      `includeArchived=true`).
 *   3. RBAC — a staff role outside MANAGER_ROLES gets 403 (not 401, not 404).
 *   4. Tenant isolation — another tenant's project is 404 on every lifecycle
 *      route, never 403, which would confirm the id exists elsewhere.
 *   5. Hard delete is restricted to an EMPTY project; a populated one is
 *      refused with 409, following the precedent set by meetings.
 *
 * Every assertion is scoped to rows this suite created by name/id. The suite
 * runs in parallel with 20+ others against one shared dev database, so a
 * global row count would flake.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SEED_EMAIL = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'
const B_SLUG = 'e2e-lifecycle-tenant-b'

/** Unique per run so parallel/repeat runs never collide on the name. */
const RUN = randomUUID().slice(0, 8)
const NAME = (suffix: string) => `E2E Lifecycle ${RUN} ${suffix}`

describe('Project lifecycle closure (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let token: string
  let tenantId: string
  let userId: string

  let tenantBId: string
  let bProjectId: string

  /** Projects created through the API by this suite, removed in afterAll. */
  const createdProjectIds: string[] = []

  const auth = () => ({ Authorization: `Bearer ${token}` })

  const createProject = async (suffix: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth())
      .send({ name: NAME(suffix), city: 'תל אביב', totalUnits: 0 })
    expect(res.status).toBe(201)
    createdProjectIds.push(res.body.id)
    return res.body.id as string
  }

  /** A real, correctly signed token carrying a different role. */
  const tokenForRole = (role: string) =>
    jwt.sign({
      sub: userId,
      email: SEED_EMAIL,
      role,
      tenantId,
      // sessionId is mandatory on every access token.
      sessionId: randomUUID(),
    })

  const purgeTenantB = async () => {
    const t = await prisma.tenant.findUnique({ where: { slug: B_SLUG } })
    if (!t) return
    await prisma.projectStageHistory.deleteMany({
      where: { project: { tenantId: t.id } },
    })
    await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
    await prisma.project.deleteMany({ where: { tenantId: t.id } })
    await prisma.user.deleteMany({ where: { tenantId: t.id } })
    await prisma.tenant.delete({ where: { id: t.id } })
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })

    // Fail loudly rather than silently skipping the whole suite.
    expect(login.status).toBe(200)
    token = login.body.accessToken
    const decoded = jwt.decode(token) as any
    tenantId = decoded.tenantId
    userId = decoded.sub

    await purgeTenantB()
    const tenantB = await prisma.tenant.create({
      data: { name: 'E2E Lifecycle Tenant B', slug: B_SLUG },
    })
    tenantBId = tenantB.id
    expect(tenantBId).not.toBe(tenantId)

    const bProject = await prisma.project.create({
      data: {
        tenantId: tenantBId,
        code: `TBL-${RUN}`,
        name: 'Tenant B Lifecycle Project',
        city: 'חיפה',
      },
    })
    bProjectId = bProject.id
  })

  afterAll(async () => {
    if (createdProjectIds.length) {
      await prisma.auditLog.deleteMany({
        where: { tenantId, entity: 'Project', entityId: { in: createdProjectIds } },
      })
      await prisma.projectStageHistory.deleteMany({
        where: { projectId: { in: createdProjectIds } },
      })
      await prisma.complex.deleteMany({ where: { projectId: { in: createdProjectIds } } })
      await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } })
    }
    await purgeTenantB()
    await app?.close()
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('archive → hidden → restore', () => {
    it('archives an active project and records the previous status', async () => {
      const id = await createProject('archive-happy')

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`)
        .set(auth())
        .send({ reason: 'הפרויקט הסתיים' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('ARCHIVED')

      const audit = await prisma.auditLog.findFirst({
        where: { tenantId, entity: 'Project', entityId: id, action: 'DELETE' },
        orderBy: { createdAt: 'desc' },
      })
      expect(audit).toBeTruthy()
      expect((audit!.metadata as any).reason).toBe('ARCHIVE')
      expect((audit!.metadata as any).previousStatus).toBe('ACTIVE')
    })

    it('hides the archived project from the DEFAULT list', async () => {
      const id = await createProject('hidden-default')
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`).set(auth()).send({})

      const res = await request(app.getHttpServer())
        .get('/api/v1/projects?limit=200')
        .set(auth())

      expect(res.status).toBe(200)
      // Scoped to THIS row — a global count would flake under parallel suites.
      expect(res.body.data.some((p: any) => p.id === id)).toBe(false)
    })

    it('shows it under the explicit ARCHIVED filter', async () => {
      const id = await createProject('archived-filter')
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`).set(auth()).send({})

      const res = await request(app.getHttpServer())
        .get('/api/v1/projects?status=ARCHIVED&limit=200')
        .set(auth())

      expect(res.status).toBe(200)
      const row = res.body.data.find((p: any) => p.id === id)
      expect(row).toBeTruthy()
      expect(row.status).toBe('ARCHIVED')
    })

    it('shows it under includeArchived=true alongside active projects', async () => {
      const archivedId = await createProject('include-archived')
      const activeId   = await createProject('include-active')
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${archivedId}/archive`).set(auth()).send({})

      const res = await request(app.getHttpServer())
        .get('/api/v1/projects?includeArchived=true&limit=200')
        .set(auth())

      expect(res.status).toBe(200)
      const ids = res.body.data.map((p: any) => p.id)
      expect(ids).toContain(archivedId)
      expect(ids).toContain(activeId)
    })

    it('restores to the status held before archiving, without an explicit status', async () => {
      const id = await createProject('restore-previous')

      // Put it in a non-default status first, so ACTIVE-by-luck cannot pass.
      const held = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${id}/status`).set(auth()).send({ status: 'ON_HOLD' })
      expect(held.status).toBe(200)

      await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`).set(auth()).send({})

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/restore`).set(auth()).send({})

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('ON_HOLD')

      // And it is back in the default list.
      const list = await request(app.getHttpServer())
        .get('/api/v1/projects?limit=200').set(auth())
      expect(list.body.data.some((p: any) => p.id === id)).toBe(true)
    })

    it('restores to an explicitly requested status when one is given', async () => {
      const id = await createProject('restore-explicit')
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`).set(auth()).send({})

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/restore`).set(auth()).send({ status: 'COMPLETED' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('COMPLETED')
    })

    it('refuses ARCHIVED as a restore target (400 from the DTO)', async () => {
      const id = await createProject('restore-to-archived')
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`).set(auth()).send({})

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/restore`).set(auth()).send({ status: 'ARCHIVED' })

      expect(res.status).toBe(400)
    })
  })

  // ── Conflicts ─────────────────────────────────────────────────────────────

  describe('conflicts', () => {
    it('archiving an already-archived project → 409', async () => {
      const id = await createProject('double-archive')
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`).set(auth()).send({})

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`).set(auth()).send({})

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('PROJECT_ALREADY_ARCHIVED')
    })

    it('restoring a project that is not archived → 409', async () => {
      const id = await createProject('restore-not-archived')

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/restore`).set(auth()).send({})

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('PROJECT_NOT_ARCHIVED')
    })
  })

  // ── Hard delete ───────────────────────────────────────────────────────────

  describe('hard delete', () => {
    it('deletes an EMPTY project and it is gone from the database', async () => {
      const id = await createProject('delete-empty')

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${id}`).set(auth())

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ id, deleted: true })
      expect(await prisma.project.findUnique({ where: { id } })).toBeNull()
    })

    it('refuses a project that holds any child data → 409, and nothing is deleted', async () => {
      const id = await createProject('delete-populated')
      await prisma.complex.create({
        data: { projectId: id, name: `Complex ${RUN}` },
      })

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${id}`).set(auth())

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('PROJECT_NOT_EMPTY')
      // The refusal must be total — the project and its complex both survive.
      expect(await prisma.project.findUnique({ where: { id } })).not.toBeNull()
      expect(await prisma.complex.count({ where: { projectId: id } })).toBe(1)
    })
  })

  // ── RBAC ──────────────────────────────────────────────────────────────────

  describe('RBAC', () => {
    it('archive without a token → 401', async () => {
      const id = await createProject('rbac-anon')
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`).send({})
      expect(res.status).toBe(401)
    })

    it('archive as a staff role outside MANAGER_ROLES → 403 (not 401)', async () => {
      const id = await createProject('rbac-archive')
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`)
        .set({ Authorization: `Bearer ${tokenForRole('FIELD_AGENT')}` })
        .send({})
      expect(res.status).toBe(403)
    })

    it('restore as a staff role outside MANAGER_ROLES → 403', async () => {
      const id = await createProject('rbac-restore')
      await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/archive`).set(auth()).send({})

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${id}/restore`)
        .set({ Authorization: `Bearer ${tokenForRole('LAWYER')}` })
        .send({})
      expect(res.status).toBe(403)
    })

    it('hard delete as PROJECT_MANAGER → 403 (admin-only)', async () => {
      const id = await createProject('rbac-delete-pm')
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${id}`)
        .set({ Authorization: `Bearer ${tokenForRole('PROJECT_MANAGER')}` })
      expect(res.status).toBe(403)
      expect(await prisma.project.findUnique({ where: { id } })).not.toBeNull()
    })
  })

  // ── Tenant isolation ──────────────────────────────────────────────────────

  describe('tenant isolation', () => {
    it('archiving another tenant’s project → 404 (never 403)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${bProjectId}/archive`).set(auth()).send({})
      expect(res.status).toBe(404)
      const still = await prisma.project.findUnique({ where: { id: bProjectId } })
      expect(still!.status).toBe('ACTIVE')
    })

    it('restoring another tenant’s project → 404', async () => {
      await prisma.project.update({
        where: { id: bProjectId }, data: { status: 'ARCHIVED' },
      })
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${bProjectId}/restore`).set(auth()).send({})
      expect(res.status).toBe(404)
      const still = await prisma.project.findUnique({ where: { id: bProjectId } })
      expect(still!.status).toBe('ARCHIVED')
      await prisma.project.update({
        where: { id: bProjectId }, data: { status: 'ACTIVE' },
      })
    })

    it('hard-deleting another tenant’s project → 404 and the row survives', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${bProjectId}`).set(auth())
      expect(res.status).toBe(404)
      expect(await prisma.project.findUnique({ where: { id: bProjectId } })).not.toBeNull()
    })

    it('the ARCHIVED list never leaks another tenant’s archived project', async () => {
      await prisma.project.update({
        where: { id: bProjectId }, data: { status: 'ARCHIVED' },
      })
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects?status=ARCHIVED&limit=200').set(auth())
      expect(res.status).toBe(200)
      expect(res.body.data.some((p: any) => p.id === bProjectId)).toBe(false)
      await prisma.project.update({
        where: { id: bProjectId }, data: { status: 'ACTIVE' },
      })
    })
  })
})
