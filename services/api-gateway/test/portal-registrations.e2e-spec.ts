/**
 * Registration for the personal area, end to end: someone the sign-in cannot
 * find asks for access with a code, the request reaches staff (and becomes a
 * lead when the building is not ours), staff put them on an apartment, and
 * then the sign-in finds them.
 *
 * Its own tenant, set as the public intake's destination. Nothing is sent:
 * SMS and email are fakes that keep the codes, the office alert number is
 * unset, and test/setup.ts forces MESSAGING_SIMULATE.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { SmsService } from '../src/sms/sms.service'
import { SigningEmailSender } from '../src/signatures/signing-email.sender'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const SLUG = `portalreg-${STAMP}`

/** What the fakes were asked to send: codes by phone and by address, and plain messages. */
const sent = {
  sms: new Map<string, string>(),
  email: new Map<string, string>(),
  texts: [] as { to: string; text: string }[],
}

const fakeSms = {
  providerName: 'fake',
  isConfigured: true,
  sendOtp: jest.fn(async (phone: string, code: string) => {
    sent.sms.set(phone, code)
  }),
  sendText: jest.fn(async (phone: string, text: string) => {
    sent.texts.push({ to: phone, text })
  }),
}

const fakeEmail = {
  isConfigured: true,
  sendCode: jest.fn(async () => undefined),
  sendText: jest.fn(async (email: string, _subject: string, lines: string[]) => {
    const code = lines.join(' ').match(/\b(\d{6})\b/)?.[1]
    if (code) sent.email.set(email, code)
    else sent.texts.push({ to: email, text: lines.join('\n') })
  }),
}

