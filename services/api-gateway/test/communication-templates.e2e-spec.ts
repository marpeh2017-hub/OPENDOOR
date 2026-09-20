/**
 * Communication templates E2E.
 *
 * `CommunicationTemplate` was a schema-only model: no controller, no service,
 * no reader, no writer. This suite pins the module that now backs it, and in
 * particular the properties the automations engine will depend on:
 *
 *   - `variables` is DERIVED from the body text, never accepted from the client,
 *     so it cannot drift from the placeholders actually present.
 *   - rendering is STRICT: a missing value is a 400, never a message that
 *     reaches a resident containing a literal `{{firstName}}`.
 *   - a value containing `{{...}}` is inserted literally and never re-expanded.
 *   - editing an approved WhatsApp template resets its approval.
 *   - a template that has sent messages cannot be deleted, because
 *     `Message.template` is optional and would otherwise SetNull the history.
 *
 * NO PASSWORD IS USED. Tokens are minted through `JwtService` against users this
 * suite creates. `sessionId` is always present — a token without it is rejected
 * by `JwtStrategy`, so omitting it would make every assertion here vacuous.
 *
 * Every row created is removed in afterAll.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { extractVariables, renderTemplate, TemplateRenderError } from '../src/templates/template-render'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const A_SLUG = 'e2e-tmpl-tenant-a'
const B_SLUG = 'e2e-tmpl-tenant-b'

describe('Communication templates (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let tenantAId: string
  let tenantBId: string
  let managerId: string
  let agentId: string
  let adminId: string
  let outsiderId: string

  let managerToken: string
  let agentToken: string
  let adminToken: string
  let outsiderToken: string

  const token = (userId: string, tenantId: string, role: string) =>
    jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  const api = () => request(app.getHttpServer())
  const asManager  = () => ({ Authorization: `Bearer ${managerToken}` })
  const asAgent    = () => ({ Authorization: `Bearer ${agentToken}` })
  const asAdmin    = () => ({ Authorization: `Bearer ${adminToken}` })
  const asOutsider = () => ({ Authorization: `Bearer ${outsiderToken}` })

  const BASE = '/api/v1/communication-templates'

  const purge = async () => {
    for (const slug of [A_SLUG, B_SLUG]) {
      const t = await prisma.tenant.findUnique({ where: { slug } })
      if (!t) continue
      await prisma.message.deleteMany({ where: { tenantId: t.id } })
      await prisma.communicationTemplate.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } })
    }
  }

  const makeUser = async (tenantId: string, email: string, role: string) => {
    const u = await prisma.user.create({
      data: {
        tenantId,
        email,
        firstName: 'E2E',
        lastName: email.split('@')[0]!,
        passwordHash: 'not-a-usable-credential',
        role: role as never,
      },
      select: { id: true },
    })
    return u.id
  }

  /** Unique per test so the (tenant, name, channel, language) constraint never
   *  collides between cases and produces a confusing 409. */
  let seq = 0
  const uniqueName = (prefix: string) => `${prefix}-${++seq}-${randomUUID().slice(0, 8)}`

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Same seam and reasoning as notifications.e2e-spec.ts: the global
      // ThrottlerGuard's 20 req/s would turn RBAC and isolation assertions into
      // 429s. Replacing the STORAGE (not the guard — `useClass` constructs its
      // own instance, so overrideGuard does nothing) removes the rate limit and
      // nothing else. Every auth and RBAC guard stays active.
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
    // Mirrors main.ts exactly. `forbidNonWhitelisted` is what makes the
    // mass-assignment assertions below mean anything.
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma = app.get(PrismaService, { strict: false })
    jwt = app.get(JwtService, { strict: false })

    await purge()

    const a = await prisma.tenant.create({ data: { name: 'E2E Tmpl A', slug: A_SLUG } })
    const b = await prisma.tenant.create({ data: { name: 'E2E Tmpl B', slug: B_SLUG } })
    tenantAId = a.id
    tenantBId = b.id
    expect(tenantAId).not.toBe(tenantBId)

    managerId  = await makeUser(tenantAId, 'manager@e2e-tmpl.test', 'PROJECT_MANAGER')
    agentId    = await makeUser(tenantAId, 'agent@e2e-tmpl.test', 'FIELD_AGENT')
    adminId    = await makeUser(tenantAId, 'admin@e2e-tmpl.test', 'COMPANY_ADMIN')
    outsiderId = await makeUser(tenantBId, 'outsider@e2e-tmpl.test', 'PROJECT_MANAGER')

    managerToken  = token(managerId, tenantAId, 'PROJECT_MANAGER')
    agentToken    = token(agentId, tenantAId, 'FIELD_AGENT')
    adminToken    = token(adminId, tenantAId, 'COMPANY_ADMIN')
    outsiderToken = token(outsiderId, tenantBId, 'PROJECT_MANAGER')
  })

  afterAll(async () => {
    await purge()
    await app.close()
  })

  // ── Pure renderer ────────────────────────────────────────────────────────

  describe('renderer', () => {
    it('extracts each distinct variable once, in first-appearance order', () => {
      expect(extractVariables('שלום {{firstName}}, דירה {{apartment}}. {{firstName}} שוב'))
        .toEqual(['firstName', 'apartment'])
    })

    it('tolerates padding inside the braces', () => {
      expect(extractVariables('{{ firstName }}')).toEqual(['firstName'])
      expect(renderTemplate('{{ firstName }}', { firstName: 'דנה' })).toBe('דנה')
    })

    it('throws listing every missing variable rather than rendering a blank', () => {
      expect.assertions(3)
      try {
        renderTemplate('{{a}} {{b}} {{c}}', { b: 'x' })
      } catch (err) {
        expect(err).toBeInstanceOf(TemplateRenderError)
        expect((err as TemplateRenderError).code).toBe('TEMPLATE_VARIABLES_MISSING')
        expect((err as TemplateRenderError).details['missing']).toEqual(['a', 'c'])
      }
    })

    it('treats an empty string as missing, so nobody receives "שלום ,"', () => {
      expect(() => renderTemplate('שלום {{name}},', { name: '' })).toThrow(TemplateRenderError)
    })

    it('inserts a value containing braces literally and never re-expands it', () => {
      const out = renderTemplate('{{a}}', { a: '{{b}}', b: 'LEAKED' })
      expect(out).toBe('{{b}}')
      expect(out).not.toContain('LEAKED')
    })
  })

  // ── CRUD ─────────────────────────────────────────────────────────────────

  it('derives `variables` from the body and ignores any client-supplied list', async () => {
    const res = await api().post(BASE).set(asManager()).send({
      name: uniqueName('derive'),
      channel: 'SMS',
      body: 'שלום {{firstName}}, פגישה בבניין {{building}}',
      // Not a DTO field. `forbidNonWhitelisted` must reject the whole request
      // rather than quietly accepting a second source of truth.
      variables: ['totallyWrong'],
    })
    expect(res.status).toBe(400)

    const ok = await api().post(BASE).set(asManager()).send({
      name: uniqueName('derive'),
      channel: 'SMS',
      body: 'שלום {{firstName}}, פגישה בבניין {{building}}',
    })
    expect(ok.status).toBe(201)
    expect(ok.body.variables).toEqual(['firstName', 'building'])
    expect(ok.body.language).toBe('he')
  })

  it('rejects tenantId and isApproved as body fields', async () => {
    const withTenant = await api().post(BASE).set(asManager()).send({
      name: uniqueName('mass'), channel: 'SMS', body: 'x', tenantId: tenantBId,
    })
    expect(withTenant.status).toBe(400)

    const withApproval = await api().post(BASE).set(asManager()).send({
      name: uniqueName('mass'), channel: 'WHATSAPP', body: 'x', isApproved: true,
    })
    expect(withApproval.status).toBe(400)
  })

  it('never creates a WhatsApp template already marked approved', async () => {
    const res = await api().post(BASE).set(asManager()).send({
      name: uniqueName('wa'), channel: 'WHATSAPP', body: 'שלום {{firstName}}',
    })
    expect(res.status).toBe(201)
    expect(res.body.isApproved).toBe(false)
  })

  it('rejects a subject on a non-email channel instead of dropping it', async () => {
    const sms = await api().post(BASE).set(asManager()).send({
      name: uniqueName('subj'), channel: 'SMS', body: 'x', subject: 'נושא',
    })
    expect(sms.status).toBe(400)
    expect(sms.body.code).toBe('TEMPLATE_SUBJECT_NOT_APPLICABLE')

    const email = await api().post(BASE).set(asManager()).send({
      name: uniqueName('subj'), channel: 'EMAIL', body: 'שלום {{firstName}}', subject: 'עדכון {{project}}',
    })
    expect(email.status).toBe(201)
    // Variables are collected from the subject as well as the body.
    expect(email.body.variables).toEqual(['firstName', 'project'])
  })

  it('409s on a duplicate name within the same channel and language, but allows a different channel', async () => {
    const name = uniqueName('dupe')
    const first = await api().post(BASE).set(asManager()).send({ name, channel: 'SMS', body: 'a' })
    expect(first.status).toBe(201)

    const dupe = await api().post(BASE).set(asManager()).send({ name, channel: 'SMS', body: 'b' })
    expect(dupe.status).toBe(409)
    expect(dupe.body.code).toBe('TEMPLATE_NAME_TAKEN')

    const otherChannel = await api().post(BASE).set(asManager())
      .send({ name, channel: 'EMAIL', body: 'c' })
    expect(otherChannel.status).toBe(201)
  })

  it('re-derives variables on update', async () => {
    const created = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('upd'), channel: 'SMS', body: 'שלום {{firstName}}' })
    expect(created.body.variables).toEqual(['firstName'])

    const updated = await api().patch(`${BASE}/${created.body.id}`).set(asManager())
      .send({ body: 'שלום {{firstName}} מדירה {{apartment}}' })
    expect(updated.status).toBe(200)
    expect(updated.body.variables).toEqual(['firstName', 'apartment'])
  })

  // ── Rendering through the API ────────────────────────────────────────────

  it('renders a preview and 400s with the missing names when a value is absent', async () => {
    const created = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('prev'), channel: 'SMS', body: 'שלום {{firstName}}, דירה {{apartment}}' })
    const id = created.body.id

    const ok = await api().post(`${BASE}/${id}/preview`).set(asManager())
      .send({ values: { firstName: 'דנה', apartment: '12' } })
    expect(ok.status).toBe(200)
    expect(ok.body.body).toBe('שלום דנה, דירה 12')

    const missing = await api().post(`${BASE}/${id}/preview`).set(asManager())
      .send({ values: { firstName: 'דנה' } })
    expect(missing.status).toBe(400)
    expect(missing.body.code).toBe('TEMPLATE_VARIABLES_MISSING')
    expect(missing.body.missing).toEqual(['apartment'])
  })

  // ── WhatsApp approval ────────────────────────────────────────────────────

  it('resets approval when the approved text is edited', async () => {
    const created = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('reset'), channel: 'WHATSAPP', body: 'נוסח מאושר {{firstName}}' })
    const id = created.body.id

    const approved = await api().patch(`${BASE}/${id}/approval`).set(asAdmin())
      .send({ isApproved: true })
    expect(approved.status).toBe(200)
    expect(approved.body.isApproved).toBe(true)

    // A non-text edit must NOT invalidate the provider's review.
    const rename = await api().patch(`${BASE}/${id}`).set(asManager()).send({ name: uniqueName('reset') })
    expect(rename.body.isApproved).toBe(true)

    // Editing the wording must.
    const edited = await api().patch(`${BASE}/${id}`).set(asManager())
      .send({ body: 'נוסח אחר לגמרי {{firstName}}' })
    expect(edited.status).toBe(200)
    expect(edited.body.isApproved).toBe(false)
  })

  it('refuses to record approval on a non-WhatsApp template', async () => {
    const created = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('noapp'), channel: 'SMS', body: 'x' })
    const res = await api().patch(`${BASE}/${created.body.id}/approval`).set(asAdmin())
      .send({ isApproved: true })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('TEMPLATE_APPROVAL_NOT_APPLICABLE')
  })

  it('restricts approval to admins — a project manager gets 403', async () => {
    const created = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('appr'), channel: 'WHATSAPP', body: 'x' })
    const res = await api().patch(`${BASE}/${created.body.id}/approval`).set(asManager())
      .send({ isApproved: true })
    expect(res.status).toBe(403)
  })

  // ── Deletion guard ───────────────────────────────────────────────────────

  it('deletes an unused template but 409s once it has sent a message', async () => {
    const created = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('del'), channel: 'SMS', body: 'x' })
    const id = created.body.id

    await prisma.message.create({
      data: {
        tenantId: tenantAId,
        channel: 'SMS' as never,
        direction: 'OUTBOUND' as never,
        body: 'x',
        templateId: id,
      },
    })

    const blocked = await api().delete(`${BASE}/${id}`).set(asManager())
    expect(blocked.status).toBe(409)
    expect(blocked.body.code).toBe('TEMPLATE_IN_USE')

    // The history must still point at the template — this is the whole reason
    // deletion is refused, so assert it rather than trusting the 409.
    const msg = await prisma.message.findFirst({ where: { templateId: id } })
    expect(msg?.templateId).toBe(id)

    const unused = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('del'), channel: 'SMS', body: 'y' })
    const okDelete = await api().delete(`${BASE}/${unused.body.id}`).set(asManager())
    expect(okDelete.status).toBe(200)
    expect(await prisma.communicationTemplate.count({ where: { id: unused.body.id } })).toBe(0)
  })

  // ── RBAC ─────────────────────────────────────────────────────────────────

  it('lets a field agent READ but not WRITE', async () => {
    const list = await api().get(BASE).set(asAgent())
    expect(list.status).toBe(200)

    const create = await api().post(BASE).set(asAgent())
      .send({ name: uniqueName('rbac'), channel: 'SMS', body: 'x' })
    expect(create.status).toBe(403)
  })

  // ── Tenant isolation ─────────────────────────────────────────────────────

  it('hides another tenant\'s templates from both list and direct fetch', async () => {
    const mine = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('iso'), channel: 'SMS', body: 'סודי' })
    const id = mine.body.id

    const theirList = await api().get(BASE).set(asOutsider())
    expect(theirList.status).toBe(200)
    expect(theirList.body.map((t: { id: string }) => t.id)).not.toContain(id)

    // 404, not 403 — a cross-tenant id must not be confirmed to exist.
    expect((await api().get(`${BASE}/${id}`).set(asOutsider())).status).toBe(404)
    expect((await api().patch(`${BASE}/${id}`).set(asOutsider()).send({ body: 'z' })).status).toBe(404)
    expect((await api().delete(`${BASE}/${id}`).set(asOutsider())).status).toBe(404)

    // And the row is untouched.
    const still = await prisma.communicationTemplate.findUnique({ where: { id } })
    expect(still?.body).toBe('סודי')
  })

  // ── Audit ────────────────────────────────────────────────────────────────

  it('writes an audit row attributed to the real actor, without copying the body', async () => {
    const before = await prisma.auditLog.count({ where: { tenantId: tenantAId } })
    const created = await api().post(BASE).set(asManager())
      .send({ name: uniqueName('audit'), channel: 'SMS', body: 'טקסט רגיש {{firstName}}' })
    expect(created.status).toBe(201)

    const rows = await prisma.auditLog.findMany({
      where: { tenantId: tenantAId, entity: 'CommunicationTemplate', entityId: created.body.id },
    })
    expect(await prisma.auditLog.count({ where: { tenantId: tenantAId } })).toBeGreaterThan(before)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.action).toBe('CREATE')
    // `userId`, not `sub` — the bug this codebase fixed in 11 places.
    expect(rows[0]!.userId).toBe(managerId)
    expect(JSON.stringify(rows[0]!.metadata)).not.toContain('טקסט רגיש')
  })

  it('requires authentication', async () => {
    expect((await api().get(BASE)).status).toBe(401)
    expect((await api().post(BASE).send({ name: 'x', channel: 'SMS', body: 'y' })).status).toBe(401)
  })
})
