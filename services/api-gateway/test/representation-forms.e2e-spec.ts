/**
 * Digital forms (the representation-appointment protocol), end to end.
 *
 * A tenant of its own, one complex, four owners: one reachable by SMS (who
 * is also a portal resident and a representation member), one by email only
 * (a member too), one with no contact at all (signs on paper), and a
 * co-owner of the first apartment. The suite runs the form from draft to
 * completion through the HTTP API and checks, at each step, what is stored
 * and who may see it.
 *
 * A form is signed with the personal link alone (the owner's decision,
 * 2026-10-10); a document package still needs the one-time code, and the
 * suite checks both.
 *
 * Nothing is sent: SmsService is replaced by a recording fake that reports
 * itself configured (so sending behaves as it does with a provider), and no
 * email provider is configured in tests.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { FieldEncryptionService } from '../src/crypto/field-encryption.service'
import { SmsService } from '../src/sms/sms.service'
// The real wording, as the CRM sends it.
import { REPRESENTATION_PROTOCOL } from '../../../packages/api-contracts/src/representation-protocol'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const SLUG = `forms-${STAMP}`
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
/** A valid Israeli ID number (check digit 2). */
const ID_NUMBER = '123456782'

/** An SMS transport that records instead of sending. */
const fakeSms = {
  providerName: 'fake',
  isConfigured: true,
  sendOtp: jest.fn(async () => undefined),
  sendText: jest.fn(async () => undefined),
}

