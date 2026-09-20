/**
 * Automations E2E.
 *
 * `Automation` / `AutomationAction` were schema-only: the CRM screen said so in
 * its own header comment. This suite pins the engine that now backs them, and
 * especially the safety properties, because an automation fires unattended:
 *
 *   - saving one does NOT arm it (`isActive` defaults false);
 *   - action types that would contact real residents or make outbound HTTP are
 *     refused AT SAVE TIME with a reason, not silently skipped at run time;
 *   - a run never throws into the operation that triggered it;
 *   - a tenant-scoped automation never fires on another tenant's event, and a
 *     tampered `assigneeId` / `userIds` cannot reach across tenants.
 *
 * NO PASSWORD IS USED. Tokens are minted through `JwtService`; `sessionId` is
 * always present or `JwtStrategy` rejects the token and every assertion here
 * would pass vacuously.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { AutomationRunnerService } from '../src/automations/automation-runner.service'
import { validateAllowlistConfiguration } from '../src/automations/webhook-allowlist'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const A_SLUG = 'e2e-auto-tenant-a'
const B_SLUG = 'e2e-auto-tenant-b'
const BASE = '/api/v1/automations'

describe('Automations (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let runner: AutomationRunnerService

  let tenantAId: string
  let tenantBId: string
  let managerId: string
  let agentId: string
  let outsiderId: string
  let projectAId: string

  let managerToken: string
  let agentToken: string
  let outsiderToken: string
  let adminToken: string

  const token = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const api = () => request(app.getHttpServer())
  const asManager  = () => ({ Authorization: `Bearer ${managerToken}` })
  const asAgent    = () => ({ Authorization: `Bearer ${agentToken}` })
  const asOutsider = () => ({ Authorization: `Bearer ${outsiderToken}` })
  const asAdmin    = () => ({ Authorization: `Bearer ${adminToken}` })

  let seq = 0
  const uniqueName = (p: string) => `${p}-${++seq}-${randomUUID().slice(0, 6)}`

  const validAction = (over: Record<string, unknown> = {}) => ({
    order: 0, type: 'CREATE_TASK', config: { title: 'משימה אוטומטית' }, ...over,
  })

  const purge = async () => {
    for (const slug of [A_SLUG, B_SLUG]) {
      const t = await prisma.tenant.findUnique({ where: { slug } })
      if (!t) continue
      await prisma.automationAction.deleteMany({ where: { automation: { tenantId: t.id } } })
      await prisma.automation.deleteMany({ where: { tenantId: t.id } })
      await prisma.message.deleteMany({ where: { tenantId: t.id } })
      await prisma.communicationTemplate.deleteMany({ where: { tenantId: t.id } })
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.apartment.deleteMany({ where: { building: { complex: { project: { tenantId: t.id } } } } })
      await prisma.building.deleteMany({ where: { complex: { project: { tenantId: t.id } } } })
      await prisma.complex.deleteMany({ where: { project: { tenantId: t.id } } })
      await prisma.task.deleteMany({ where: { tenantId: t.id } })
      await prisma.notification.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.projectMember.deleteMany({ where: { project: { tenantId: t.id } } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } })
    }
  }

  const makeUser = async (tenantId: string, email: string, role: string) =>
    (await prisma.user.create({
      data: {
        tenantId, email, firstName: 'E2E', lastName: email.split('@')[0]!,
        passwordHash: 'not-a-usable-credential', role: role as never,
      },
      select: { id: true },
    })).id

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      // Same seam and reasoning as the other suites: replacing throttler STORAGE
      // (not the guard) removes rate limiting only. Auth and RBAC guards stay on.
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

    prisma  = app.get(PrismaService, { strict: false })
    jwt     = app.get(JwtService, { strict: false })
    runner  = app.get(AutomationRunnerService, { strict: false })

    await purge()

    const a = await prisma.tenant.create({ data: { name: 'E2E Auto A', slug: A_SLUG } })
    const b = await prisma.tenant.create({ data: { name: 'E2E Auto B', slug: B_SLUG } })
    tenantAId = a.id
    tenantBId = b.id

    managerId  = await makeUser(tenantAId, 'manager@e2e-auto.test', 'PROJECT_MANAGER')
    agentId    = await makeUser(tenantAId, 'agent@e2e-auto.test', 'FIELD_AGENT')
    outsiderId = await makeUser(tenantBId, 'outsider@e2e-auto.test', 'PROJECT_MANAGER')

    managerToken  = token(managerId, tenantAId, 'PROJECT_MANAGER')
    agentToken    = token(agentId, tenantAId, 'FIELD_AGENT')
    outsiderToken = token(outsiderId, tenantBId, 'PROJECT_MANAGER')
    const adminId = await makeUser(tenantAId, 'admin@e2e-auto.test', 'COMPANY_ADMIN')
    adminToken = token(adminId, tenantAId, 'COMPANY_ADMIN')

    const project = await prisma.project.create({
      data: { tenantId: tenantAId, name: 'E2E Auto Project', code: `E2EAUTO-${randomUUID().slice(0, 6)}`, city: 'תל אביב' },
      select: { id: true },
    })
    projectAId = project.id
  })

  afterAll(async () => {
    await purge()
    await app.close()
  })

  // ── Safety: disabled action types ────────────────────────────────────────

  it.each(['GENERATE_REPORT', 'UPDATE_STATUS'])(
    'refuses to save an automation using %s, with a reason',
    async (type) => {
      const res = await api().post(BASE).set(asManager()).send({
        name: uniqueName('disabled'),
        trigger: 'LEAD_CREATED',
        actions: [validAction({ type, config: {} })],
      })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('AUTOMATION_ACTION_NOT_ENABLED')
      expect(res.body.actionType).toBe(type)
      expect(typeof res.body.message).toBe('string')
      expect(res.body.message.length).toBeGreaterThan(20)
    },
  )

  it('reports which action types are executable through the catalog', async () => {
    const res = await api().get(`${BASE}/catalog`).set(asManager())
    expect(res.status).toBe(200)
    const byType = Object.fromEntries(
      res.body.actionTypes.map((a: { type: string; enabled: boolean }) => [a.type, a.enabled]),
    )
    expect(byType['CREATE_TASK']).toBe(true)
    expect(byType['CREATE_NOTIFICATION']).toBe(true)
    // Outbound actions are enabled, but gated by dry run + caps + allowlist.
    expect(byType['SEND_SMS']).toBe(true)
    expect(byType['WEBHOOK']).toBe(true)
    expect(byType['GENERATE_REPORT']).toBe(false)
    expect(byType['UPDATE_STATUS']).toBe(false)
    // Every disabled type must explain itself, or the UI has nothing to show.
    for (const a of res.body.actionTypes) {
      if (!a.enabled) expect(a.disabledReason).toBeTruthy()
    }
  })

  // ── Safety: saving does not arm ──────────────────────────────────────────

  it('creates an automation INACTIVE by default', async () => {
    const res = await api().post(BASE).set(asManager()).send({
      name: uniqueName('inactive'), trigger: 'LEAD_CREATED', actions: [validAction()],
    })
    expect(res.status).toBe(201)
    expect(res.body.isActive).toBe(false)
    expect(res.body.actions).toHaveLength(1)
  })

  it('rejects runCount and lastRunAt as body fields', async () => {
    const res = await api().post(BASE).set(asManager()).send({
      name: uniqueName('mass'), trigger: 'LEAD_CREATED', actions: [validAction()],
      runCount: 999,
    })
    expect(res.status).toBe(400)
  })

  // ── Validation ───────────────────────────────────────────────────────────

  it('requires at least one action', async () => {
    const res = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('empty'), trigger: 'LEAD_CREATED', actions: [] })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('AUTOMATION_NO_ACTIONS')
  })

  it('rejects two actions sharing an order, since execution order would be undefined', async () => {
    const res = await api().post(BASE).set(asManager()).send({
      name: uniqueName('order'), trigger: 'LEAD_CREATED',
      actions: [validAction({ order: 1 }), validAction({ order: 1 })],
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('AUTOMATION_DUPLICATE_ORDER')
  })

  it('validates action config: CREATE_TASK needs a title, CREATE_NOTIFICATION a known kind', async () => {
    const noTitle = await api().post(BASE).set(asManager()).send({
      name: uniqueName('cfg'), trigger: 'LEAD_CREATED',
      actions: [validAction({ config: {} })],
    })
    expect(noTitle.status).toBe(400)
    expect(noTitle.body.code).toBe('AUTOMATION_ACTION_CONFIG_INVALID')

    const badKind = await api().post(BASE).set(asManager()).send({
      name: uniqueName('cfg'), trigger: 'LEAD_CREATED',
      actions: [validAction({ type: 'CREATE_NOTIFICATION', config: { kind: 'NOPE', title: 'x' } })],
    })
    expect(badKind.status).toBe(400)
    expect(badKind.body.code).toBe('AUTOMATION_ACTION_CONFIG_INVALID')
  })

  it('refuses a project from another tenant', async () => {
    const otherProject = await prisma.project.create({
      data: { tenantId: tenantBId, name: 'Other', code: `E2EOTHER-${randomUUID().slice(0, 6)}`, city: 'חיפה' },
      select: { id: true },
    })
    const res = await api().post(BASE).set(asManager()).send({
      name: uniqueName('proj'), trigger: 'LEAD_CREATED',
      projectId: otherProject.id, actions: [validAction()],
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('AUTOMATION_PROJECT_NOT_FOUND')
  })

  // ── Execution ────────────────────────────────────────────────────────────

  it('runs an armed automation and creates the task, unattributed to any user', async () => {
    const created = await api().post(BASE).set(asManager()).send({
      name: uniqueName('run'), trigger: 'RESIDENT_CREATED', isActive: true,
      actions: [validAction({ config: { title: 'ליצור קשר עם דייר', dueInDays: 3 } })],
    })
    expect(created.status).toBe(201)

    const before = await prisma.task.count({ where: { tenantId: tenantAId } })
    await runner.dispatch({ trigger: 'RESIDENT_CREATED', tenantId: tenantAId })
    expect(await prisma.task.count({ where: { tenantId: tenantAId } })).toBe(before + 1)

    const task = await prisma.task.findFirst({
      where: { tenantId: tenantAId, title: 'ליצור קשר עם דייר' },
    })
    expect(task).not.toBeNull()
    // A system-created task must not be attributed to a person who did not
    // create it.
    expect(task!.createdById).toBeNull()
    expect(task!.dueDate).not.toBeNull()

    const reloaded = await prisma.automation.findUnique({ where: { id: created.body.id } })
    expect(reloaded!.runCount).toBe(1)
    expect(reloaded!.lastRunAt).not.toBeNull()
  })

  it('does NOT run an inactive automation', async () => {
    await api().post(BASE).set(asManager()).send({
      name: uniqueName('idle'), trigger: 'TASK_OVERDUE', isActive: false,
      actions: [validAction({ config: { title: 'לא אמור לקרות' } })],
    })
    await runner.dispatch({ trigger: 'TASK_OVERDUE', tenantId: tenantAId })
    expect(await prisma.task.count({
      where: { tenantId: tenantAId, title: 'לא אמור לקרות' },
    })).toBe(0)
  })

  it('never fires one tenant automation on another tenant event', async () => {
    await api().post(BASE).set(asManager()).send({
      name: uniqueName('iso'), trigger: 'DOCUMENT_UPLOADED', isActive: true,
      actions: [validAction({ config: { title: 'משימה של דייר א' } })],
    })
    // Dispatch for tenant B — tenant A's automation must not run.
    await runner.dispatch({ trigger: 'DOCUMENT_UPLOADED', tenantId: tenantBId })
    expect(await prisma.task.count({
      where: { title: 'משימה של דייר א' },
    })).toBe(0)
  })

  it('drops an assignee from another tenant rather than assigning across it', async () => {
    await api().post(BASE).set(asManager()).send({
      name: uniqueName('assignee'), trigger: 'SIGNATURE_SENT', isActive: true,
      actions: [validAction({
        config: { title: 'בדיקת שיוך', assigneeId: outsiderId },
      })],
    })
    await runner.dispatch({ trigger: 'SIGNATURE_SENT', tenantId: tenantAId })
    const task = await prisma.task.findFirst({
      where: { tenantId: tenantAId, title: 'בדיקת שיוך' },
    })
    expect(task).not.toBeNull()
    // The cross-tenant id is dropped, not honoured.
    expect(task!.assigneeId).toBeNull()
  })

  it('emits notifications to project members', async () => {
    await prisma.projectMember.create({
      data: { projectId: projectAId, userId: managerId, role: 'PROJECT_MANAGER' as never },
    })
    await api().post(BASE).set(asManager()).send({
      name: uniqueName('notif'), trigger: 'MEETING_COMPLETED', isActive: true,
      projectId: projectAId,
      actions: [validAction({
        type: 'CREATE_NOTIFICATION',
        config: { kind: 'MEETING', title: 'פגישה הסתיימה', body: 'סכמו את הפגישה' },
      })],
    })

    const before = await prisma.notification.count({ where: { tenantId: tenantAId } })
    await runner.dispatch({
      trigger: 'MEETING_COMPLETED', tenantId: tenantAId, projectId: projectAId,
    })
    expect(await prisma.notification.count({ where: { tenantId: tenantAId } }))
      .toBe(before + 1)
  })

  it('never throws into the caller, even when an action fails', async () => {
    const created = await api().post(BASE).set(asManager()).send({
      name: uniqueName('fail'), trigger: 'CUSTOM', isActive: true,
      actions: [validAction({ config: { title: 'ok' } })],
    })
    // Corrupt the stored config to something the executor cannot use, the way a
    // direct DB write or an older row could.
    await prisma.automationAction.updateMany({
      where: { automationId: created.body.id },
      data: { config: {} as never },
    })

    await expect(
      runner.dispatch({ trigger: 'CUSTOM', tenantId: tenantAId }),
    ).resolves.toBeDefined()

    // The run is still counted, so the failure is visible rather than invisible.
    const reloaded = await prisma.automation.findUnique({ where: { id: created.body.id } })
    expect(reloaded!.runCount).toBe(1)
  })

  // ── Update / delete ──────────────────────────────────────────────────────

  it('replaces the whole action list on update', async () => {
    const created = await api().post(BASE).set(asManager()).send({
      name: uniqueName('repl'), trigger: 'LEAD_CREATED',
      actions: [validAction({ order: 0, config: { title: 'ראשונה' } })],
    })
    const updated = await api().patch(`${BASE}/${created.body.id}`).set(asManager()).send({
      actions: [
        validAction({ order: 0, config: { title: 'חדשה א' } }),
        validAction({ order: 1, config: { title: 'חדשה ב' } }),
      ],
    })
    expect(updated.status).toBe(200)
    expect(updated.body.actions).toHaveLength(2)
    expect(updated.body.actions.map((a: { config: { title: string } }) => a.config.title))
      .toEqual(['חדשה א', 'חדשה ב'])
    expect(await prisma.automationAction.count({
      where: { automationId: created.body.id },
    })).toBe(2)
  })

  it('cascades actions on delete', async () => {
    const created = await api().post(BASE).set(asManager()).send({
      name: uniqueName('del'), trigger: 'LEAD_CREATED', actions: [validAction()],
    })
    expect((await api().delete(`${BASE}/${created.body.id}`).set(asManager())).status).toBe(200)
    expect(await prisma.automationAction.count({
      where: { automationId: created.body.id },
    })).toBe(0)
  })

  // ── RBAC + isolation ─────────────────────────────────────────────────────

  it('lets a field agent READ but not WRITE', async () => {
    expect((await api().get(BASE).set(asAgent())).status).toBe(200)
    const create = await api().post(BASE).set(asAgent())
      .send({ name: uniqueName('rbac'), trigger: 'LEAD_CREATED', actions: [validAction()] })
    expect(create.status).toBe(403)
  })

  it('hides another tenant automations and 404s direct access', async () => {
    const mine = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('hidden'), trigger: 'LEAD_CREATED', actions: [validAction()] })
    const id = mine.body.id

    const theirList = await api().get(BASE).set(asOutsider())
    expect(theirList.body.map((a: { id: string }) => a.id)).not.toContain(id)

    expect((await api().get(`${BASE}/${id}`).set(asOutsider())).status).toBe(404)
    expect((await api().patch(`${BASE}/${id}`).set(asOutsider()).send({ isActive: true })).status).toBe(404)
    expect((await api().delete(`${BASE}/${id}`).set(asOutsider())).status).toBe(404)

    // Critically: the cross-tenant PATCH must not have armed it.
    const still = await prisma.automation.findUnique({ where: { id } })
    expect(still!.isActive).toBe(false)
  })

  it('requires authentication', async () => {
    expect((await api().get(BASE)).status).toBe(401)
  })

  // ── Webhook egress allowlist ─────────────────────────────────────────────

  describe('webhook egress allowlist', () => {
    const webhookAction = (url: string) => ({
      order: 0, type: 'WEBHOOK', config: { url },
    })
    const save = (url: string) =>
      api().post(BASE).set(asManager()).send({
        name: uniqueName('hook'), trigger: 'LEAD_CREATED', actions: [webhookAction(url)],
      })

    const ORIGINAL = process.env.AUTOMATION_WEBHOOK_ALLOWLIST
    beforeAll(() => { process.env.AUTOMATION_WEBHOOK_ALLOWLIST = '.hooks.example.com,partner.test' })
    afterAll(() => {
      if (ORIGINAL === undefined) delete process.env.AUTOMATION_WEBHOOK_ALLOWLIST
      else process.env.AUTOMATION_WEBHOOK_ALLOWLIST = ORIGINAL
    })

    it.each([
      ['https://169.254.169.254/latest/meta-data/', 'cloud metadata'],
      ['https://127.0.0.1/hook', 'loopback'],
      ['https://10.0.0.5/hook', 'RFC1918 10/8'],
      ['https://192.168.1.10/hook', 'RFC1918 192.168/16'],
      ['https://172.16.5.4/hook', 'RFC1918 172.16/12'],
      ['https://100.64.0.1/hook', 'carrier-grade NAT'],
      ['https://localhost/hook', 'localhost'],
      ['https://metadata.google.internal/x', 'GCP metadata alias'],
      ['https://[::1]/hook', 'IPv6 loopback'],
    ])('refuses %s (%s) as an internal destination', async (url) => {
      const res = await save(url)
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('WEBHOOK_HOST_INTERNAL')
    })

    it('refuses a host that is merely absent from the allowlist, with a different code', async () => {
      const res = await save('https://evil.example.org/hook')
      expect(res.status).toBe(400)
      // Distinct from WEBHOOK_HOST_INTERNAL so an operator is not invited to
      // "fix" a loopback URL by allowlisting it.
      expect(res.body.code).toBe('WEBHOOK_HOST_NOT_ALLOWED')
    })

    it('refuses plain http and embedded credentials', async () => {
      expect((await save('http://partner.test/hook')).body.code).toBe('WEBHOOK_URL_NOT_HTTPS')
      expect((await save('https://u:p@partner.test/hook')).body.code)
        .toBe('WEBHOOK_URL_HAS_CREDENTIALS')
    })

    it('accepts an allowlisted exact host and a subdomain of a dotted entry', async () => {
      expect((await save('https://partner.test/hook')).status).toBe(201)
      expect((await save('https://a.hooks.example.com/x')).status).toBe(201)
    })

    it('refuses Authorization-style headers so secrets never live in the row', async () => {
      const res = await api().post(BASE).set(asManager()).send({
        name: uniqueName('hdr'), trigger: 'LEAD_CREATED',
        actions: [{ order: 0, type: 'WEBHOOK', config: {
          url: 'https://partner.test/hook', headers: { Authorization: 'Bearer secret' },
        } }],
      })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('AUTOMATION_ACTION_CONFIG_INVALID')
    })

    it('treats an internal address IN THE ALLOWLIST as a configuration error', () => {
      // The product decision: allowlisting 169.254.169.254 is a mistake to
      // refuse, not a configuration to honour.
      expect(() => validateAllowlistConfiguration(['169.254.169.254'])).toThrow()
      expect(() => validateAllowlistConfiguration(['10.0.0.1'])).toThrow()
      expect(() => validateAllowlistConfiguration(['localhost'])).toThrow()
      expect(() => validateAllowlistConfiguration(['.hooks.example.com'])).not.toThrow()
    })

    /**
     * Nested so the env mutation happens in hooks rather than around an `await`
     * inside the test body. Reading a value, awaiting, then writing it back is
     * what `require-atomic-updates` objects to — and it is fragile in general,
     * even though Jest runs these serially.
     */
    describe('with no allowlist configured', () => {
      let saved: string | undefined
      beforeEach(() => {
        saved = process.env.AUTOMATION_WEBHOOK_ALLOWLIST
        delete process.env.AUTOMATION_WEBHOOK_ALLOWLIST
      })
      afterEach(() => {
        if (saved === undefined) delete process.env.AUTOMATION_WEBHOOK_ALLOWLIST
        else process.env.AUTOMATION_WEBHOOK_ALLOWLIST = saved
      })

      it('fails closed', async () => {
        const res = await save('https://partner.test/hook')
        expect(res.status).toBe(400)
        expect(res.body.code).toBe('WEBHOOK_ALLOWLIST_EMPTY')
      })
    })
  })

  // ── Dry run + send caps ──────────────────────────────────────────────────

  describe('outbound sends', () => {
    let templateId: string
    let residentId: string

    const sendAutomation = async (over: Record<string, unknown> = {}) => {
      const res = await api().post(BASE).set(asManager()).send({
        name: uniqueName('send'), trigger: 'SIGNATURE_SENT', isActive: true,
        actions: [{
          order: 0, type: 'SEND_SMS',
          config: { templateId, audience: 'PROJECT_RESIDENTS' },
        }],
        ...over,
      })
      expect(res.status).toBe(201)
      return res.body
    }

    beforeAll(async () => {
      const tmpl = await api().post('/api/v1/communication-templates').set(asManager())
        .send({ name: uniqueName('t'), channel: 'SMS', body: 'עדכון לדייר' })
      expect(tmpl.status).toBe(201)
      templateId = tmpl.body.id

      // A resident reachable by SMS, hung off the project.
      const complex = await prisma.complex.create({
        data: { projectId: projectAId, name: 'מתחם', address: 'הרצל 1' },
        select: { id: true },
      })
      const building = await prisma.building.create({
        data: { complexId: complex.id, address: 'הרצל 1' },
        select: { id: true },
      })
      const apartment = await prisma.apartment.create({
        data: { buildingId: building.id, apartmentNumber: '1', floor: 1 },
        select: { id: true },
      })
      const resident = await prisma.resident.create({
        data: {
          tenantId: tenantAId, apartmentId: apartment.id,
          firstName: 'דנה', lastName: 'כהן', phone: '0501234567',
        },
        select: { id: true },
      })
      residentId = resident.id
    })

    it('is created in dry run even when activated, and sends NOTHING', async () => {
      const created = await sendAutomation()
      expect(created.dryRun).toBe(true)

      const before = await prisma.message.count({ where: { tenantId: tenantAId } })
      await runner.dispatch({
        trigger: 'SIGNATURE_SENT', tenantId: tenantAId, projectId: projectAId,
      })
      // The whole point: an armed outbound automation in dry run contacts nobody.
      expect(await prisma.message.count({ where: { tenantId: tenantAId } })).toBe(before)

      // But it recorded what it WOULD have sent.
      const dryRows = await prisma.auditLog.findMany({
        where: { tenantId: tenantAId, entity: 'Automation', entityId: created.id },
      })
      const wouldSend = dryRows.filter(
        (r) => (r.metadata as { wouldSend?: boolean } | null)?.wouldSend === true,
      )
      expect(wouldSend.length).toBeGreaterThan(0)
      // Resident PII must not be in the audit row.
      expect(JSON.stringify(wouldSend[0]!.metadata)).not.toContain('0501234567')
      expect(JSON.stringify(wouldSend[0]!.metadata)).not.toContain('דנה')
    })

    it('re-forces dry run when a live automation is deactivated and switched back on', async () => {
      const created = await sendAutomation({ isActive: false })
      await api().patch(`${BASE}/${created.id}/dry-run`).set(asAdmin()).send({ dryRun: false })
      expect((await prisma.automation.findUnique({ where: { id: created.id } }))!.dryRun).toBe(false)

      // Reactivating is exactly when a stale "live" flag would send new wording
      // to everyone with nobody having reviewed it.
      await api().patch(`${BASE}/${created.id}`).set(asManager()).send({ isActive: true })
      expect((await prisma.automation.findUnique({ where: { id: created.id } }))!.dryRun).toBe(true)
    })

    it('restricts going live to admins', async () => {
      const created = await sendAutomation()
      const res = await api().patch(`${BASE}/${created.id}/dry-run`).set(asManager())
        .send({ dryRun: false })
      expect(res.status).toBe(403)
      expect((await prisma.automation.findUnique({ where: { id: created.id } }))!.dryRun).toBe(true)
    })

    it('refuses dry-run toggling on an automation with no outbound action', async () => {
      const internal = await api().post(BASE).set(asManager())
        .send({ name: uniqueName('int'), trigger: 'LEAD_CREATED', actions: [validAction()] })
      const res = await api().patch(`${BASE}/${internal.body.id}/dry-run`).set(asAdmin())
        .send({ dryRun: false })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('AUTOMATION_NOT_OUTBOUND')
    })

    it('actually sends once live, tagging the message with the automation', async () => {
      // A cap is now mandatory before an outbound automation may leave dry run,
      // so this fixture carries one. The cap is deliberately larger than the
      // single send this test performs, so it exercises the send path rather
      // than the cap path — the cap itself is covered by the test below.
      const created = await sendAutomation({ sendCapPerHour: 50 })
      await api().patch(`${BASE}/${created.id}/dry-run`).set(asAdmin()).send({ dryRun: false })

      await runner.dispatch({
        trigger: 'SIGNATURE_SENT', tenantId: tenantAId, projectId: projectAId,
      })
      const messages = await prisma.message.findMany({ where: { automationId: created.id } })
      expect(messages.length).toBeGreaterThan(0)
      // The tag is what makes the send cap durable.
      expect(messages[0]!.automationId).toBe(created.id)
      expect(messages[0]!.templateId).toBe(templateId)
      expect(messages[0]!.residentId).toBe(residentId)
    })

    it('refuses sends past the cap instead of queueing them', async () => {
      const created = await sendAutomation({ sendCapPerHour: 1 })
      await api().patch(`${BASE}/${created.id}/dry-run`).set(asAdmin()).send({ dryRun: false })

      // First run consumes the single permitted send.
      await runner.dispatch({
        trigger: 'SIGNATURE_SENT', tenantId: tenantAId, projectId: projectAId,
        subjectId: 'run-1',
      })
      const afterFirst = await prisma.message.count({ where: { automationId: created.id } })
      expect(afterFirst).toBe(1)

      // Second run is refused, not deferred.
      await runner.dispatch({
        trigger: 'SIGNATURE_SENT', tenantId: tenantAId, projectId: projectAId,
        subjectId: 'run-2',
      })
      expect(await prisma.message.count({ where: { automationId: created.id } })).toBe(1)

      const rejected = await prisma.auditLog.findMany({
        where: { tenantId: tenantAId, entity: 'Automation', entityId: created.id, action: 'REJECT' },
      })
      expect(rejected.some(
        (r) => (r.metadata as { reason?: string } | null)?.reason === 'HOURLY_CAP',
      )).toBe(true)
    })

    it('refuses a template from the wrong channel or another tenant', async () => {
      const emailTmpl = await api().post('/api/v1/communication-templates').set(asManager())
        .send({ name: uniqueName('e'), channel: 'EMAIL', body: 'x', subject: 's' })

      const mismatch = await api().post(BASE).set(asManager()).send({
        name: uniqueName('mm'), trigger: 'LEAD_CREATED',
        actions: [{ order: 0, type: 'SEND_SMS',
          config: { templateId: emailTmpl.body.id, audience: 'RESIDENT' } }],
      })
      expect(mismatch.status).toBe(400)
      expect(mismatch.body.code).toBe('AUTOMATION_TEMPLATE_CHANNEL_MISMATCH')

      const missing = await api().post(BASE).set(asManager()).send({
        name: uniqueName('mt'), trigger: 'LEAD_CREATED',
        actions: [{ order: 0, type: 'SEND_SMS',
          config: { templateId: 'does-not-exist', audience: 'RESIDENT' } }],
      })
      expect(missing.status).toBe(400)
      expect(missing.body.code).toBe('AUTOMATION_TEMPLATE_NOT_FOUND')
    })
  })


  // ── Real domain events actually fire automations ─────────────────────────

  describe('trigger emitters', () => {
    /**
     * The engine was fully tested through `runner.dispatch()` before these
     * existed, which proved the engine worked and proved NOTHING about whether
     * anything in the product ever calls it. These tests go through the real
     * HTTP endpoints so a regression that silently drops a `dispatch()` call is
     * caught.
     */

    const armedTaskAutomation = async (trigger: string, title: string) => {
      const res = await api().post(BASE).set(asManager()).send({
        name: uniqueName('trg'), trigger, isActive: true,
        actions: [validAction({ config: { title } })],
      })
      expect(res.status).toBe(201)
      return res.body
    }

    it('LEAD_CREATED fires when a lead is created through the API', async () => {
      const title = `lead-hook-${randomUUID().slice(0, 6)}`
      await armedTaskAutomation('LEAD_CREATED', title)

      const lead = await api().post('/api/v1/leads').set(asManager()).send({
        firstName: 'יוסי', lastName: 'לוי', phone: '0521234567',
      })
      expect([200, 201]).toContain(lead.status)

      expect(await prisma.task.count({ where: { tenantId: tenantAId, title } })).toBe(1)
    })

    it('RESIDENT_CREATED fires when a resident is created through the API', async () => {
      const title = `resident-hook-${randomUUID().slice(0, 6)}`
      await armedTaskAutomation('RESIDENT_CREATED', title)

      const complex = await prisma.complex.create({
        data: { projectId: projectAId, name: 'מתחם טריגר', address: 'הרצל 9' },
        select: { id: true },
      })
      const building = await prisma.building.create({
        data: { complexId: complex.id, address: 'הרצל 9' }, select: { id: true },
      })
      const apartment = await prisma.apartment.create({
        data: { buildingId: building.id, apartmentNumber: '77' }, select: { id: true },
      })

      const created = await api().post('/api/v1/residents').set(asManager()).send({
        apartmentId: apartment.id, firstName: 'רותי', lastName: 'מזרחי',
      })
      expect([200, 201]).toContain(created.status)

      expect(await prisma.task.count({ where: { tenantId: tenantAId, title } })).toBe(1)
    })

    it('PROJECT_STAGE_CHANGED fires when a project advances a stage', async () => {
      const title = `stage-hook-${randomUUID().slice(0, 6)}`
      await armedTaskAutomation('PROJECT_STAGE_CHANGED', title)

      const project = await prisma.project.create({
        data: {
          tenantId: tenantAId, name: 'פרויקט טריגר',
          code: `TRG-${randomUUID().slice(0, 6)}`, city: 'תל אביב', stage: 'DISCOVERY',
        },
        select: { id: true },
      })

      const advanced = await api()
        .patch(`/api/v1/projects/${project.id}/stage`).set(asManager())
        .send({ stage: 'FEASIBILITY' })

      if (advanced.status >= 400) {
        // Surface the real reason rather than failing on a bare count mismatch.
        throw new Error(
          `advance-stage failed: ${advanced.status} ${JSON.stringify(advanced.body)}`,
        )
      }
      expect(await prisma.task.count({ where: { tenantId: tenantAId, title } })).toBe(1)
    })

    it('a failing automation does not break the operation that triggered it', async () => {
      const created = await armedTaskAutomation('LEAD_CREATED', 'will-be-corrupted')
      // Corrupt the config so the action throws at run time.
      await prisma.automationAction.updateMany({
        where: { automationId: created.id }, data: { config: {} as never },
      })

      // The lead must still be created successfully.
      const lead = await api().post('/api/v1/leads').set(asManager()).send({
        firstName: 'שרה', lastName: 'כהן', phone: '0539876543',
      })
      expect([200, 201]).toContain(lead.status)
      expect(lead.body.id).toBeTruthy()
    })

    it('does not fire another tenant automation on this tenant event', async () => {
      const title = `cross-${randomUUID().slice(0, 6)}`
      // Armed in tenant B.
      const res = await api().post(BASE).set(asOutsider()).send({
        name: uniqueName('cross'), trigger: 'LEAD_CREATED', isActive: true,
        actions: [validAction({ config: { title } })],
      })
      expect(res.status).toBe(201)

      // Event happens in tenant A.
      await api().post('/api/v1/leads').set(asManager())
        .send({ firstName: 'דן', lastName: 'אבני', phone: '0541112223' })

      expect(await prisma.task.count({ where: { title } })).toBe(0)
    })
  })

})