describe('Personal-area registration (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let tenantId: string
  let otherTenantId: string
  let managerId: string
  let otherManagerId: string
  let apartmentTwo: string
  let knownResident: string
  let knownRequest: string
  let leadRequest: string

  const api = () => request(app.getHttpServer())
  const staff = (role = 'PROJECT_MANAGER', userId = managerId, tenant = tenantId) => ({
    Authorization: `Bearer ${jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role, tenantId: tenant, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )}`,
  })
  const aMinuteAgo = () => new Date(Date.now() - 60_000).toISOString()

  const askCode = (phone: string, extra: Record<string, unknown> = {}) =>
    api().post('/api/v1/public/portal-registrations/code').send({ phone, renderedAt: aMinuteAgo(), ...extra })

  const registration = (phone: string, code: string, overrides: Record<string, unknown> = {}) => ({
    submissionId: randomUUID(),
    renderedAt: aMinuteAgo(),
    locale: 'he',
    privacyPolicyVersion: '2026-09-08',
    consentContact: true,
    consentPrivacy: true,
    fullName: 'נרשמת בדיקה',
    phone,
    email: '',
    idNumber: '',
    address: 'רחוב ההרשמה 4',
    city: 'ירושלים',
    apartmentNumber: '2',
    relation: 'OWNER',
    code,
    ...overrides,
  })
  const submit = (body: Record<string, unknown>) => api().post('/api/v1/public/portal-registrations').send(body)

  const purge = async () => {
    const stale = await prisma.tenant.findMany({ where: { slug: { startsWith: 'portalreg-' } }, select: { id: true } })
    for (const t of stale) {
      await prisma.portalRegistration.deleteMany({ where: { tenantId: t.id } })
      const leads = await prisma.lead.findMany({ where: { tenantId: t.id }, select: { id: true } })
      await prisma.leadActivity.deleteMany({ where: { leadId: { in: leads.map((l) => l.id) } } })
      await prisma.lead.deleteMany({ where: { tenantId: t.id } })
      await prisma.resident.deleteMany({ where: { tenantId: t.id } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
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
      .overrideProvider(SmsService)
      .useValue(fakeSms)
      .overrideProvider(SigningEmailSender)
      .useValue(fakeEmail)
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
            firstName: 'Reg',
            lastName: tag,
            passwordHash: 'not-a-usable-credential',
            role: 'PROJECT_MANAGER' as never,
          },
        })
      ).id
    managerId = await user(tenantId, 'pm')
    otherManagerId = await user(otherTenantId, 'pm')

    const projectId = (
      await prisma.project.create({
        data: { tenantId, code: SLUG, name: `${SLUG} project`, city: 'ירושלים', projectManagerId: managerId },
      })
    ).id
    const complexId = (await prisma.complex.create({ data: { projectId, name: 'מתחם ההרשמה' } })).id
    const building = await prisma.building.create({
      data: { complexId, address: 'ההרשמה', streetNumber: '4', city: 'ירושלים' },
    })
    const apartmentOne = (await prisma.apartment.create({ data: { buildingId: building.id, apartmentNumber: '1' } })).id
    apartmentTwo = (await prisma.apartment.create({ data: { buildingId: building.id, apartmentNumber: '2' } })).id
    knownResident = (
      await prisma.resident.create({
        data: { tenantId, apartmentId: apartmentOne, firstName: 'רשום', lastName: 'כבר', phone: '0509912490', isActive: true },
      })
    ).id

    process.env.PUBLIC_LEAD_TENANT_ID = tenantId
    delete process.env.PUBLIC_LEAD_TENANT_SLUG
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  it('sends a code to the phone', async () => {
    const res = await askCode('050-9912401')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ channel: 'SMS', sentTo: '050-****401' })
    expect(sent.sms.get('0509912401')).toMatch(/^\d{6}$/)
  })

  it('sends nothing for a filled honeypot, and answers the same', async () => {
    const res = await askCode('0509912499', { company: 'Acme' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ channel: 'SMS' })
    expect(sent.sms.has('0509912499')).toBe(false)
  })

  it('takes a request for a building we know: pending for staff, no lead', async () => {
    const code = sent.sms.get('0509912401')!
    const wrong = await submit(registration('0509912401', code === '000000' ? '111111' : '000000'))
    expect(wrong.status).toBe(401)

    const res = await submit(registration('0509912401', code))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'RECEIVED' })
    const row = await prisma.portalRegistration.findFirstOrThrow({ where: { tenantId, phone: '0509912401' } })
    knownRequest = row.id
    expect(row).toMatchObject({ status: 'PENDING', verifiedVia: 'SMS', leadId: null, apartmentNumber: '2' })
    expect(row.matchedBuildingId).toBeTruthy()
    expect(await prisma.lead.count({ where: { tenantId } })).toBe(0)
  })

  it('spends the code: the same code does not work twice', async () => {
    const again = await submit(registration('0509912401', sent.sms.get('0509912401')!))
    expect(again.status).toBe(401)
  })

  it('brings a pending request up to date instead of doubling it', async () => {
    await askCode('0509912401')
    const res = await submit(registration('0509912401', sent.sms.get('0509912401')!, { apartmentNumber: '1' }))
    expect(res.body).toEqual({ status: 'RECEIVED' })
    const rows = await prisma.portalRegistration.findMany({ where: { tenantId, phone: '0509912401' } })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.apartmentNumber).toBe('1')
    await prisma.portalRegistration.update({ where: { id: rows[0]!.id }, data: { apartmentNumber: '2' } })
  })

  it('takes a request for a building that is not ours as a lead too', async () => {
    await askCode('0509912402')
    const res = await submit(
      registration('0509912402', sent.sms.get('0509912402')!, { address: 'רחוב אחר 99', fullName: 'פונה חדשה' }),
    )
    expect(res.body).toEqual({ status: 'RECEIVED' })
    const row = await prisma.portalRegistration.findFirstOrThrow({ where: { tenantId, phone: '0509912402' } })
    leadRequest = row.id
    expect(row.matchedBuildingId).toBeNull()
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: row.leadId! } })
    expect(lead).toMatchObject({ formType: 'PORTAL_REGISTRATION', firstName: 'פונה', phone: '0509912402' })
  })

  it('tells someone who can already sign in, and stores nothing', async () => {
    await askCode('0509912490')
    const res = await submit(registration('0509912490', sent.sms.get('0509912490')!))
    expect(res.body).toEqual({ status: 'ALREADY_REGISTERED' })
    expect(await prisma.portalRegistration.count({ where: { tenantId, phone: '0509912490' } })).toBe(0)
  })

  it('refuses an invalid ID number before spending the code', async () => {
    await askCode('0509912403')
    const code = sent.sms.get('0509912403')!
    const bad = await submit(registration('0509912403', code, { idNumber: '123456789' }))
    expect(bad.status).toBe(400)
    const good = await submit(registration('0509912403', code, { idNumber: '000000018', apartmentNumber: '9' }))
    expect(good.body).toEqual({ status: 'RECEIVED' })
    const row = await prisma.portalRegistration.findFirstOrThrow({ where: { tenantId, phone: '0509912403' } })
    expect(row.idNumber).not.toContain('000000018')
  })

  describe('without an SMS provider', () => {
    beforeAll(() => {
      fakeSms.isConfigured = false
    })
    afterAll(() => {
      fakeSms.isConfigured = true
    })

    it('asks for an email, then sends the code there', async () => {
      const none = await askCode('0509912404')
      expect(none.status).toBe(400)
      expect(none.body.code).toBe('EMAIL_REQUIRED')

      const res = await askCode('0509912404', { email: 'Reg@Example.com' })
      expect(res.body).toMatchObject({ channel: 'EMAIL', sentTo: 'r***@example.com' })
      expect(sent.email.get('reg@example.com')).toMatch(/^\d{6}$/)
    })

    it('takes the emailed code only with that email', async () => {
      const code = sent.email.get('reg@example.com')!
      const other = await submit(registration('0509912404', code, { email: 'someone@example.com' }))
      expect(other.status).toBe(401)

      await askCode('0509912404', { email: 'reg@example.com' })
      const res = await submit(registration('0509912404', sent.email.get('reg@example.com')!, { email: 'reg@example.com' }))
      expect(res.body).toEqual({ status: 'RECEIVED' })
      const row = await prisma.portalRegistration.findFirstOrThrow({ where: { tenantId, phone: '0509912404' } })
      expect(row).toMatchObject({ verifiedVia: 'EMAIL', email: 'reg@example.com' })
    })
  })

  it('shows staff the request with the building’s apartments, the right one marked', async () => {
    const list = await api().get('/api/v1/portal-registrations?status=PENDING').set(staff())
    expect(list.status).toBe(200)
    expect(list.body.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining([knownRequest, leadRequest]))
    expect(list.body.find((r: { id: string }) => r.id === knownRequest).building).toMatchObject({ address: 'ההרשמה' })

    const doc = await api().get(`/api/v1/portal-registrations/${knownRequest}`).set(staff())
    expect(doc.status).toBe(200)
    expect(doc.body.building.apartments.map((a: { apartmentNumber: string }) => a.apartmentNumber)).toEqual(['1', '2'])
    expect(doc.body.building.apartments.find((a: { suggested: boolean }) => a.suggested).id).toBe(apartmentTwo)
    expect(doc.body.building.apartments[0].residents).toEqual([
      expect.objectContaining({ id: knownResident, phone: '0509912490' }),
    ])
  })

  it('does not replace a different phone on file unless told to', async () => {
    const res = await api()
      .post(`/api/v1/portal-registrations/${knownRequest}/approve`)
      .set(staff())
      .send({ residentId: knownResident })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('PHONE_ON_FILE')
  })

  it('lets only the roles that issue links decide', async () => {
    const res = await api()
      .post(`/api/v1/portal-registrations/${knownRequest}/approve`)
      .set(staff('LAWYER'))
      .send({ apartmentId: apartmentTwo })
    expect(res.status).toBe(403)
  })

  it('approves onto a new resident file, tells the person, and the sign-in finds them', async () => {
    const res = await api()
      .post(`/api/v1/portal-registrations/${knownRequest}/approve`)
      .set(staff())
      .send({ apartmentId: apartmentTwo })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'APPROVED', notifiedVia: 'SMS' })
    expect(res.body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/972509912401\?text=/)
    expect(sent.texts.find((t) => t.to === '0509912401')?.text).toContain('אושרה')

    const resident = await prisma.resident.findUniqueOrThrow({ where: { id: res.body.residentId } })
    expect(resident).toMatchObject({ apartmentId: apartmentTwo, phone: '0509912401', firstName: 'נרשמת', lastName: 'בדיקה' })

    await api().post('/api/v1/auth/otp/send').send({ phone: '0509912401' }).expect(200)
    const signIn = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ phone: '0509912401', code: sent.sms.get('0509912401') })
    expect(signIn.status).toBe(200)
    expect(signIn.body.residentId).toBe(res.body.residentId)
  })

  it('does not decide the same request twice', async () => {
    const res = await api()
      .post(`/api/v1/portal-registrations/${knownRequest}/approve`)
      .set(staff())
      .send({ apartmentId: apartmentTwo })
    expect(res.status).toBe(409)
  })

  it('declines a request, with a note', async () => {
    const res = await api()
      .post(`/api/v1/portal-registrations/${leadRequest}/reject`)
      .set(staff())
      .send({ note: 'הבניין לא בטיפולנו' })
    expect(res.body).toEqual({ status: 'REJECTED' })
    const row = await prisma.portalRegistration.findUniqueOrThrow({ where: { id: leadRequest } })
    expect(row).toMatchObject({ status: 'REJECTED', decisionNote: 'הבניין לא בטיפולנו', decidedById: managerId })
  })

  it('shows another tenant’s staff nothing', async () => {
    const list = await api().get('/api/v1/portal-registrations').set(staff('PROJECT_MANAGER', otherManagerId, otherTenantId))
    expect(list.body).toEqual([])
    const doc = await api()
      .get(`/api/v1/portal-registrations/${knownRequest}`)
      .set(staff('PROJECT_MANAGER', otherManagerId, otherTenantId))
    expect(doc.status).toBe(404)
  })
})
