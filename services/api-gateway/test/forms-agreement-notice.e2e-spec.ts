/**
 * The organizing agreement and the assembly notice, end to end.
 *
 * The agreement runs like the protocol: made for a complex, its gaps filled
 * (street, city, block, parcel) and its representatives chosen, sent to every
 * owner, signed by personal link alone, and signed by the company on the
 * organiser's line. The notice is filled in (address line, date, hour,
 * place) and sent; owners open it, and nobody signs it.
 *
 * Its own tenant. Nothing is sent: SMS is a fake that records the texts, and
 * test/setup.ts forces MESSAGING_SIMULATE.
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
import { israelToday } from '../src/forms/form-data'
// The real wordings, as the CRM sends them.
import { ORGANIZING_AGREEMENT } from '../../../packages/api-contracts/src/organizing-agreement'
import { ASSEMBLY_NOTICE } from '../../../packages/api-contracts/src/assembly-notice'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const SLUG = `agrnotice-${STAMP}`
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const texts: { to: string; text: string }[] = []
const fakeSms = {
  providerName: 'fake',
  isConfigured: true,
  sendOtp: jest.fn(async () => undefined),
  sendText: jest.fn(async (to: string, text: string) => {
    texts.push({ to, text })
  }),
}

describe('Organizing agreement and assembly notice (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let tenantId: string
  let managerId: string
  let projectId: string
  let complexId: string
  const owners: Record<'first' | 'second', string> = { first: '', second: '' }
  const apartments: Record<'first' | 'second', string> = { first: '', second: '' }
  let agreementId: string
  let noticeId: string

  const api = () => request(app.getHttpServer())
  const staff = () => ({
    Authorization: `Bearer ${jwt.sign(
      { sub: managerId, email: `${managerId}@example.com`, role: 'PROJECT_MANAGER', tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )}`,
  })
  const tokenOf = async (packageId: string, ownerId: string) => {
    const record = await prisma.signatureRecord.findFirstOrThrow({ where: { packageId, ownerId } })
    return (await prisma.signingSession.findUniqueOrThrow({ where: { recordId: record.id } })).token
  }

  const purge = async () => {
    const stale = await prisma.tenant.findMany({ where: { slug: { startsWith: 'agrnotice-' } }, select: { id: true } })
    for (const t of stale) {
      const records = await prisma.signatureRecord.findMany({ where: { tenantId: t.id }, select: { id: true } })
      await prisma.signingSession.deleteMany({ where: { recordId: { in: records.map((r) => r.id) } } })
      await prisma.signatureEvent.deleteMany({ where: { package: { tenantId: t.id } } })
      await prisma.signatureEvidence.deleteMany({ where: { tenantId: t.id } })
      await prisma.signatureRecord.deleteMany({ where: { tenantId: t.id } })
      await prisma.signaturePackage.deleteMany({ where: { tenantId: t.id } })
      await prisma.ownerApartment.deleteMany({ where: { owner: { tenantId: t.id } } })
      await prisma.owner.deleteMany({ where: { tenantId: t.id } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
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
    managerId = (
      await prisma.user.create({
        data: {
          tenantId,
          email: `${SLUG}-pm@example.com`,
          firstName: 'Forms',
          lastName: 'PM',
          passwordHash: 'not-a-usable-credential',
          role: 'PROJECT_MANAGER' as never,
        },
      })
    ).id
    projectId = (
      await prisma.project.create({
        data: { tenantId, code: SLUG, name: `${SLUG} project`, city: 'ירושלים', projectManagerId: managerId },
      })
    ).id
    complexId = (await prisma.complex.create({ data: { projectId, name: 'מתחם ההסכם' } })).id
    const building = await prisma.building.create({
      data: { complexId, address: 'ההסכם', streetNumber: '3', city: 'ירושלים' },
    })
    apartments.first = (await prisma.apartment.create({ data: { buildingId: building.id, apartmentNumber: '1' } })).id
    apartments.second = (await prisma.apartment.create({ data: { buildingId: building.id, apartmentNumber: '2' } })).id
    for (const [k, phone, name] of [['first', '0509912501', 'ראשונה בדיקה'], ['second', '0509912502', 'שני בדיקה']] as const) {
      owners[k] = (await prisma.owner.create({ data: { tenantId, fullName: name, phone } })).id
      await prisma.ownerApartment.create({ data: { ownerId: owners[k], apartmentId: apartments[k] } })
    }
  }, 120_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  describe('the organizing agreement', () => {
    it('is made for a complex with its street and city filled in from the buildings', async () => {
      const res = await api()
        .post('/api/v1/forms')
        .set(staff())
        .send({ templateId: 'organizing-agreement', projectId, complexId, text: ORGANIZING_AGREEMENT })
      expect(res.status).toBe(201)
      agreementId = res.body.id
      expect(res.body).toMatchObject({
        formType: 'ORGANIZING_AGREEMENT',
        title: 'הסכם לארגון וליווי עסקת פינוי בינוי · מתחם ההסכם',
        signable: true,
        fields: { street: 'ההסכם 3', city: 'ירושלים', gush: '', helka: '' },
      })
    })

    it('names what is missing before it can go out', async () => {
      const res = await api().post(`/api/v1/forms/${agreementId}/send`).set(staff())
      expect(res.status).toBe(400)
      expect(res.body.fields).toEqual(['גוש', 'חלקה', 'הנציגים'])
    })

    it('takes its block, parcel and representatives, and is not signed by the company as a draft', async () => {
      const res = await api()
        .patch(`/api/v1/forms/${agreementId}`)
        .set(staff())
        .send({
          fields: { gush: '30001', helka: '12' },
          representatives: [{ ownerId: owners.first, apartmentId: apartments.first }],
        })
      expect(res.status).toBe(200)
      expect(res.body.fields).toEqual({ street: 'ההסכם 3', city: 'ירושלים', gush: '30001', helka: '12' })
      const early = await api().post(`/api/v1/forms/${agreementId}/organizer-signature`).set(staff()).send({ signatureImage: PNG })
      expect(early.status).toBe(400)
    })

    it('goes to every owner with the agreement’s own words', async () => {
      const res = await api().post(`/api/v1/forms/${agreementId}/send`).set(staff())
      expect(res.status).toBe(201)
      expect(res.body.delivery.SMS).toBe(2)
      expect(texts.find((t) => t.to === '0509912501')?.text).toContain('ההסכם לארגון וליווי של מתחם ההסכם ממתין לחתימתכם')
    })

    it('opens for an owner with its fields, and is signed with the link alone', async () => {
      const token = await tokenOf(agreementId, owners.first)
      const view = await api().get(`/api/v1/signatures/portal/${token}`)
      expect(view.status).toBe(200)
      expect(view.body.form).toMatchObject({
        type: 'ORGANIZING_AGREEMENT',
        signable: true,
        fields: { gush: '30001', helka: '12' },
        signer: { apartmentNumber: '1', isRepresentative: true },
      })
      const signed = await api()
        .post(`/api/v1/signatures/portal/${token}/sign`)
        .send({ fullName: 'ראשונה בדיקה', idNumber: '000000018', signatureImage: PNG, confirmedRead: true })
      expect(signed.status).toBe(201)
    })

    it('is signed once by the company on the organiser’s line', async () => {
      const res = await api().post(`/api/v1/forms/${agreementId}/organizer-signature`).set(staff()).send({ signatureImage: PNG })
      expect(res.status).toBe(201)
      expect(res.body.organizer).toMatchObject({ signedDate: israelToday() })
      const again = await api().post(`/api/v1/forms/${agreementId}/organizer-signature`).set(staff()).send({ signatureImage: PNG })
      expect(again.status).toBe(400)
    })

    it('assembles the signed copy: fields, the determining date, the company and the representatives', async () => {
      const doc = await api().get(`/api/v1/forms/${agreementId}/document`).set(staff())
      expect(doc.status).toBe(200)
      expect(doc.body).toMatchObject({
        formType: 'ORGANIZING_AGREEMENT',
        fields: { street: 'ההסכם 3', city: 'ירושלים', gush: '30001', helka: '12' },
        determiningDate: israelToday(),
        organizer: { signatureImage: PNG, signedDate: israelToday() },
        totals: { owners: 2, signed: 1 },
      })
      expect(doc.body.representatives).toEqual([
        expect.objectContaining({ fullName: 'ראשונה בדיקה', idNumber: '000000018', signed: true }),
      ])
    })
  })

  describe('the assembly notice', () => {
    it('is made for a complex with its address line, and takes no representatives', async () => {
      const res = await api()
        .post('/api/v1/forms')
        .set(staff())
        .send({ templateId: 'assembly-notice', projectId, complexId, text: ASSEMBLY_NOTICE })
      expect(res.status).toBe(201)
      noticeId = res.body.id
      expect(res.body).toMatchObject({ formType: 'ASSEMBLY_NOTICE', signable: false })
      expect(res.body.fields.compound).toContain('מתחם ההסכם')
      const reps = await api()
        .patch(`/api/v1/forms/${noticeId}`)
        .set(staff())
        .send({ representatives: [{ ownerId: owners.first, apartmentId: apartments.first }] })
      expect(reps.status).toBe(400)
    })

    it('needs its date, hour and place, and checks the hour', async () => {
      const missing = await api().post(`/api/v1/forms/${noticeId}/send`).set(staff())
      expect(missing.body.fields).toEqual(['תאריך הכינוס', 'שעת הכינוס', 'מקום הכינוס'])
      const badHour = await api().patch(`/api/v1/forms/${noticeId}`).set(staff()).send({ fields: { meetingTime: '7pm' } })
      expect(badHour.status).toBe(400)
    })

    it('goes to every owner as an invitation with the date and the hour', async () => {
      await api()
        .patch(`/api/v1/forms/${noticeId}`)
        .set(staff())
        .send({ meeting: { meetingDate: '2026-11-01', meetingPlace: 'לובי הבניין' }, fields: { meetingTime: '19:30' } })
        .expect(200)
      const res = await api().post(`/api/v1/forms/${noticeId}/send`).set(staff())
      expect(res.status).toBe(201)
      expect(texts.filter((t) => t.text.includes('הוזמנתם לכינוס בעלי הדירות של מתחם ההסכם ב־01.11.2026 בשעה 19:30'))).toHaveLength(2)
    })

    it('opens for an owner to read, and refuses a signature', async () => {
      const token = await tokenOf(noticeId, owners.first)
      const view = await api().get(`/api/v1/signatures/portal/${token}`)
      expect(view.body.form).toMatchObject({ type: 'ASSEMBLY_NOTICE', signable: false, fields: { meetingTime: '19:30' } })
      const sign = await api()
        .post(`/api/v1/signatures/portal/${token}/sign`)
        .send({ fullName: 'ראשונה בדיקה', idNumber: '000000018', signatureImage: PNG, confirmedRead: true })
      expect(sign.status).toBe(400)
      const paper = await prisma.signatureRecord.findFirstOrThrow({ where: { packageId: noticeId, ownerId: owners.second } })
      const onPaper = await api()
        .post(`/api/v1/forms/${noticeId}/records/${paper.id}/paper`)
        .set(staff())
        .send({ fullName: 'שני בדיקה', signedDate: '2026-11-01', documentId: 'none' })
      expect(onPaper.status).toBe(400)
    })

    it('counts who opened it, and reminds only those who did not', async () => {
      const detail = await api().get(`/api/v1/forms/${noticeId}`).set(staff())
      expect(detail.body.progress).toMatchObject({ owners: 2, ownersOpened: 1, ownersSigned: 0 })
      const before = texts.length
      const res = await api().post(`/api/v1/forms/${noticeId}/remind`).set(staff())
      expect(res.body).toMatchObject({ sent: 1 })
      expect(texts.slice(before)).toEqual([
        expect.objectContaining({ to: '0509912502', text: expect.stringContaining('תזכורת: כינוס בעלי הדירות') }),
      ])
    })
  })

  describe('an owner of two apartments', () => {
    let pairComplexId: string
    let both: string
    let single: string
    const units: Record<'three' | 'four' | 'five', string> = { three: '', four: '', five: '' }

    beforeAll(async () => {
      pairComplexId = (await prisma.complex.create({ data: { projectId, name: 'מתחם השתיים' } })).id
      const building = await prisma.building.create({
        data: { complexId: pairComplexId, address: 'השתיים', streetNumber: '5', city: 'ירושלים' },
      })
      for (const [k, n] of [['three', '3'], ['four', '4'], ['five', '5']] as const) {
        units[k] = (await prisma.apartment.create({ data: { buildingId: building.id, apartmentNumber: n } })).id
      }
      both = (await prisma.owner.create({ data: { tenantId, fullName: 'בעלת שתיים', phone: '0509912503' } })).id
      single = (await prisma.owner.create({ data: { tenantId, fullName: 'בעל אחת', phone: '0509912504' } })).id
      await prisma.ownerApartment.createMany({
        data: [
          { ownerId: both, apartmentId: units.three },
          { ownerId: both, apartmentId: units.four },
          { ownerId: single, apartmentId: units.five },
        ],
      })
    })

    it('gets the notice once, and opening it counts for both apartments', async () => {
      const made = await api()
        .post('/api/v1/forms')
        .set(staff())
        .send({ templateId: 'assembly-notice', projectId, complexId: pairComplexId, text: ASSEMBLY_NOTICE })
      expect(made.status).toBe(201)
      const id = made.body.id as string
      await api()
        .patch(`/api/v1/forms/${id}`)
        .set(staff())
        .send({ meeting: { meetingDate: '2026-11-02', meetingPlace: 'לובי הבניין' }, fields: { meetingTime: '18:00' } })
        .expect(200)

      const before = texts.length
      const sent = await api().post(`/api/v1/forms/${id}/send`).set(staff())
      expect(sent.status).toBe(201)
      expect(sent.body.delivery.SMS).toBe(2)
      expect(texts.slice(before).filter((t) => t.to === '0509912503')).toHaveLength(1)
      const hers = await prisma.signatureRecord.findMany({ where: { packageId: id, ownerId: both } })
      expect(hers.map((r) => r.deliveredVia)).toEqual(['SMS', 'SMS'])

      const session = await prisma.signingSession.findFirstOrThrow({ where: { recordId: { in: hers.map((r) => r.id) } } })
      const view = await api().get(`/api/v1/signatures/portal/${session.token}`)
      expect(view.body.form.signer.apartmentNumbers).toEqual(['3', '4'])
      const detail = await api().get(`/api/v1/forms/${id}`).set(staff())
      expect(detail.body.progress).toMatchObject({ owners: 3, ownersOpened: 2 })

      const reminded = texts.length
      const remind = await api().post(`/api/v1/forms/${id}/remind`).set(staff())
      expect(remind.body).toMatchObject({ sent: 1 })
      expect(texts.slice(reminded).map((t) => t.to)).toEqual(['0509912504'])
    })

    it('gets a link to sign for each apartment, each message naming its apartment', async () => {
      const made = await api()
        .post('/api/v1/forms')
        .set(staff())
        .send({ templateId: 'organizing-agreement', projectId, complexId: pairComplexId, text: ORGANIZING_AGREEMENT })
      expect(made.status).toBe(201)
      const id = made.body.id as string
      await api()
        .patch(`/api/v1/forms/${id}`)
        .set(staff())
        .send({ fields: { gush: '30002', helka: '7' }, representatives: [{ ownerId: single, apartmentId: units.five }] })
        .expect(200)

      const before = texts.length
      const sent = await api().post(`/api/v1/forms/${id}/send`).set(staff())
      expect(sent.status).toBe(201)
      expect(sent.body.delivery.SMS).toBe(3)
      const out = texts.slice(before)
      const hers = out.filter((t) => t.to === '0509912503').map((t) => t.text)
      expect(hers).toHaveLength(2)
      expect(hers[0]).toContain('ממתין לחתימתכם (דירה 3).')
      expect(hers[1]).toContain('ממתין לחתימתכם (דירה 4).')
      expect(out.find((t) => t.to === '0509912504')?.text).not.toContain('(דירה')

      // Signed for one apartment, she is reminded of the other by name.
      const three = await prisma.signatureRecord.findFirstOrThrow({ where: { packageId: id, apartmentId: units.three } })
      const token = (await prisma.signingSession.findUniqueOrThrow({ where: { recordId: three.id } })).token
      await api()
        .post(`/api/v1/signatures/portal/${token}/sign`)
        .send({ fullName: 'בעלת שתיים', idNumber: '000000018', signatureImage: PNG, confirmedRead: true })
        .expect(201)
      const reminded = texts.length
      await api().post(`/api/v1/forms/${id}/remind`).set(staff()).expect(201)
      expect(texts.slice(reminded).filter((t) => t.to === '0509912503').map((t) => t.text)).toEqual([
        expect.stringContaining('עדיין ממתין לחתימתכם (דירה 4).'),
      ])
    })
  })

  describe('cancelling', () => {
    it('tells everyone who opens a link that it was cancelled, those who signed too', async () => {
      const signerToken = await tokenOf(agreementId, owners.first)
      const otherToken = await tokenOf(agreementId, owners.second)
      const noticeToken = await tokenOf(noticeId, owners.first)
      expect((await api().delete(`/api/v1/forms/${agreementId}`).set(staff())).status).toBe(200)
      expect((await api().delete(`/api/v1/forms/${noticeId}`).set(staff())).status).toBe(200)

      const signer = await api().get(`/api/v1/signatures/portal/${signerToken}`)
      expect(signer.status).toBe(410)
      expect(signer.body).toMatchObject({
        code: 'CANCELLED',
        formType: 'ORGANIZING_AGREEMENT',
        message: 'הטופס הזה בוטל. החתימה שלכם נשמרת בתיעוד בלבד, ואין צורך לעשות דבר.',
      })
      const other = await api().get(`/api/v1/signatures/portal/${otherToken}`)
      expect(other.body).toMatchObject({ code: 'CANCELLED', message: 'הטופס הזה בוטל, ואין צורך לחתום עליו.' })
      const notice = await api().get(`/api/v1/signatures/portal/${noticeToken}`)
      expect(notice.body).toMatchObject({ code: 'CANCELLED', formType: 'ASSEMBLY_NOTICE', message: 'ההודעה הזו בוטלה, ואין צורך לעשות דבר.' })

      const lateSign = await api()
        .post(`/api/v1/signatures/portal/${otherToken}/sign`)
        .send({ fullName: 'שני בדיקה', idNumber: '000000018', signatureImage: PNG, confirmedRead: true })
      expect(lateSign.status).toBe(410)
    })
  })
})