describe('Representation protocol forms (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService

  let tenantId: string
  let otherTenantId: string
  let managerId: string
  let otherManagerId: string
  let projectId: string
  let complexId: string
  const apartments: Record<'a1' | 'a2' | 'a3', string> = { a1: '', a2: '', a3: '' }
  const owners: Record<'sms' | 'email' | 'paper' | 'coOwner', string> = { sms: '', email: '', paper: '', coOwner: '' }
  const residents: Record<'sms' | 'paper', string> = { sms: '', paper: '' }
  let formId: string

  const api = () => request(app.getHttpServer())

  const staffToken = (userId: string, tenant: string) =>
    jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role: 'PROJECT_MANAGER', tenantId: tenant, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )
  const staff = () => ({ Authorization: `Bearer ${staffToken(managerId, tenantId)}` })

  const residentAuth = (residentId: string) => ({
    Authorization: `Bearer ${jwt.sign(
      { sub: residentId, role: 'RESIDENT', tenantId, projectId, residentId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )}`,
  })

  const recordOf = (ownerId: string) =>
    prisma.signatureRecord.findFirstOrThrow({ where: { packageId: formId, ownerId } })

  /** The live link for an owner's row: all a form needs to be signed. */
  const tokenOf = async (ownerId: string) => {
    const record = await recordOf(ownerId)
    return (await prisma.signingSession.findUniqueOrThrow({ where: { recordId: record.id } })).token
  }

  const row = (overrides: Record<string, unknown> = {}) => ({
    fullName: 'ישראל ישראלי',
    idNumber: ID_NUMBER,
    phone: '050-9912101',
    email: 'owner1@example.com',
    signatureImage: PNG,
    confirmedRead: true,
    ...overrides,
  })

  const purge = async () => {
    const stale = await prisma.tenant.findMany({ where: { slug: { startsWith: 'forms-' } }, select: { id: true } })
    for (const t of stale) {
      const records = await prisma.signatureRecord.findMany({ where: { tenantId: t.id }, select: { id: true } })
      await prisma.signingSession.deleteMany({ where: { recordId: { in: records.map((r) => r.id) } } })
      await prisma.signatureEvent.deleteMany({ where: { package: { tenantId: t.id } } })
      await prisma.signatureEvidence.deleteMany({ where: { tenantId: t.id } })
      await prisma.signatureRecord.deleteMany({ where: { tenantId: t.id } })
      await prisma.signaturePackage.deleteMany({ where: { tenantId: t.id } })
      await prisma.document.deleteMany({ where: { tenantId: t.id } })
      await prisma.ownerApartment.deleteMany({ where: { owner: { tenantId: t.id } } })
      await prisma.owner.deleteMany({ where: { tenantId: t.id } })
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
      .overrideProvider(SmsService)
      .useValue(fakeSms)
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
    const user = (tenant: string, tag: string) =>
      prisma.user.create({
        data: {
          tenantId: tenant,
          email: `${SLUG}-${tag}@example.com`,
          firstName: 'Forms',
          lastName: tag,
          passwordHash: 'not-a-usable-credential',
          role: 'PROJECT_MANAGER' as never,
        },
        select: { id: true },
      })
    managerId = (await user(tenantId, 'pm')).id
    otherManagerId = (await user(otherTenantId, 'pm')).id

    projectId = (
      await prisma.project.create({
        data: { tenantId, code: SLUG, name: `${SLUG} project`, city: 'ירושלים', projectManagerId: managerId },
      })
    ).id
    complexId = (await prisma.complex.create({ data: { projectId, name: 'מתחם הבדיקה' } })).id
    const building = await prisma.building.create({ data: { complexId, address: 'רחוב הבדיקה', streetNumber: '7' } })
    for (const [k, number] of [['a1', '1'], ['a2', '2'], ['a3', '3']] as const) {
      apartments[k] = (await prisma.apartment.create({ data: { buildingId: building.id, apartmentNumber: number } })).id
    }

    const resident = (apartmentId: string, firstName: string) =>
      prisma.resident.create({
        data: { tenantId, apartmentId, firstName, lastName: 'בדיקה', phone: '0509912190', isActive: true },
        select: { id: true },
      })
    residents.sms = (await resident(apartments.a1, 'אבי')).id
    residents.paper = (await resident(apartments.a3, 'גיל')).id

    const owner = (data: { fullName: string; phone?: string; email?: string; residentId?: string }) =>
      prisma.owner.create({ data: { tenantId, ...data }, select: { id: true } })
    owners.sms = (await owner({ fullName: 'אבי בדיקה', phone: '0509912101', residentId: residents.sms })).id
    owners.email = (await owner({ fullName: 'בתיה בדיקה', email: 'owner2@example.com' })).id
    owners.paper = (await owner({ fullName: 'גיל בדיקה', residentId: residents.paper })).id
    // An ID number on file, to check a signature against it.
    const encryption = app.get(FieldEncryptionService)
    owners.coOwner = (
      await prisma.owner.create({
        data: { tenantId, fullName: 'דנה בדיקה', phone: '0509912104', nationalId: encryption.encrypt('000000018') },
        select: { id: true },
      })
    ).id

    const hold = (ownerId: string, apartmentId: string, shareNumerator = 1, shareDenominator = 1) =>
      prisma.ownerApartment.create({ data: { ownerId, apartmentId, shareNumerator, shareDenominator } })
    await hold(owners.sms, apartments.a1, 1, 2)
    await hold(owners.coOwner, apartments.a1, 1, 2)
    await hold(owners.email, apartments.a2)
    await hold(owners.paper, apartments.a3)
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  it('offers the complex as a place for a form, with its owners counted', async () => {
    const res = await api().get('/api/v1/forms/scopes').set(staff())
    expect(res.status).toBe(200)
    const project = res.body.find((p: { id: string }) => p.id === projectId)
    expect(project.complexes).toEqual([
      expect.objectContaining({ id: complexId, name: 'מתחם הבדיקה', buildings: 1, owners: 4 }),
    ])
  })

  it('creates a draft with a row per owner and apartment, the complex name filled in', async () => {
    const res = await api()
      .post('/api/v1/forms')
      .set(staff())
      .send({ templateId: 'representation-protocol', projectId, complexId, text: REPRESENTATION_PROTOCOL })
    expect(res.status).toBe(201)
    formId = res.body.id
    expect(res.body.status).toBe('DRAFT')
    expect(res.body.formVersion).toBe(REPRESENTATION_PROTOCOL.version)
    expect(res.body.meeting).toEqual({
      compoundName: 'מתחם הבדיקה',
      address: 'רחוב הבדיקה 7',
      meetingDate: '',
      meetingPlace: '',
    })
    expect(res.body.records).toHaveLength(4)
    expect(res.body.records.map((r: { apartmentNumber: string }) => r.apartmentNumber)).toEqual(['1', '1', '2', '3'])
  })

  it('refuses a snapshot that is not the protocol', async () => {
    const res = await api()
      .post('/api/v1/forms')
      .set(staff())
      .send({ templateId: 'representation-protocol', projectId, complexId, text: { id: 'representation-protocol' } })
    expect(res.status).toBe(400)
  })

  it('will not send until the meeting details and the members are filled in', async () => {
    const res = await api().post(`/api/v1/forms/${formId}/send`).set(staff())
    expect(res.status).toBe(400)
    expect(res.body.fields).toEqual(['תאריך', 'מקום הישיבה', 'חברי הנציגות'])
  })

  it('takes members only from the complex’s owners', async () => {
    const wrong = await api()
      .patch(`/api/v1/forms/${formId}`)
      .set(staff())
      .send({ representatives: [{ ownerId: owners.paper, apartmentId: apartments.a1 }] })
    expect(wrong.status).toBe(400)

    const res = await api()
      .patch(`/api/v1/forms/${formId}`)
      .set(staff())
      .send({
        meeting: { meetingDate: '2026-10-20', meetingPlace: 'לובי הבניין' },
        representatives: [
          { ownerId: owners.sms, apartmentId: apartments.a1 },
          { ownerId: owners.email, apartmentId: apartments.a2 },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.representatives.map((m: { fullName: string }) => m.fullName)).toEqual(['אבי בדיקה', 'בתיה בדיקה'])
  })

  it('sends: SMS to mobiles, email to the email-only owner, paper for the one with neither', async () => {
    const res = await api().post(`/api/v1/forms/${formId}/send`).set(staff())
    expect(res.status).toBe(201)
    expect(res.body.delivery).toEqual({ SMS: 2, EMAIL: 1, WHATSAPP: 0, UNSENT: 0, NONE: 1, FAILED: 0 })
    expect(fakeSms.sendText).toHaveBeenCalledWith('0509912101', expect.stringContaining('/he/sign/'))

    const pkg = await prisma.signaturePackage.findUniqueOrThrow({ where: { id: formId } })
    expect(pkg.status).toBe('SENT')
    expect(pkg.documentHash).toMatch(/^[0-9a-f]{64}$/)
    expect((await recordOf(owners.paper)).deliveredVia).toBe('NONE')
    expect((await recordOf(owners.email)).deliveredVia).toBe('EMAIL')
    // Edits stop at sending: what was sent is what is signed.
    const edit = await api().patch(`/api/v1/forms/${formId}`).set(staff()).send({ meeting: { meetingPlace: 'מקלט' } })
    expect(edit.status).toBe(400)
  })

  it('gives the resident a "to sign" entry with the live link', async () => {
    const res = await api().get('/api/v1/portal/forms').set(residentAuth(residents.sms))
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ packageId: formId, status: 'PENDING', apartmentNumber: '1', isRepresentative: true })
    const session = await prisma.signingSession.findUniqueOrThrow({ where: { recordId: (await recordOf(owners.sms)).id } })
    expect(res.body[0].signPath).toBe(`/sign/${session.token}`)
  })

  it('shows a link holder the text and the members, but not the owner’s contact details', async () => {
    const token = await tokenOf(owners.sms)
    const res = await api().get(`/api/v1/signatures/portal/${token}`)
    expect(res.status).toBe(200)
    expect(res.body.form.text.title).toBe(REPRESENTATION_PROTOCOL.title)
    expect(res.body.form.meeting.meetingPlace).toBe('לובי הבניין')
    expect(res.body.form.representatives).toEqual([
      { fullName: 'אבי בדיקה', apartmentNumber: '1' },
      { fullName: 'בתיה בדיקה', apartmentNumber: '2' },
    ])
    expect(res.body.form.signer).toEqual({ fullName: 'אבי בדיקה', apartmentNumber: '1', isRepresentative: true })
    expect(JSON.stringify(res.body)).not.toContain('9912101')
  })

  it('fills in the contact details for the owner signed in to the personal area', async () => {
    const token = await tokenOf(owners.sms)
    const mine = await api().get(`/api/v1/signatures/portal/${token}`).set(residentAuth(residents.sms))
    expect(mine.body.form.signer.phone).toBe('0509912101')
    // Somebody else signed in (a resident of another apartment) gets nothing.
    const other = await api().get(`/api/v1/signatures/portal/${token}`).set(residentAuth(residents.paper))
    expect(other.body.form.signer.phone).toBeUndefined()
  })

  it('sends the code to the email-only owner by email', async () => {
    const record = await recordOf(owners.email)
    const { token } = await prisma.signingSession.findUniqueOrThrow({ where: { recordId: record.id } })
    const res = await api().post(`/api/v1/signatures/portal/${token}/otp`)
    expect(res.status).toBe(201)
    expect(res.body.channel).toBe('EMAIL')
  })

  it('refuses a row with a wrong ID number, and stores nothing', async () => {
    const token = await tokenOf(owners.sms)
    const res = await api().post(`/api/v1/signatures/portal/${token}/sign`).send(row({ idNumber: '123456789' }))
    expect(res.status).toBe(400)
    expect(res.body.fields).toEqual(['מספר תעודת זהות'])
    expect((await recordOf(owners.sms)).status).toBe('PENDING')
  })

  it('signs with the link alone, the row and the drawn signature; the ID number is stored encrypted', async () => {
    const token = await tokenOf(owners.sms)
    const res = await api()
      .post(`/api/v1/signatures/portal/${token}/sign`)
      .set(residentAuth(residents.sms))
      .send(row())
    expect(res.status).toBe(201)

    const record = await recordOf(owners.sms)
    expect(record.status).toBe('SIGNED')
    expect(record.signatureImage).toBe(PNG)
    const stored = JSON.parse(record.signerData as string)
    // No ID number on this owner's file: nothing to compare.
    expect(stored).toMatchObject({ fullName: 'ישראל ישראלי', channel: 'PORTAL', confirmedRead: true, idMatchesFile: null })
    expect(stored.idNumber).toMatch(/^enc:v1:/)
    expect(JSON.stringify(stored)).not.toContain(ID_NUMBER)
    expect((await prisma.signaturePackage.findUniqueOrThrow({ where: { id: formId } })).status).toBe('PARTIALLY_SIGNED')

    // The link again: it shows the form as signed, ID number masked, and
    // signing again is refused.
    const again = await api().get(`/api/v1/signatures/portal/${token}`)
    expect(again.status).toBe(200)
    expect(again.body.form.signed).toMatchObject({ fullName: 'ישראל ישראלי', idNumber: '•••••6782' })
    const twice = await api().post(`/api/v1/signatures/portal/${token}/sign`).send(row())
    expect(twice.status).toBe(401)
  })

  it('has no refusal on a form', async () => {
    const token = await tokenOf(owners.email)
    const res = await api().post(`/api/v1/signatures/portal/${token}/decline`).send({ reason: 'לא' })
    expect(res.status).toBe(400)
    expect((await recordOf(owners.email)).status).toBe('PENDING')
  })

  it('records a signature on paper, with the scanned page attached', async () => {
    const document = await prisma.document.create({
      data: {
        tenantId,
        projectId,
        category: 'CONTRACT' as never,
        title: 'פרוטוקול חתום ידנית',
        fileName: 'scan.pdf',
        fileSize: 1000,
        mimeType: 'application/pdf',
        s3Key: `${SLUG}/scan.pdf`,
        s3Bucket: 'test',
        createdById: managerId,
      },
    })
    const record = await recordOf(owners.paper)
    const missing = await api()
      .post(`/api/v1/forms/${formId}/records/${record.id}/paper`)
      .set(staff())
      .send({ fullName: 'גיל בדיקה', signedDate: '2026-10-21', documentId: 'not-a-document' })
    expect(missing.status).toBe(400)

    const res = await api()
      .post(`/api/v1/forms/${formId}/records/${record.id}/paper`)
      .set(staff())
      .send({ fullName: 'גיל בדיקה', idNumber: '000000018', signedDate: '2026-10-21', documentId: document.id })
    expect(res.status).toBe(201)
    const signed = await recordOf(owners.paper)
    expect(signed).toMatchObject({ status: 'SIGNED', method: 'WET', evidenceDocId: document.id })
  })

  it('tracks progress by owners, apartments and ownership share', async () => {
    const res = await api().get(`/api/v1/forms/${formId}`).set(staff())
    expect(res.status).toBe(200)
    // Apartment 1 is half signed (one of two owners), apartment 3 fully.
    expect(res.body.progress).toEqual({
      owners: 4,
      ownersSigned: 2,
      // The owner who signed through the link opened it; the paper signer did not.
      ownersOpened: 1,
      apartments: 3,
      apartmentsSigned: 1,
      sharePercent: 50,
    })
    const sms = res.body.records.find((r: { ownerId: string }) => r.ownerId === owners.sms)
    expect(sms).toMatchObject({ signedVia: 'PORTAL', isRepresentative: true, deliveredVia: 'SMS' })
  })

  it('gives staff the combined document, ID numbers decrypted', async () => {
    const res = await api().get(`/api/v1/forms/${formId}/document`).set(staff())
    expect(res.status).toBe(200)
    expect(res.body.rows).toEqual([
      expect.objectContaining({ apartmentNumber: '1', fullName: 'ישראל ישראלי', idNumber: ID_NUMBER, method: 'DIGITAL' }),
      expect.objectContaining({ apartmentNumber: '3', fullName: 'גיל בדיקה', idNumber: '000000018', method: 'WET' }),
    ])
    expect(res.body.representatives[0]).toMatchObject({ signed: true, idNumber: ID_NUMBER, signatureImage: PNG })
    expect(res.body.representatives[1]).toMatchObject({ signed: false, signatureImage: null })
  })

  it('gives a representation member the combined document in the portal', async () => {
    const res = await api().get(`/api/v1/portal/forms/${formId}`).set(residentAuth(residents.sms))
    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('COMBINED')
    expect(res.body.rows).toHaveLength(2)
  })

  it('shows any other owner only their own row, with the ID number masked', async () => {
    const res = await api().get(`/api/v1/portal/forms/${formId}`).set(residentAuth(residents.paper))
    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('OWN')
    expect(res.body.rows).toEqual([expect.objectContaining({ apartmentNumber: '3', idNumber: '•••••0018' })])
    expect(JSON.stringify(res.body)).not.toContain(ID_NUMBER)
    expect(res.body.representatives).toEqual([
      { fullName: 'אבי בדיקה', apartmentNumber: '1', signed: true },
      { fullName: 'בתיה בדיקה', apartmentNumber: '2', signed: false },
    ])
  })

  it('finds nothing for another tenant’s staff', async () => {
    const res = await api()
      .get(`/api/v1/forms/${formId}`)
      .set({ Authorization: `Bearer ${staffToken(otherManagerId, otherTenantId)}` })
    expect(res.status).toBe(404)
  })

  it('gives staff an owner’s link to send on WhatsApp, and logs it', async () => {
    const coOwner = await recordOf(owners.coOwner)
    const res = await api()
      .post(`/api/v1/forms/${formId}/records/${coOwner.id}/link`)
      .set(staff())
      .send({ via: 'WHATSAPP' })
    expect(res.status).toBe(201)
    const session = await prisma.signingSession.findUniqueOrThrow({ where: { recordId: coOwner.id } })
    expect(res.body.url).toContain(session.token)
    expect(res.body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/972509912104\?text=/)
    expect(decodeURIComponent(res.body.whatsappUrl.split('text=')[1])).toBe(res.body.text)
    expect((await recordOf(owners.coOwner)).deliveredVia).toBe('WHATSAPP')
    expect(
      await prisma.signatureEvent.count({ where: { packageId: formId, type: 'LINK_SHARED', recordId: coOwner.id } }),
    ).toBe(1)

    // No mobile on file: the link can be copied, not sent on WhatsApp.
    const emailOwner = await recordOf(owners.email)
    const noPhone = await api()
      .post(`/api/v1/forms/${formId}/records/${emailOwner.id}/link`)
      .set(staff())
      .send({ via: 'WHATSAPP' })
    expect(noPhone.status).toBe(400)
    const copied = await api()
      .post(`/api/v1/forms/${formId}/records/${emailOwner.id}/link`)
      .set(staff())
      .send({ via: 'COPY' })
    expect(copied.status).toBe(201)
    expect(copied.body.whatsappUrl).toBeNull()
  })

  it('reminds once a day at most, keeping the link already sent', async () => {
    const coOwner = await recordOf(owners.coOwner)
    const before = await prisma.signingSession.findUniqueOrThrow({ where: { recordId: coOwner.id } })
    const one = await api().post(`/api/v1/forms/${formId}/records/${coOwner.id}/remind`).set(staff())
    expect(one.status).toBe(201)
    expect(one.body.channel).toBe('SMS')
    const after = await prisma.signingSession.findUniqueOrThrow({ where: { recordId: coOwner.id } })
    expect(after.token).toBe(before.token)

    const all = await api().post(`/api/v1/forms/${formId}/remind`).set(staff())
    expect(all.status).toBe(201)
    // The co-owner was just reminded; the email-only owner is the one sent.
    expect(all.body).toEqual({ sent: 1, skippedRecent: 1, noChannel: 0, whatsApp: 0, failed: 0 })
  })

  it('completes when the last owner signs, flagging an ID number unlike the file', async () => {
    for (const ownerId of [owners.email, owners.coOwner]) {
      const token = await tokenOf(ownerId)
      const res = await api().post(`/api/v1/signatures/portal/${token}/sign`).send(row({ phone: '', email: '' }))
      expect(res.status).toBe(201)
    }
    const pkg = await prisma.signaturePackage.findUniqueOrThrow({ where: { id: formId } })
    expect(pkg.status).toBe('COMPLETED')

    // The co-owner's file says 000000018, the row says 123456782: signed,
    // and shown to staff. The email-only owner has no number on file.
    const detail = await api().get(`/api/v1/forms/${formId}`).set(staff())
    const flag = (ownerId: string) =>
      detail.body.records.find((r: { ownerId: string }) => r.ownerId === ownerId).idMismatch
    expect(flag(owners.coOwner)).toBe(true)
    expect(flag(owners.email)).toBe(false)
    const list = await api().get('/api/v1/forms').set(staff())
    expect(list.body.find((f: { id: string }) => f.id === formId).progress.sharePercent).toBe(100)
  })

  it('still requires the one-time code for a package that signs a document', async () => {
    const pkg = await prisma.signaturePackage.create({
      data: { tenantId, projectId, title: `${SLUG} document`, status: 'SENT', createdById: managerId },
    })
    const record = await prisma.signatureRecord.create({
      data: { tenantId, packageId: pkg.id, ownerId: owners.paper, apartmentId: apartments.a3, status: 'PENDING' },
    })
    const token = `doc-${STAMP}-${'x'.repeat(40)}`
    await prisma.signingSession.create({
      data: { recordId: record.id, token, expiresAt: new Date(Date.now() + 3_600_000) },
    })
    const res = await api().post(`/api/v1/signatures/portal/${token}/sign`).send({})
    expect(res.status).toBe(401)
    expect((await prisma.signatureRecord.findUniqueOrThrow({ where: { id: record.id } })).status).toBe('PENDING')
  })

  it('cancels a draft, and its links stop working', async () => {
    const draft = await api()
      .post('/api/v1/forms')
      .set(staff())
      .send({ templateId: 'representation-protocol', projectId, complexId, text: REPRESENTATION_PROTOCOL })
    const res = await api().delete(`/api/v1/forms/${draft.body.id}`).set(staff())
    expect(res.status).toBe(200)
    const list = await api().get('/api/v1/forms').set(staff())
    expect(list.body.some((f: { id: string }) => f.id === draft.body.id)).toBe(false)
  })
})
