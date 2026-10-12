/**
 * The report generator and its Excel exports, end to end: who may run which
 * report, the filters and columns, the file itself, the audit entry, the
 * tenant boundary, and that a national ID number never leaves.
 *
 * Its own two tenants. Nothing is sent: SMS is a fake, and test/setup.ts
 * forces MESSAGING_SIMULATE.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { ThrottlerStorage } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import request from 'supertest'
import ExcelJS from 'exceljs'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { SmsService } from '../src/sms/sms.service'
import { ASSEMBLY_NOTICE } from '../../../packages/api-contracts/src/assembly-notice'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const STAMP = Date.now().toString(36)
const PREFIX = 'reports-e2e-'
/** Stands in for an encrypted national ID: it must appear in no response. */
const ID_MARKER = `ENCRYPTED-ID-${STAMP}`

const fakeSms = { providerName: 'fake', isConfigured: true, sendOtp: jest.fn(async () => undefined), sendText: jest.fn(async () => undefined) }

/** Reads a binary response into a Buffer. */
function binary(res: any, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = []
  res.on('data', (chunk: Buffer) => chunks.push(chunk))
  res.on('end', () => callback(null, Buffer.concat(chunks)))
}

describe('Reports (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  const A = { tenantId: '', managerId: '', developerId: '', agentId: '', projectId: '', complexId: '', buildingId: '', formId: '' }
  const B = { tenantId: '', managerId: '', formId: '' }

  const api = () => request(app.getHttpServer())
  const token = (sub: string, tenantId: string, role: string) => ({
    Authorization: `Bearer ${jwt.sign(
      { sub, email: `${sub}@example.com`, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )}`,
  })
  const managerA = () => token(A.managerId, A.tenantId, 'PROJECT_MANAGER')
  const run = (body: object, auth = managerA()) => api().post('/api/v1/reports/run').set(auth).send(body)

  const purge = async () => {
    const stale = await prisma.tenant.findMany({ where: { slug: { startsWith: PREFIX } }, select: { id: true } })
    for (const t of stale) {
      const records = await prisma.signatureRecord.findMany({ where: { tenantId: t.id }, select: { id: true } })
      await prisma.signingSession.deleteMany({ where: { recordId: { in: records.map((r) => r.id) } } })
      await prisma.signatureEvent.deleteMany({ where: { package: { tenantId: t.id } } })
      await prisma.signatureRecord.deleteMany({ where: { tenantId: t.id } })
      await prisma.signaturePackage.deleteMany({ where: { tenantId: t.id } })
      await prisma.ownerApartment.deleteMany({ where: { owner: { tenantId: t.id } } })
      await prisma.owner.deleteMany({ where: { tenantId: t.id } })
      await prisma.lead.deleteMany({ where: { tenantId: t.id } })
      await prisma.savedReport.deleteMany({ where: { tenantId: t.id } })
      await prisma.project.deleteMany({ where: { tenantId: t.id } })
      await prisma.auditLog.deleteMany({ where: { tenantId: t.id } })
      await prisma.user.deleteMany({ where: { tenantId: t.id } })
      await prisma.tenant.delete({ where: { id: t.id } }).catch(() => undefined)
    }
  }

  /** A tenant with a manager, a project of one building and two apartments. */
  async function seedTenant(name: string) {
    const tenantId = (await prisma.tenant.create({ data: { name: `${PREFIX}${name}-${STAMP}`, slug: `${PREFIX}${name}-${STAMP}` } })).id
    const user = (role: string, tag: string) => prisma.user.create({
      data: { tenantId, email: `${PREFIX}${name}-${tag}-${STAMP}@example.com`, firstName: 'דוח', lastName: tag, passwordHash: 'not-a-usable-credential', role: role as never },
    })
    const managerId = (await user('PROJECT_MANAGER', 'pm')).id
    const projectId = (await prisma.project.create({
      data: { tenantId, code: `${PREFIX}${name}-${STAMP}`, name: `פרויקט ${name}`, city: 'ירושלים', projectManagerId: managerId },
    })).id
    const complexId = (await prisma.complex.create({ data: { projectId, name: `מתחם ${name}` } })).id
    const buildingId = (await prisma.building.create({ data: { complexId, address: `רחוב ${name}`, streetNumber: '7', city: 'ירושלים' } })).id
    const apartment = async (n: string) => (await prisma.apartment.create({ data: { buildingId, apartmentNumber: n } })).id
    return { tenantId, managerId, projectId, complexId, buildingId, user, apartment }
  }

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }) })
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

    const a = await seedTenant('a')
    Object.assign(A, { tenantId: a.tenantId, managerId: a.managerId, projectId: a.projectId, complexId: a.complexId, buildingId: a.buildingId })
    A.developerId = (await a.user('DEVELOPER_REP', 'dev')).id
    A.agentId = (await a.user('FIELD_AGENT', 'agent')).id
    const one = await a.apartment('1')
    const two = await a.apartment('2')
    const owner = (fullName: string, phone: string | null, nationalId: string | null) =>
      prisma.owner.create({ data: { tenantId: a.tenantId, fullName, phone, nationalId } })
    const dana = await owner('דנה בדיקה', '0509912601', ID_MARKER)
    const yossi = await owner('יוסי בדיקה', null, null)
    await prisma.ownerApartment.createMany({
      data: [
        { ownerId: dana.id, apartmentId: one, shareNumerator: 1, shareDenominator: 2 },
        { ownerId: yossi.id, apartmentId: one, shareNumerator: 1, shareDenominator: 2 },
        { ownerId: dana.id, apartmentId: two },
      ],
    })
    await prisma.lead.createMany({
      data: [
        { tenantId: a.tenantId, firstName: 'ליד', lastName: 'חדש', phone: '0509912602', status: 'NEW', source: 'WEBSITE' },
        { tenantId: a.tenantId, firstName: 'ליד', lastName: 'נחתם', phone: '0509912603', status: 'SIGNED', source: 'REFERRAL' },
        // Text a visitor typed must stay text in Excel.
        { tenantId: a.tenantId, firstName: '=HYPERLINK("x")', lastName: 'נוסחה', status: 'NEW', source: 'WEBSITE' },
      ],
    })

    // A notice, sent, and opened by Dana.
    const notice = await api().post('/api/v1/forms').set(managerA())
      .send({ templateId: 'assembly-notice', projectId: a.projectId, complexId: a.complexId, text: ASSEMBLY_NOTICE })
    A.formId = notice.body.id
    await api().patch(`/api/v1/forms/${A.formId}`).set(managerA())
      .send({ meeting: { meetingDate: '2026-11-03', meetingPlace: 'לובי' }, fields: { meetingTime: '18:30' } }).expect(200)
    await api().post(`/api/v1/forms/${A.formId}/send`).set(managerA()).expect(201)
    // Dana owns two apartments and got the notice once, on her first apartment's link.
    const danaRecords = await prisma.signatureRecord.findMany({ where: { packageId: A.formId, ownerId: dana.id } })
    const session = await prisma.signingSession.findFirstOrThrow({ where: { recordId: { in: danaRecords.map((r) => r.id) } } })
    await api().get(`/api/v1/signatures/portal/${session.token}`).expect(200)

    const b = await seedTenant('b')
    Object.assign(B, { tenantId: b.tenantId, managerId: b.managerId })
    const bApartment = await b.apartment('1')
    const stranger = await prisma.owner.create({ data: { tenantId: b.tenantId, fullName: 'זר מדייר אחר', phone: '0509912604' } })
    await prisma.ownerApartment.create({ data: { ownerId: stranger.id, apartmentId: bApartment } })
    const bForm = await api().post('/api/v1/forms').set(token(b.managerId, b.tenantId, 'PROJECT_MANAGER'))
      .send({ templateId: 'assembly-notice', projectId: b.projectId, complexId: b.complexId, text: ASSEMBLY_NOTICE })
    B.formId = bForm.body.id
  }, 180_000)

  afterAll(async () => {
    await purge()
    await app?.close()
  })

  describe('which reports a user may run', () => {
    it('lists the four reports for a project manager, with their filters and columns', async () => {
      const res = await api().get('/api/v1/reports/types').set(managerA()).expect(200)
      expect(res.body.map((r: { type: string }) => r.type)).toEqual(['owners', 'leads', 'form-signatures', 'projects'])
      const owners = res.body[0]
      expect(owners.filters.map((f: { key: string }) => f.key)).toContain('projectId')
      expect(owners.columns.find((c: { key: string }) => c.key === 'hasNationalId')).toMatchObject({ label: 'ת״ז בתיק' })
      expect(JSON.stringify(res.body)).not.toContain('roles')
    })

    it("refuses the developer's representative: no report is theirs", async () => {
      await api().get('/api/v1/reports/types').set(token(A.developerId, A.tenantId, 'DEVELOPER_REP')).expect(403)
      const res = await run({ type: 'owners' }, token(A.developerId, A.tenantId, 'DEVELOPER_REP'))
      expect(res.status).toBe(403)
    })

    it('refuses a field agent the owners report, but runs the leads report for them', async () => {
      const agent = token(A.agentId, A.tenantId, 'FIELD_AGENT')
      expect((await run({ type: 'owners' }, agent)).status).toBe(403)
      expect((await run({ type: 'leads' }, agent)).status).toBe(200)
    })
  })

  describe('the owners report', () => {
    it('has a row per owner and apartment, the share, and only whether an ID is on file', async () => {
      const res = await run({ type: 'owners', filters: { projectId: A.projectId } }).expect(200)
      expect(res.body.total).toBe(3)
      expect(res.body.columns.map((c: { key: string }) => c.key)).toEqual(
        ['fullName', 'phone', 'email', 'project', 'building', 'apartment', 'share', 'hasNationalId'])
      const danaInOne = res.body.rows.find((r: Record<string, string>) => r.fullName === 'דנה בדיקה' && r.apartment === '1')
      expect(danaInOne).toMatchObject({ share: '1/2', hasNationalId: 'כן', building: 'רחוב a 7' })
      expect(res.body.rows.find((r: Record<string, string>) => r.apartment === '2')).toMatchObject({ share: 'מלא' })
      expect(JSON.stringify(res.body)).not.toContain(ID_MARKER)
      expect(res.body.summary).toEqual(expect.arrayContaining([['אנשים', '2']]))
    })

    it('finds the owners missing a phone, and keeps only the columns asked for', async () => {
      const res = await run({ type: 'owners', filters: { missing: 'phone' }, columns: ['phone', 'fullName', 'nope'] }).expect(200)
      expect(res.body.rows).toEqual([{ fullName: 'יוסי בדיקה', phone: '' }])
    })

    it("never lists another tenant's owners", async () => {
      const res = await run({ type: 'owners' }).expect(200)
      expect(JSON.stringify(res.body)).not.toContain('זר מדייר אחר')
    })

    it('refuses a filter value outside its list, and a column list with nothing known', async () => {
      expect((await run({ type: 'owners', filters: { missing: 'shoeSize' } })).status).toBe(400)
      expect((await run({ type: 'owners', columns: ['nope'] })).status).toBe(400)
      expect((await run({ type: 'nope' })).status).toBe(400)
    })
  })

  describe('the leads report', () => {
    it('filters by status, with the Hebrew labels', async () => {
      const res = await run({ type: 'leads', filters: { status: 'SIGNED' } }).expect(200)
      expect(res.body.rows).toEqual([expect.objectContaining({ name: 'ליד נחתם', status: 'נחתם', source: 'הפניה' })])
    })

    it('refuses a date that is not a date', async () => {
      expect((await run({ type: 'leads', filters: { from: 'yesterday' } })).status).toBe(400)
    })
  })

  describe("a form's signing status", () => {
    it('needs a form, and lists every owner and apartment with who opened it', async () => {
      expect((await run({ type: 'form-signatures' })).status).toBe(400)
      const res = await run({ type: 'form-signatures', filters: { packageId: A.formId } }).expect(200)
      expect(res.body.total).toBe(3)
      const statuses = res.body.rows.map((r: Record<string, string>) => `${r.ownerName}:${r.apartment}:${r.status}`).sort()
      expect(statuses).toEqual(['דנה בדיקה:1:פתח', 'דנה בדיקה:2:פתח', 'יוסי בדיקה:1:לא פתח'])
      expect(res.body.summary).toEqual(expect.arrayContaining([['פתחו את ההודעה', '2 מתוך 3 שורות']]))
    })

    it("answers another tenant's form as not found", async () => {
      expect((await run({ type: 'form-signatures', filters: { packageId: B.formId } })).status).toBe(404)
    })
  })

  describe('the projects report', () => {
    it('counts buildings, apartments and owners', async () => {
      const res = await run({ type: 'projects' }).expect(200)
      expect(res.body.rows).toEqual([expect.objectContaining({ name: 'פרויקט a', buildings: 1, apartments: 2, owners: 2 })])
    })
  })

  describe('the Excel export', () => {
    it('is a right-to-left workbook of every row, with a details sheet, and is audited', async () => {
      const res = await api().post('/api/v1/reports/export').set(managerA())
        .send({ type: 'owners', filters: { projectId: A.projectId } })
        .buffer(true).parse(binary)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('spreadsheetml')
      expect(res.headers['content-disposition']).toMatch(/filename="owners-\d{4}-\d{2}-\d{2}\.xlsx"/)

      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(res.body)
      const sheet = workbook.worksheets[0]!
      expect(sheet.name).toBe('בעלי דירות')
      expect(sheet.views[0]).toMatchObject({ rightToLeft: true })
      expect(sheet.getRow(1).getCell(1).value).toBe('שם')
      expect(sheet.rowCount).toBe(4)
      expect(res.body.toString('latin1')).not.toContain(ID_MARKER)
      const details = workbook.getWorksheet('פרטי הדוח')!
      const lines = details.getSheetValues().filter(Boolean).map((row: any) => `${row[1]}=${row[2]}`)
      expect(lines).toEqual(expect.arrayContaining(['דוח=בעלי דירות', 'פרויקט=פרויקט a', 'שורות בדוח=3']))

      const audit = await prisma.auditLog.findFirst({
        where: { tenantId: A.tenantId, action: 'EXPORT', entity: 'Report', entityId: 'owners' },
        select: { userId: true, metadata: true },
      })
      expect(audit?.userId).toBe(A.managerId)
      expect(audit?.metadata).toMatchObject({ type: 'owners', rows: 3 })
    })

    it('keeps text a visitor typed as text, never a formula', async () => {
      const res = await api().post('/api/v1/reports/export').set(managerA())
        .send({ type: 'leads', columns: ['name'] }).buffer(true).parse(binary)
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(res.body)
      const values = workbook.worksheets[0]!.getColumn(1).values as unknown[]
      expect(values).toContain('=HYPERLINK("x") נוסחה')
      expect(values.some((v) => typeof v === 'object' && v !== null && 'formula' in (v as object))).toBe(false)
    })
  })

  describe('saved report configurations', () => {
    it('accepts the named fields only', async () => {
      const extra = await api().post('/api/v1/reports').set(managerA())
        .send({ name: 'בעלים', type: 'owners', config: {}, tenantId: B.tenantId })
      expect(extra.status).toBe(400)
      const ok = await api().post('/api/v1/reports').set(managerA())
        .send({ name: 'בעלים', type: 'owners', config: { projectId: A.projectId } })
      expect(ok.status).toBe(201)
      expect(ok.body.tenantId).toBe(A.tenantId)
    })
  })
})
