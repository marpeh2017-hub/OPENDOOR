/**
 * Protocols started on the website, end to end: an owner of a building that
 * is not a project starts the representation protocol, it becomes a lead,
 * neighbours sign through the shared link, and staff see it all.
 *
 * Its own tenant, set as the public intake's destination. Nothing is sent:
 * the office alert number is unset for the suite, and test/setup.ts forces
 * MESSAGING_SIMULATE.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { isApprovedSnapshot } from '../src/forms/form-data'
import { REPRESENTATION_PROTOCOL } from '../../../packages/api-contracts/src/representation-protocol'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const SLUG = `webforms-${STAMP}`
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('Website representation protocols (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let tenantId: string
  let managerId: string
  let otherTenantId: string
  let otherManagerId: string
  let shareToken: string
  const submissionId = randomUUID()

  const api = () => request(app.getHttpServer())
  const staff = (userId = managerId, tenant = tenantId) => ({
    Authorization: `Bearer ${jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role: 'PROJECT_MANAGER', tenantId: tenant, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )}`,
  })
  const aMinuteAgo = () => new Date(Date.now() - 60_000).toISOString()

  const startBody = (overrides: Record<string, unknown> = {}) => ({
    submissionId,
    renderedAt: aMinuteAgo(),
    locale: 'he',
    privacyPolicyVersion: '2026-09-08',
    consentContact: true,
    consentPrivacy: true,
    templateId: 'representation-protocol',
    text: REPRESENTATION_PROTOCOL,
    building: { address: 'רחוב האתר 5', city: 'ירושלים' },
    meeting: { meetingDate: '2026-11-01', meetingPlace: 'לובי הבניין' },
    members: [
      { fullName: 'יוזמת הבדיקה', apartmentNumber: '3' },
      { fullName: 'שכן הבדיקה', apartmentNumber: '7' },
    ],
    initiator: {
      apartmentNumber: '3',
      fullName: 'יוזמת הבדיקה',
      idNumber: '123456782',
      phone: '0509912201',
      email: 'initiator@example.com',
      signatureImage: PNG,
      confirmedRead: true,
    },
    ...overrides,
  })

  const neighbour = (overrides: Record<string, unknown> = {}) => ({
    renderedAt: aMinuteAgo(),
    consentPrivacy: true,
    apartmentNumber: '7',
    fullName: 'שכן הבדיקה',
    idNumber: '000000018',
    phone: '',
    email: '',
    signatureImage: PNG,
    confirmedRead: true,
    ...overrides,
  })

  const purge = async () => {
    const stale = await prisma.tenant.findMany({ where: { slug: { startsWith: 'webforms-' } }, select: { id: true } })
    for (const t of stale) {
      await prisma.publicForm.deleteMany({ where: { tenantId: t.id } })
      const leads = await prisma.lead.findMany({ where: { tenantId: t.id }, select: { id: true } })
      await prisma.leadActivity.deleteMany({ where: { leadId: { in: leads.map((l) => l.id) } } })
      await prisma.lead.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } }).catch(() => undefined)
    }
  }

  beforeAll(async () => {
    delete process.env.LEAD_NOTIFY_PHONE
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
    tenantId = (await prisma.tenant.create({ data: { name: SLUG, slug: SLUG } })).id
    otherTenantId = (await prisma.tenant.create({ data: { name: `${SLUG}-b`, slug: `${SLUG}-b` } })).id
    const user = async (tenant: string, tag: string) =>
      (
        await prisma.user.create({
          data: {
            tenantId: tenant,
            email: `${SLUG}-${tag}@example.com`,
            firstName: 'Web',
            lastName: tag,
            passwordHash: 'not-a-usable-credential',
            role: 'PROJECT_MANAGER' as never,
          },
        })
      ).id
    managerId = await user(tenantId, 'pm')
    otherManagerId = await user(otherTenantId, 'pm')
    process.env.PUBLIC_LEAD_TENANT_ID = tenantId
    delete process.env.PUBLIC_LEAD_TENANT_SLUG
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  it('accepts the current wording: its hash is the approved one', () => {
    // When this fails, the wording in api-contracts changed: add the new hash
    // to APPROVED_SNAPSHOT_HASHES (src/forms/form-data.ts).
    expect(isApprovedSnapshot(REPRESENTATION_PROTOCOL, 'representation-protocol')).toBe(true)
  })

  it('refuses any other wording', async () => {
    const tampered = { ...REPRESENTATION_PROTOCOL, title: 'נוסח אחר' }
    const res = await api().post('/api/v1/public/forms').send(startBody({ submissionId: randomUUID(), text: tampered }))
    expect(res.status).toBe(400)
  })

  it('starts a protocol: a lead, the initiator’s signed row, and the neighbours’ link', async () => {
    const res = await api().post('/api/v1/public/forms').send(startBody())
    expect(res.status).toBe(200)
    shareToken = res.body.shareToken
    expect(shareToken).toMatch(/^[\w-]{32}$/)

    const lead = await prisma.lead.findFirstOrThrow({ where: { tenantId, submissionId } })
    expect(lead).toMatchObject({ formType: 'PROTOCOL', source: 'WEBSITE', firstName: 'יוזמת' })
    expect(lead.notes).toContain('פרוטוקול מינוי נציגות')

    const form = await prisma.publicForm.findUniqueOrThrow({ where: { shareToken }, include: { signatures: true } })
    expect(form.leadId).toBe(lead.id)
    expect(form.signatures).toHaveLength(1)
    expect(form.signatures[0]).toMatchObject({ isInitiator: true, apartmentNumber: '3' })
    expect(form.signatures[0].idNumber).toMatch(/^enc:v1:/)
  })

  it('gives a retry of the same submission the same link', async () => {
    const res = await api().post('/api/v1/public/forms').send(startBody())
    expect(res.body.shareToken).toBe(shareToken)
    expect(await prisma.publicForm.count({ where: { tenantId } })).toBe(1)
  })

  it('stores nothing from a filled honeypot', async () => {
    const id = randomUUID()
    const res = await api().post('/api/v1/public/forms').send(startBody({ submissionId: id, company: 'spam inc' }))
    expect(res.status).toBe(200)
    expect(res.body.shareToken).toBeNull()
    expect(await prisma.lead.count({ where: { tenantId, submissionId: id } })).toBe(0)
  })

  it('shows the neighbours the protocol, the meeting and the members, and nobody’s details', async () => {
    const res = await api().get(`/api/v1/public/forms/${shareToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ compoundName: 'רחוב האתר 5', signed: 1, open: true })
    expect(res.body.text.title).toBe(REPRESENTATION_PROTOCOL.title)
    expect(res.body.meeting).toMatchObject({ meetingDate: '2026-11-01', meetingPlace: 'לובי הבניין' })
    expect(res.body.members).toHaveLength(2)
    const body = JSON.stringify(res.body)
    expect(body).not.toContain('0509912201')
    expect(body).not.toContain('123456782')
  })

  it('lets a neighbour sign, once', async () => {
    const res = await api().post(`/api/v1/public/forms/${shareToken}/signatures`).send(neighbour())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ signed: true, count: 2 })
    const again = await api().post(`/api/v1/public/forms/${shareToken}/signatures`).send(neighbour())
    expect(again.status).toBe(409)
    const badId = await api()
      .post(`/api/v1/public/forms/${shareToken}/signatures`)
      .send(neighbour({ apartmentNumber: '9', idNumber: '123456789' }))
    expect(badId.status).toBe(400)
  })

  it('does not store a signature made faster than a person could', async () => {
    const res = await api()
      .post(`/api/v1/public/forms/${shareToken}/signatures`)
      .send(neighbour({ apartmentNumber: '9', fullName: 'בוט', renderedAt: new Date().toISOString() }))
    expect(res.status).toBe(200)
    expect(await prisma.publicFormSignature.count({ where: { publicForm: { shareToken } } })).toBe(2)
  })

  it('shows staff the list, and the document with ID numbers and the members matched', async () => {
    const list = await api().get('/api/v1/website-forms').set(staff())
    expect(list.status).toBe(200)
    expect(list.body).toEqual([
      expect.objectContaining({ compoundName: 'רחוב האתר 5', signatures: 2, initiator: { fullName: 'יוזמת הבדיקה', phone: '0509912201' } }),
    ])
    const doc = await api().get(`/api/v1/website-forms/${list.body[0].id}`).set(staff())
    expect(doc.status).toBe(200)
    expect(doc.body.rows.map((r: { idNumber: string }) => r.idNumber)).toEqual(['123456782', '000000018'])
    expect(doc.body.members).toEqual([
      expect.objectContaining({ fullName: 'יוזמת הבדיקה', signed: true, idNumber: '123456782' }),
      expect.objectContaining({ fullName: 'שכן הבדיקה', signed: true, idNumber: '000000018' }),
    ])
    expect(doc.body.lead).toMatchObject({ firstName: 'יוזמת' })
    expect(doc.body.shareUrl).toMatch(new RegExp(`/he/forms/join/${shareToken}$`))
  })

  it('finds nothing for another tenant’s staff', async () => {
    const list = await api().get('/api/v1/website-forms').set(staff(otherManagerId, otherTenantId))
    expect(list.body).toEqual([])
    const form = await prisma.publicForm.findUniqueOrThrow({ where: { shareToken } })
    const doc = await api().get(`/api/v1/website-forms/${form.id}`).set(staff(otherManagerId, otherTenantId))
    expect(doc.status).toBe(404)
  })

  it('closes the link: no more signatures', async () => {
    const form = await prisma.publicForm.findUniqueOrThrow({ where: { shareToken } })
    const closed = await api().patch(`/api/v1/website-forms/${form.id}`).set(staff()).send({ status: 'CLOSED' })
    expect(closed.status).toBe(200)
    const res = await api()
      .post(`/api/v1/public/forms/${shareToken}/signatures`)
      .send(neighbour({ apartmentNumber: '11', idNumber: '000000026' }))
    expect(res.status).toBe(410)
    expect((await api().get(`/api/v1/public/forms/${shareToken}`)).body.open).toBe(false)
    const notes = await prisma.leadActivity.findMany({ where: { leadId: form.leadId! }, select: { type: true } })
    expect(notes.map((n) => n.type)).toContain('public_protocol_closed')
  })

  it('reopens the link', async () => {
    const form = await prisma.publicForm.findUniqueOrThrow({ where: { shareToken } })
    const reopened = await api().patch(`/api/v1/website-forms/${form.id}`).set(staff()).send({ status: 'OPEN' })
    expect(reopened.body).toEqual({ status: 'OPEN' })
    expect((await api().get(`/api/v1/public/forms/${shareToken}`)).body.open).toBe(true)
  })
})
