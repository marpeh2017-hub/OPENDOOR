/**
 * Excel import E2E — Run 3.
 *
 * Covers the full workflow (upload → mapping → preview → commit → report →
 * history), the rules the import must NOT re-implement, RBAC, tenant isolation,
 * transaction rollback, PII containment and idempotent re-upload.
 *
 * Every fixture is a REAL `.xlsx` built by exceljs and read back through the
 * production parse path. Every row this suite creates is removed in `afterAll`,
 * including the objects uploaded to MinIO.
 *
 * Tokens are minted with the app's own JwtService (the rbac.e2e-spec approach)
 * so a 403 can be told apart from a 401 — a garbage token can only ever produce
 * 401 and would prove nothing about roles. Tokens carry `sessionId`, which a
 * previous suite was caught omitting.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerStorage } from '@nestjs/throttler'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { StorageService } from '../src/storage/storage.service'
import {
  buildWorkbook, buildFormulaWorkbook, validNationalId, invalidNationalId,
  HEBREW_OWNER_HEADERS, ENGLISH_OWNER_HEADERS, allValidRows, mixedInvalidRows,
} from './helpers/excel-fixtures'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SEED_EMAIL = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'
const TAG = `IMPORTSPEC-${Date.now().toString(36)}`

/** Ids that belong to no tenant — stand-ins for another tenant's rows. */
const FOREIGN_PROJECT = 'prj_not_in_this_tenant'
const FOREIGN_JOB = 'imp_not_in_this_tenant'

describe('Excel import (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let storage: StorageService
  let jwt: JwtService
  let tenantId: string
  let adminUserId: string
  let adminToken: string
  /** Valid token, staff role, but NOT in IMPORT_ROLES. */
  let observerToken: string

  let projectId: string
  let complexId: string
  const buildingIds: string[] = []
  const apartmentIds: string[] = []
  /** Apartment numbers in the MAIN building, used by the commit tests. */
  let apartmentNumbers: string[] = []

  /**
   * Creates a building with eight apartments numbered `<prefix>1` … `<prefix>8`.
   *
   * Blocks that assert exact counts get their OWN building. Sharing one made the
   * suite order-dependent: once the commit block gave apartment 1 an owner at
   * 1/1, a later fixture reusing apartment 1 correctly gained an extra
   * share-sum error, and the "expected 6 invalid rows" assertion started failing
   * for a reason that had nothing to do with the code under test. Prefixes are
   * distinct so that resolving an apartment by number alone stays unambiguous
   * across the whole project.
   */
  const makeBuilding = async (prefix: string, address: string) => {
    const building = await prisma.building.create({
      data: { complexId, address, streetNumber: '45', city: 'תל אביב' },
    })
    buildingIds.push(building.id)
    const numbers: string[] = []
    for (let i = 1; i <= 8; i++) {
      const n = `${prefix}${i}`
      const a = await prisma.apartment.create({
        data: { buildingId: building.id, apartmentNumber: n, floor: i },
      })
      apartmentIds.push(a.id)
      numbers.push(n)
    }
    return numbers
  }

  const jobIds: string[] = []
  const storageKeys: string[] = []
  /**
   * Owners created directly (not through an import) as duplicate DECOYS for the
   * resolution-queue tests. They deliberately hold no apartment, so the
   * holdings-based sweep in `afterAll` would not find them.
   */
  const decoyOwnerIds: string[] = []

  const auth = (t = adminToken) => ({ Authorization: `Bearer ${t}` })
  const http = () => request(app.getHttpServer())

  const tokenFor = (role: string) =>
    jwt.sign(
      { sub: adminUserId, email: SEED_EMAIL, role, tenantId, sessionId: randomUUID() },
      { secret: process.env.JWT_SECRET as string, expiresIn: '10m' },
    )

  /** Uploads a workbook and records the job for cleanup. */
  const upload = async (
    buffer: Buffer,
    opts: { fileName?: string; entityType?: string; mode?: string; token?: string; project?: string } = {},
  ) => {
    const res = await http()
      .post('/api/v1/imports/upload')
      .set(auth(opts.token ?? adminToken))
      .field('projectId', opts.project ?? projectId)
      .field('entityType', opts.entityType ?? 'OWNER')
      .field('mode', opts.mode ?? 'ADD_AND_UPDATE')
      .attach('file', buffer, {
        filename: opts.fileName ?? 'owners.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    if (res.status === 201 && res.body?.job?.id) jobIds.push(res.body.job.id)
    return res
  }

  /** Confirms a mapping built from the auto-suggestion (all fields accepted). */
  const confirmSuggested = async (jobId: string, suggestion: any[], mode?: string) => {
    const mapping = suggestion
      .filter((s) => s.field != null)
      .map((s) => ({ field: s.field, index: s.index }))
    return http()
      .post(`/api/v1/imports/${jobId}/mapping`)
      .set(auth())
      .send({ mapping, ...(mode ? { mode } : {}) })
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      /**
       * The global ThrottlerGuard allows 20 requests/second. This suite drives
       * the full four-call workflow (upload → mapping → preview → commit) dozens
       * of times back to back and trips it, producing 429s that have nothing to
       * do with the behaviour under test.
       *
       * We replace the throttler's STORAGE, not the guard. `overrideGuard` does
       * not work here: the guard is registered as `{ provide: APP_GUARD,
       * useClass: ThrottlerGuard }`, and `useClass` constructs a fresh instance
       * rather than resolving the (overridden) `ThrottlerGuard` token — so the
       * override is silently ignored and the real guard still runs. Its injected
       * `ThrottlerStorage` dependency IS resolved from the container, so a
       * counter that never accumulates is the reliable seam.
       *
       * This is a harness artefact only: it softens no assertion in this file
       * and does not touch `app.module.ts`. Rate limiting is a cross-cutting
       * concern with its own coverage; every import-specific guard (RBAC, tenant
       * scoping, upload policy) remains fully active below.
       */
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0,
        }),
      })
      .compile()

    app = moduleFixture.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(
      new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
    )
    await app.init()

    prisma = app.get(PrismaService)
    storage = app.get(StorageService)

    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
    // Fail loudly rather than silently skipping — a wrong seed password has
    // disabled suites in this repo before.
    expect(login.status).toBe(200)
    adminToken = login.body.accessToken
    expect(typeof adminToken).toBe('string')

    jwt = app.get(JwtService, { strict: false })
    const decoded = jwt.decode(adminToken) as any
    tenantId = decoded.tenantId
    adminUserId = decoded.sub
    expect(tenantId).toBeTruthy()

    // MUNICIPALITY_USER is staff (may read) but holds no write role anywhere.
    observerToken = tokenFor('MUNICIPALITY_USER')

    // ── Structure to import into ────────────────────────────────────────
    const project = await prisma.project.create({
      data: { tenantId, code: `${TAG}`.slice(0, 20), name: `${TAG} פרויקט`, city: 'תל אביב' },
    })
    projectId = project.id
    const complex = await prisma.complex.create({
      data: { projectId, name: `${TAG} מתחם` },
    })
    complexId = complex.id
    apartmentNumbers = await makeBuilding('', 'הרצל')
  })

  afterAll(async () => {
    if (prisma) {
      // Objects in MinIO first — a deleted job row would orphan them.
      for (const key of storageKeys) {
        await storage.delete(tenantId, key).catch(() => undefined)
      }
      const jobs = await prisma.importJob.findMany({
        where: { tenantId, projectId },
        select: { id: true, storageKey: true },
      })
      for (const j of jobs) {
        if (j.storageKey) await storage.delete(tenantId, j.storageKey).catch(() => undefined)
      }

      const ownerIds = (
        await prisma.owner.findMany({
          where: { holdings: { some: { apartmentId: { in: apartmentIds } } } },
          select: { id: true },
        })
      ).map((o) => o.id)
      const residentIds = (
        await prisma.resident.findMany({
          where: { apartmentId: { in: apartmentIds } },
          select: { id: true },
        })
      ).map((r) => r.id)

      await prisma.auditLog.deleteMany({
        where: {
          tenantId,
          entityId: {
            in: [
              ...jobs.map((j) => j.id), ...ownerIds, ...residentIds, ...decoyOwnerIds,
              ...apartmentIds, ...buildingIds, complexId, projectId,
            ],
          },
        },
      })
      await prisma.importRowIssue.deleteMany({ where: { jobId: { in: jobs.map((j) => j.id) } } })
      await prisma.importJob.deleteMany({ where: { tenantId, projectId } })
      await prisma.resident.deleteMany({ where: { id: { in: residentIds } } })
      await prisma.ownerApartment.deleteMany({ where: { apartmentId: { in: apartmentIds } } })
      await prisma.owner.deleteMany({ where: { id: { in: ownerIds } } })
      await prisma.owner.deleteMany({ where: { id: { in: decoyOwnerIds } } })
      await prisma.apartment.deleteMany({ where: { id: { in: apartmentIds } } })
      await prisma.building.deleteMany({ where: { id: { in: buildingIds } } })
      await prisma.complex.deleteMany({ where: { id: complexId } })
      await prisma.projectStageHistory.deleteMany({ where: { projectId } })
      await prisma.projectMember.deleteMany({ where: { projectId } })
      await prisma.project.deleteMany({ where: { id: projectId } })
      // Belt and braces.
      await prisma.project.deleteMany({ where: { tenantId, name: { contains: TAG } } })
    }
    await app?.close()
  })

  // ── Upload policy ────────────────────────────────────────────────────────

  describe('upload policy', () => {
    it('accepts a real .xlsx and returns headers, a suggested mapping and a masked sample', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: allValidRows(apartmentNumbers),
      })
      const res = await upload(buf)
      expect(res.status).toBe(201)
      expect(res.body.sheet.headers).toEqual(HEBREW_OWNER_HEADERS)
      expect(res.body.sheet.totalRows).toBe(4)
      expect(res.body.job.status).toBe('UPLOADED')
      // The storage key is a capability and must never leave the server.
      expect(res.body.job.storageKey).toBeUndefined()
    })

    it('refuses .xlsm with a specific message, not the generic one', async () => {
      const buf = await buildWorkbook({ headers: ['a', 'b'], rows: [['1', '2']] })
      const res = await http()
        .post('/api/v1/imports/upload')
        .set(auth())
        .field('projectId', projectId)
        .field('entityType', 'OWNER')
        .attach('file', buf, {
          filename: 'macro.xlsm',
          contentType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        })
      expect(res.status).toBe(400)
      expect(String(res.body.message)).toContain('מאקרו')
    })

    it('refuses a file that merely claims to be .xlsx', async () => {
      const res = await http()
        .post('/api/v1/imports/upload')
        .set(auth())
        .field('projectId', projectId)
        .field('entityType', 'OWNER')
        .attach('file', Buffer.from('<html>not a workbook</html>'), {
          filename: 'evil.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('IMPORT_FILE_NOT_XLSX')
    })

    it('refuses an empty file', async () => {
      const res = await http()
        .post('/api/v1/imports/upload')
        .set(auth())
        .field('projectId', projectId)
        .field('entityType', 'OWNER')
        .attach('file', Buffer.alloc(0), {
          filename: 'empty.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      expect(res.status).toBe(400)
    })
  })

  // ── RBAC and tenant isolation ────────────────────────────────────────────

  describe('RBAC and tenant isolation', () => {
    it('refuses a non-manager staff role with 403 (not 401, not a silent pass)', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS, rows: allValidRows(apartmentNumbers),
      })
      const res = await upload(buf, { token: observerToken })
      expect(res.status).toBe(403)
    })

    /**
     * FIELD_AGENT is in IMPORT_ROLES (A3). Field agents collect the owner
     * sheets door to door, so routing every upload through a manager made them
     * the bottleneck on their own task.
     */
    it('lets a FIELD_AGENT run an import end to end', async () => {
      const agentToken = tokenFor('FIELD_AGENT')
      // Its OWN building: this test commits a 1/1 holding, and doing that on a
      // shared apartment would push a later fixture's share sum past 1 and fail
      // an assertion that has nothing to do with roles.
      const agentApts = await makeBuilding('FA', 'סוקולוב')
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [['סוכן שטח בעלים', validNationalId(7777), '0507777777', 'fa@example.com', agentApts[0], '1/1', '']],
      })
      const up = await upload(buf, { token: agentToken })
      expect(up.status).toBe(201)

      const jobId = up.body.job.id
      const mapping = up.body.mapping
        .filter((m: any) => m.field != null)
        .map((m: any) => ({ field: m.field, index: m.index }))

      // Every write step of the workflow, not just the upload.
      expect((await http().post(`/api/v1/imports/${jobId}/mapping`)
        .set(auth(agentToken)).send({ mapping })).status).toBe(200)
      expect((await http().post(`/api/v1/imports/${jobId}/preview`)
        .set(auth(agentToken))).status).toBe(200)
      const commit = await http().post(`/api/v1/imports/${jobId}/commit`)
        .set(auth(agentToken)).send({})
      expect(commit.status).toBe(200)
      expect(commit.body.job.createdRows).toBe(1)
    })

    /**
     * The other half of A3: widening the list must not have widened it to all
     * staff. LAWYER is staff and holds no import permission.
     */
    it('still refuses a staff role that is in neither IMPORT_ROLES nor MANAGER_ROLES with 403', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS, rows: allValidRows(apartmentNumbers),
      })
      for (const role of ['LAWYER', 'ARCHITECT', 'ENGINEER', 'EXTERNAL_CONSULTANT']) {
        const res = await upload(buf, { token: tokenFor(role) })
        expect({ role, status: res.status }).toEqual({ role, status: 403 })
      }
    })

    it('lets the same role READ the import history (403 is about writing, not looking)', async () => {
      const res = await http()
        .get('/api/v1/imports')
        .query({ projectId })
        .set(auth(observerToken))
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it("returns 404 for another tenant's projectId — never 403", async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [['פלוני', '', '', '', '1', '1/1', '']],
      })
      const res = await upload(buf, { project: FOREIGN_PROJECT })
      expect(res.status).toBe(404)
    })

    it("returns 404 for another tenant's job id on every job route", async () => {
      for (const path of [
        `/api/v1/imports/${FOREIGN_JOB}`,
        `/api/v1/imports/${FOREIGN_JOB}/issues`,
        `/api/v1/imports/${FOREIGN_JOB}/errors.csv`,
      ]) {
        const res = await http().get(path).set(auth())
        expect(res.status).toBe(404)
      }
      const preview = await http().post(`/api/v1/imports/${FOREIGN_JOB}/preview`).set(auth())
      expect(preview.status).toBe(404)
      const commit = await http().post(`/api/v1/imports/${FOREIGN_JOB}/commit`).set(auth()).send({})
      expect(commit.status).toBe(404)
    })

    it('rejects an unknown body field (forbidNonWhitelisted guards mass assignment)', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS, rows: allValidRows(apartmentNumbers),
      })
      const up = await upload(buf)
      const res = await http()
        .post(`/api/v1/imports/${up.body.job.id}/mapping`)
        .set(auth())
        .send({ mapping: [{ field: 'fullName', index: 0 }], tenantId: 'other-tenant' })
      expect(res.status).toBe(400)
    })
  })

  // ── Header mapping ───────────────────────────────────────────────────────

  describe('column mapping', () => {
    it('maps Hebrew headers, including ת.ז. and אחוז בעלות', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS, rows: allValidRows(apartmentNumbers),
      })
      const res = await upload(buf)
      const byField = Object.fromEntries(
        res.body.mapping.filter((m: any) => m.field).map((m: any) => [m.field, m]),
      )
      expect(byField.fullName.column).toBe('שם בעלים')
      expect(byField.nationalId.column).toBe('ת.ז.')
      expect(byField.phone.column).toBe('טלפון')
      expect(byField.email.column).toBe('אימייל')
      expect(byField.apartmentNumber.column).toBe('דירה')
      expect(byField.share.column).toBe('אחוז בעלות')
    })

    it('maps English headers', async () => {
      const buf = await buildWorkbook({
        headers: ENGLISH_OWNER_HEADERS, rows: allValidRows(apartmentNumbers),
      })
      const res = await upload(buf)
      const byField = Object.fromEntries(
        res.body.mapping.filter((m: any) => m.field).map((m: any) => [m.field, m]),
      )
      expect(byField.fullName.column).toBe('Owner Name')
      expect(byField.nationalId.column).toBe('ID Number')
      expect(byField.apartmentNumber.column).toBe('Apartment')
      expect(byField.share.column).toBe('Ownership Share')
    })

    it('never silently maps an unrecognised column, and flags low confidence for confirmation', async () => {
      const buf = await buildWorkbook({
        headers: ['שם בעלים', 'עמודה מוזרה כלשהי', 'דירה'],
        rows: [['פלוני', 'ערך', '1']],
      })
      const res = await upload(buf)
      const weird = res.body.mapping.find((m: any) => m.column === 'עמודה מוזרה כלשהי')
      expect(weird.field).toBeNull()
      // Anything short of an exact alias hit must be confirmed by the user.
      for (const m of res.body.mapping) {
        if (m.field && m.confidence < 1) expect(m.needsConfirmation).toBe(true)
      }
    })

    it('masks the national ID column in the preview sample', async () => {
      const id = validNationalId(101)
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [['פלוני אלמוני', id, '0501112233', 'x@example.com', '1', '1/1', '']],
      })
      const res = await upload(buf)
      const flat = JSON.stringify(res.body.sample)
      expect(flat).not.toContain(id)
      expect(flat).toContain('ספרות')
    })

    it('refuses a mapping that leaves a required field unmapped', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS, rows: allValidRows(apartmentNumbers),
      })
      const up = await upload(buf)
      const res = await http()
        .post(`/api/v1/imports/${up.body.job.id}/mapping`)
        .set(auth())
        // apartmentNumber is required and absent.
        .send({ mapping: [{ field: 'fullName', index: 0 }] })
      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body)).toContain('IMPORT_REQUIRED_FIELD_UNMAPPED')
    })

    it('refuses one column mapped to two fields', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS, rows: allValidRows(apartmentNumbers),
      })
      const up = await upload(buf)
      const res = await http()
        .post(`/api/v1/imports/${up.body.job.id}/mapping`)
        .set(auth())
        .send({
          mapping: [
            { field: 'fullName', index: 0 },
            { field: 'apartmentNumber', index: 0 },
          ],
        })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('IMPORT_COLUMN_REUSED')
    })
  })

  // ── Validation and preview ───────────────────────────────────────────────

  describe('validation', () => {
    let jobId: string
    let preview: any

    beforeAll(async () => {
      // Own building, so no earlier commit can add a share-sum error here.
      const numbers = await makeBuilding('2', 'ביאליק')
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS, rows: mixedInvalidRows(numbers),
      })
      const up = await upload(buf)
      jobId = up.body.job.id
      await confirmSuggested(jobId, up.body.mapping)
      const res = await http().post(`/api/v1/imports/${jobId}/preview`).set(auth())
      expect(res.status).toBe(200)
      preview = res.body
    })

    const codesForRow = (rowNumber: number): string[] =>
      preview.rows.find((r: any) => r.rowNumber === rowNumber)?.issues.map((i: any) => i.code) ?? []

    it('reports one valid row and six invalid ones', () => {
      expect(preview.counts.total).toBe(7)
      expect(preview.counts.create).toBe(1)
      expect(preview.counts.invalid).toBe(6)
    })

    it('rejects an invalid phone via the shared isValidPhone rule', () => {
      expect(codesForRow(3)).toContain('IMPORT_PHONE_INVALID')
    })

    it('rejects an invalid email via the shared isValidEmail rule', () => {
      expect(codesForRow(4)).toContain('IMPORT_EMAIL_INVALID')
    })

    it('rejects a bad national ID check digit via NationalIdService.isValid', () => {
      expect(codesForRow(5)).toContain('IMPORT_NATIONAL_ID_INVALID')
    })

    it('rejects an apartment that is not in this project', () => {
      expect(codesForRow(6)).toContain('IMPORT_APARTMENT_NOT_FOUND')
    })

    it('rejects a missing name', () => {
      expect(codesForRow(7)).toContain('IMPORT_NAME_REQUIRED')
    })

    it('rejects an ownership share above 100%', () => {
      expect(codesForRow(8)).toContain('IMPORT_SHARE_UNPARSEABLE')
    })

    it('never puts a national ID in the preview payload', () => {
      const flat = JSON.stringify(preview)
      for (const seed of [55, 66, 77, 99, 12, 13]) {
        expect(flat).not.toContain(validNationalId(seed))
      }
      expect(flat).not.toContain(invalidNationalId(88))
    })

    it('detects a duplicate national ID within the same file', async () => {
      const dupe = validNationalId(202)
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [
          ['ראשון', dupe, '0521112233', 'a@example.com', '3', '1/1', ''],
          ['שני',   dupe, '0521112244', 'b@example.com', '4', '1/1', ''],
        ],
      })
      const up = await upload(buf)
      await confirmSuggested(up.body.job.id, up.body.mapping)
      const res = await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      expect(res.status).toBe(200)
      const codes = res.body.rows.flatMap((r: any) => r.issues.map((i: any) => i.code))
      expect(codes).toContain('IMPORT_NATIONAL_ID_DUPLICATE_IN_FILE')
      expect(JSON.stringify(res.body)).not.toContain(dupe)
    })

    it('reads a formula cell\'s cached RESULT and never the formula text', async () => {
      const buf = await buildFormulaWorkbook(
        HEBREW_OWNER_HEADERS,
        [{
          values: ['פורמולה', validNationalId(303), '0531112233', 'f@example.com', '5', null, ''],
          formulaCol: 6,
          formula: 'A1&"/"&"3"',
          result: '1/3',
        }],
      )
      const up = await upload(buf)
      await confirmSuggested(up.body.job.id, up.body.mapping)
      const res = await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      expect(res.status).toBe(200)
      expect(res.body.rows[0].imported.share).toBe('1/3')
      expect(JSON.stringify(res.body)).not.toContain('A1&')
    })
  })

  // ── Fraction exactness ───────────────────────────────────────────────────

  describe('fraction exactness, spreadsheet cell to stored numerator/denominator', () => {
    it('stores 1/3 exactly and sums three heirs to exactly 1', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [
          ['יורש א', validNationalId(401), '0541112201', 'h1@example.com', '7', '1/3', ''],
          ['יורש ב', validNationalId(402), '0541112202', 'h2@example.com', '7', '1/3', ''],
          ['יורש ג', validNationalId(403), '0541112203', 'h3@example.com', '7', '1/3', ''],
        ],
      })
      const up = await upload(buf)
      await confirmSuggested(up.body.job.id, up.body.mapping)
      await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      const commit = await http().post(`/api/v1/imports/${up.body.job.id}/commit`).set(auth()).send({})
      expect(commit.status).toBe(200)

      const apt7 = apartmentIds[apartmentNumbers.indexOf('7')]
      const holdings = await prisma.ownerApartment.findMany({
        where: { apartmentId: apt7 },
        select: { shareNumerator: true, shareDenominator: true },
      })
      expect(holdings).toHaveLength(3)
      for (const h of holdings) {
        // 1/3 stored as the reduced integer pair — not 0.3333 and not 33/100.
        expect(h.shareNumerator).toBe(1)
        expect(h.shareDenominator).toBe(3)
      }
    })

    it('stores 33.33% as 3333/10000, and reports the resulting gap rather than rounding it away', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [
          ['אחוזון א', validNationalId(501), '0551112201', 'p1@example.com', '8', '33.33%', ''],
          ['אחוזון ב', validNationalId(502), '0551112202', 'p2@example.com', '8', '33.33%', ''],
          ['אחוזון ג', validNationalId(503), '0551112203', 'p3@example.com', '8', '33.33%', ''],
        ],
      })
      const up = await upload(buf)
      await confirmSuggested(up.body.job.id, up.body.mapping)
      const preview = await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      expect(preview.status).toBe(200)
      // 9999/10000 is exactly not 1, and the shared OwnershipService says so.
      expect(JSON.stringify(preview.body)).toContain('9999/10000')

      const commit = await http().post(`/api/v1/imports/${up.body.job.id}/commit`).set(auth()).send({})
      expect(commit.status).toBe(200)

      const apt8 = apartmentIds[apartmentNumbers.indexOf('8')]
      const holdings = await prisma.ownerApartment.findMany({
        where: { apartmentId: apt8 },
        select: { shareNumerator: true, shareDenominator: true },
      })
      expect(holdings).toHaveLength(3)
      for (const h of holdings) {
        expect(h.shareNumerator).toBe(3333)
        expect(h.shareDenominator).toBe(10000)
      }
    })
  })

  // ── Commit, duplicates, modes, idempotency ───────────────────────────────

  describe('commit', () => {
    const ids = { a: validNationalId(601), b: validNationalId(602) }

    it('creates owners, links them to apartments and writes audit rows', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [
          ['אבי לוי',  ids.a, '0561112201', 'avi@example.com',  '1', '1/1', 'הערה'],
          ['בת חן',    ids.b, '0561112202', 'bat@example.com',  '2', '1/1', ''],
        ],
      })
      const up = await upload(buf)
      await confirmSuggested(up.body.job.id, up.body.mapping)
      await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      const res = await http().post(`/api/v1/imports/${up.body.job.id}/commit`).set(auth()).send({})
      expect(res.status).toBe(200)
      expect(res.body.job.status).toBe('COMPLETED')
      expect(res.body.job.createdRows).toBe(2)

      const avi = await prisma.owner.findFirst({ where: { tenantId, fullName: 'אבי לוי' } })
      expect(avi).toBeTruthy()
      // Encrypted at rest — the plaintext is never what is stored.
      expect(avi!.nationalId).toBeTruthy()
      expect(avi!.nationalId).not.toBe(ids.a)

      expect(
        await prisma.auditLog.count({
          where: { tenantId, entity: 'Owner', entityId: avi!.id, action: 'CREATE' },
        }),
      ).toBe(1)
      expect(
        await prisma.ownerApartment.count({
          where: { ownerId: avi!.id, apartmentId: apartmentIds[0] },
        }),
      ).toBe(1)
    })

    it('never records a national ID in the audit trail', async () => {
      const rows = await prisma.auditLog.findMany({
        where: { tenantId, entity: 'Owner' },
        select: { changes: true, metadata: true },
        take: 200,
      })
      const flat = JSON.stringify(rows)
      expect(flat).not.toContain(ids.a)
      expect(flat).not.toContain(ids.b)
      // The FACT is auditable, the value is not.
      expect(flat).toContain('nationalIdProvided')
    })

    it('re-uploading the same file updates in place and creates no duplicate owner', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [
          ['אבי לוי', ids.a, '0561112201', 'avi@example.com', '1', '1/1', 'הערה'],
          ['בת חן',   ids.b, '0561112202', 'bat@example.com', '2', '1/1', ''],
        ],
      })
      const before = await prisma.owner.count({ where: { tenantId, fullName: 'אבי לוי' } })

      const up = await upload(buf)
      await confirmSuggested(up.body.job.id, up.body.mapping)
      const preview = await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      // Matched on the national ID fingerprint, so both rows are updates.
      expect(preview.body.counts.update).toBe(2)
      expect(preview.body.counts.create).toBe(0)

      const res = await http().post(`/api/v1/imports/${up.body.job.id}/commit`).set(auth()).send({})
      expect(res.status).toBe(200)
      expect(res.body.job.updatedRows).toBe(2)
      expect(res.body.job.createdRows).toBe(0)

      const after = await prisma.owner.count({ where: { tenantId, fullName: 'אבי לוי' } })
      expect(after).toBe(before)
    })

    it('ADD_ONLY skips an existing owner instead of updating it', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [['אבי לוי', ids.a, '0561112299', 'changed@example.com', '1', '1/1', '']],
      })
      const up = await upload(buf, { mode: 'ADD_ONLY' })
      await confirmSuggested(up.body.job.id, up.body.mapping, 'ADD_ONLY')
      const preview = await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      expect(preview.body.counts.skipped).toBe(1)
      expect(preview.body.rows[0].outcome).toBe('SKIP_DUPLICATE')

      const res = await http().post(`/api/v1/imports/${up.body.job.id}/commit`).set(auth()).send({})
      expect(res.status).toBe(200)
      const avi = await prisma.owner.findFirst({ where: { tenantId, fullName: 'אבי לוי' } })
      // Untouched.
      expect(avi!.email).toBe('avi@example.com')
    })

    it('UPDATE_ONLY skips a row with no existing match', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [['חדש לגמרי', validNationalId(701), '0571112201', 'new@example.com', '3', '1/1', '']],
      })
      const up = await upload(buf, { mode: 'UPDATE_ONLY' })
      await confirmSuggested(up.body.job.id, up.body.mapping, 'UPDATE_ONLY')
      const preview = await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      expect(preview.body.rows[0].outcome).toBe('SKIP_MODE')

      const res = await http().post(`/api/v1/imports/${up.body.job.id}/commit`).set(auth()).send({})
      expect(res.status).toBe(200)
      expect(res.body.job.createdRows).toBe(0)
      expect(await prisma.owner.count({ where: { tenantId, fullName: 'חדש לגמרי' } })).toBe(0)
    })

    it('rolls back completely when the share sum would exceed 1 — nothing is written', async () => {
      // Apartment 1 is already fully owned by אבי לוי at 1/1. Adding a second
      // owner at 1/1 pushes the sum to 2 and OwnershipService must refuse it.
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [
          ['פולש ראשון', validNationalId(801), '0581112201', 'x1@example.com', '1', '1/1', ''],
          ['פולש שני',   validNationalId(802), '0581112202', 'x2@example.com', '4', '1/1', ''],
        ],
      })
      const up = await upload(buf)
      await confirmSuggested(up.body.job.id, up.body.mapping)
      await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())

      const res = await http().post(`/api/v1/imports/${up.body.job.id}/commit`).set(auth()).send({})
      expect(res.status).toBe(400)

      // NEITHER owner exists — including the one whose own row was fine. That
      // is the point of the single transaction.
      expect(await prisma.owner.count({ where: { tenantId, fullName: 'פולש ראשון' } })).toBe(0)
      expect(await prisma.owner.count({ where: { tenantId, fullName: 'פולש שני' } })).toBe(0)

      const job = await prisma.importJob.findUnique({ where: { id: up.body.job.id } })
      expect(job!.status).toBe('FAILED')
      expect(job!.createdRows).toBe(0)
      expect(job!.failureReason).toBeTruthy()
    })

    it('preserves a co-owner the sheet does not mention', async () => {
      // Apartment 5 gets one owner at 1/2 via a direct write, then an import
      // adds a second at 1/2. The first must survive.
      const apt5 = apartmentIds[apartmentNumbers.indexOf('5')]
      const existing = await prisma.owner.create({
        data: { tenantId, fullName: `${TAG} שותף קיים`, phone: '0591112201' },
      })
      await prisma.ownerApartment.create({
        data: { ownerId: existing.id, apartmentId: apt5, shareNumerator: 1, shareDenominator: 2 },
      })

      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [['שותף חדש', validNationalId(901), '0591112202', 'c@example.com', '5', '1/2', '']],
      })
      const up = await upload(buf)
      await confirmSuggested(up.body.job.id, up.body.mapping)
      await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      const res = await http().post(`/api/v1/imports/${up.body.job.id}/commit`).set(auth()).send({})
      expect(res.status).toBe(200)

      const holdings = await prisma.ownerApartment.findMany({ where: { apartmentId: apt5 } })
      expect(holdings).toHaveLength(2)
      expect(holdings.some((h) => h.ownerId === existing.id)).toBe(true)
    })
  })

  // ── Report and history ───────────────────────────────────────────────────

  describe('error report and history', () => {
    let jobId: string

    beforeAll(async () => {
      const numbers = await makeBuilding('3', 'ז׳בוטינסקי')
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS, rows: mixedInvalidRows(numbers),
      })
      const up = await upload(buf)
      jobId = up.body.job.id
      await confirmSuggested(jobId, up.body.mapping)
      await http().post(`/api/v1/imports/${jobId}/preview`).set(auth())
    })

    it('serves a CSV with a UTF-8 BOM and no national ID digits', async () => {
      const res = await http().get(`/api/v1/imports/${jobId}/errors.csv`).set(auth())
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/csv')
      expect(res.headers['content-disposition']).toContain('attachment')
      const body = res.text
      // BOM, so Excel opens the Hebrew correctly.
      expect(body.charCodeAt(0)).toBe(0xfeff)
      expect(body).toContain('שגיאה')
      for (const seed of [55, 66, 77, 99, 12, 13]) {
        expect(body).not.toContain(validNationalId(seed))
      }
      expect(body).not.toContain(invalidNationalId(88))
    })

    it('lists the job in the project history with its counters', async () => {
      const res = await http().get('/api/v1/imports').query({ projectId }).set(auth())
      expect(res.status).toBe(200)
      const job = res.body.find((j: any) => j.id === jobId)
      expect(job).toBeTruthy()
      expect(job.failedRows).toBe(6)
      expect(job.fileName).toBe('owners.xlsx')
      // The storage key must not appear in a list payload either.
      expect(job.storageKey).toBeUndefined()
    })

    it('exposes per-row issues with masked values and a recommended correction', async () => {
      const res = await http().get(`/api/v1/imports/${jobId}/issues`).set(auth())
      expect(res.status).toBe(200)
      const idIssue = res.body.find((i: any) => i.code === 'IMPORT_NATIONAL_ID_INVALID')
      expect(idIssue).toBeTruthy()
      expect(idIssue.currentValue).toContain('ספרות')
      expect(idIssue.suggestion).toBeTruthy()
    })

    it('cancel deletes the stored workbook and blocks a later commit', async () => {
      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [['לביטול', validNationalId(1001), '0501119999', 'z@example.com', '6', '1/1', '']],
      })
      const up = await upload(buf)
      const cancelled = await http().post(`/api/v1/imports/${up.body.job.id}/cancel`).set(auth()).send()
      expect(cancelled.status).toBe(200)
      expect(cancelled.body.status).toBe('CANCELLED')

      const commit = await http().post(`/api/v1/imports/${up.body.job.id}/commit`).set(auth()).send({})
      expect(commit.status).toBe(409)
    })
  })

  // ── At-rest encryption of the stored workbook (A1) ───────────────────────

  /**
   * The workbook is kept permanently and its cells hold national IDs in
   * plaintext, so storing it unencrypted would defeat the encrypted
   * `Owner.nationalId` column it feeds.
   *
   * These tests read the object out of MinIO with a RAW S3 client, deliberately
   * bypassing `StorageService.download`. Asserting through `download()` would
   * prove nothing — it decrypts, so it returns a valid workbook either way.
   */
  describe('workbook encryption at rest', () => {
     
    const rawS3 = () => {
      const { S3Client } = require('@aws-sdk/client-s3')
      return new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? 'auto',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY!,
          secretAccessKey: process.env.S3_SECRET_KEY!,
        },
        forcePathStyle: true,
      })
    }

    /** The bytes exactly as they sit in the bucket. No decryption. */
    const rawObject = async (key: string): Promise<Buffer> => {
      const { GetObjectCommand } = require('@aws-sdk/client-s3')
      const res = await rawS3().send(
        new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
      )
      const chunks: Buffer[] = []
      for await (const c of res.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(c))
      return Buffer.concat(chunks)
    }
     

    /** 'PK\x03\x04' — the local file header every ZIP, and so every .xlsx, opens with. */
    const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])

    let key: string
    let plaintext: Buffer

    beforeAll(async () => {
      plaintext = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        rows: [['סודי כהן', validNationalId(4242), '0509998877', 's@example.com', apartmentNumbers[7], '1/1', '']],
      })
      const up = await upload(plaintext, { fileName: 'secret.xlsx' })
      expect(up.status).toBe(201)
      const job = await prisma.importJob.findUnique({
        where: { id: up.body.job.id },
        select: { storageKey: true },
      })
      key = job!.storageKey!
      expect(key).toBeTruthy()
    })

    it('stores ciphertext — the object in the bucket is NOT a readable xlsx', async () => {
      const stored = await rawObject(key)
      expect(stored.subarray(0, 4).equals(ZIP_MAGIC)).toBe(false)
      // It carries our binary-encryption header instead.
      expect(stored.subarray(0, 4).toString('ascii')).toBe('ENCB')
      // Format version, then KEY version — the byte that lets per-tenant DEKs
      // be introduced later without re-encrypting anything already stored.
      expect(stored.readUInt8(4)).toBe(1)
      expect(stored.readUInt8(5)).toBe(1)
      // Ciphertext, not the original bytes with a header bolted on.
      expect(stored.length).toBe(plaintext.length + 34)
      expect(stored.subarray(34).equals(plaintext)).toBe(false)
    })

    it('the national ID does not appear literally in the stored bytes', async () => {
      const stored = await rawObject(key)
      expect(stored.includes(Buffer.from(validNationalId(4242), 'utf8'))).toBe(false)
    })

    it('round-trips: the decrypted object is byte-identical to the original workbook', async () => {
      const back = await storage.download(tenantId, key)
      expect(back.equals(plaintext)).toBe(true)
      expect(back.subarray(0, 4).equals(ZIP_MAGIC)).toBe(true)
    })

    it('re-reads the encrypted workbook through the normal workflow (preview works)', async () => {
      const up = await upload(plaintext, { fileName: 'secret2.xlsx' })
      await confirmSuggested(up.body.job.id, up.body.mapping)
      // Preview downloads and re-parses the STORED object — it only succeeds if
      // decryption happened on the way back.
      const res = await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      expect(res.status).toBe(200)
      expect(res.body.totalRows).toBe(1)
    })

    it('still reads a LEGACY object stored before encryption existed', async () => {
      // Written with the flag off — byte-for-byte what the old code produced.
      const legacyKey = await storage.upload(
        tenantId, 'imports', 'legacy.xlsx', plaintext,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      storageKeys.push(legacyKey)
      const stored = await rawObject(legacyKey)
      expect(stored.subarray(0, 4).equals(ZIP_MAGIC)).toBe(true) // genuinely unencrypted
      // Read back through the same download path, which must NOT try to decrypt it.
      const back = await storage.download(tenantId, legacyKey)
      expect(back.equals(plaintext)).toBe(true)
    })

    it('a tampered encrypted object fails the auth tag instead of returning plaintext', async () => {
       
      const { PutObjectCommand } = require('@aws-sdk/client-s3')
      const stored = await rawObject(key)
      const tampered = Buffer.from(stored)
      // Flip a bit in the ciphertext, leaving the header intact.
      tampered[40] = tampered[40] ^ 0xff
      const badKey = `${tenantId}/imports/tampered-${Date.now()}.bin`
      await rawS3().send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET, Key: badKey, Body: tampered,
      }))
      storageKeys.push(badKey)
      await expect(storage.download(tenantId, badKey)).rejects.toThrow()
    })
  })

  // ── Ambiguous-duplicate resolution queue (A2) ─────────────────────────────

  /**
   * A phone match is ALWAYS ambiguous by design — two heirs sharing a household
   * landline is common, so the matcher never merges on it. Two existing owners
   * with the same phone therefore produce a genuine two-candidate queue entry.
   */
  describe('ambiguous duplicate resolution queue', () => {
    let reviewApts: string[]

    /**
     * Fresh scenario per test: two decoy owners sharing one phone, one
     * apartment, and a job previewed to the point where the row is
     * NEEDS_REVIEW. Each test gets its own phone and apartment so committing in
     * one does not shift the candidate set in another.
     */
    const scenario = async (n: number, opts: { mode?: string; nationalId?: string } = {}) => {
      const mode = opts.mode ?? 'ADD_AND_UPDATE'
      const phone = `05266${String(10000 + n).slice(-5)}`
      const a = await prisma.owner.create({
        data: { tenantId, fullName: `מועמד א ${n}`, phone },
      })
      const b = await prisma.owner.create({
        data: { tenantId, fullName: `מועמד ב ${n}`, phone },
      })
      decoyOwnerIds.push(a.id, b.id)

      const buf = await buildWorkbook({
        headers: HEBREW_OWNER_HEADERS,
        // The ת.ז. cell is normally EMPTY: with no id to match on, the matcher
        // falls back to the phone, which is always ambiguous by design. A
        // caller may supply one that matches no existing owner — the fallback
        // still runs, and it lets a test assert the digits never surface.
        rows: [[`שורה מגיליון ${n}`, opts.nationalId ?? '', phone, `q${n}@example.com`, reviewApts[n], '1/1', '']],
      })
      const up = await upload(buf, { mode })
      expect(up.status).toBe(201)
      const jobId = up.body.job.id
      await confirmSuggested(jobId, up.body.mapping, mode)
      const preview = await http().post(`/api/v1/imports/${jobId}/preview`).set(auth())
      expect(preview.status).toBe(200)
      expect(preview.body.rows[0].outcome).toBe('NEEDS_REVIEW')
      return { jobId, a, b, phone }
    }

    const getReview = (jobId: string, token = adminToken) =>
      http().get(`/api/v1/imports/${jobId}/review`).set(auth(token))

    const postReview = (jobId: string, decisions: any[], token = adminToken) =>
      http().post(`/api/v1/imports/${jobId}/review`).set(auth(token)).send({ decisions })

    beforeAll(async () => {
      // Three buildings: each scenario below takes its OWN apartment (index
      // `n`), because several of them commit a 1/1 holding and a reused
      // apartment would push a later scenario's share sum past 1.
      reviewApts = [
        ...(await makeBuilding('Q', 'ויצמן')),
        ...(await makeBuilding('W', 'ז׳בוטינסקי')),
        ...(await makeBuilding('E', 'בן גוריון')),
      ]
    })

    it('lists the ambiguous row with BOTH candidates and the match reason', async () => {
      const { jobId, a, b } = await scenario(0)
      const res = await getReview(jobId)
      expect(res.status).toBe(200)
      expect(res.body.totalAmbiguous).toBe(1)
      expect(res.body.undecided).toBe(1)
      const row = res.body.rows[0]
      expect(row.matchReason).toBe('PHONE')
      expect(row.candidates.map((c: any) => c.entityId).sort()).toEqual([a.id, b.id].sort())
      // Side by side: the sheet's values against each existing record.
      expect(row.imported.name).toBe('שורה מגיליון 0')
      expect(row.candidates.find((c: any) => c.entityId === a.id).name).toBe('מועמד א 0')
      expect(row.decision).toBeNull()
    })

    it('never leaks a national ID into the queue payload', async () => {
      const secretId = validNationalId(5150)
      const { jobId } = await scenario(1, { nationalId: secretId })
      const res = await getReview(jobId)
      // The id IS in the sheet and WAS parsed — the queue reports only that it
      // exists, never the digits. (A blanket /\d{9}/ sweep would be a false
      // positive: phone numbers legitimately appear in this payload.)
      expect(res.body.rows[0].imported.hasNationalId).toBe(true)
      expect(JSON.stringify(res.body)).not.toContain(secretId)
    })

    it('UPDATE_EXISTING applies the row to the CHOSEN record and creates no new owner', async () => {
      const { jobId, a, b } = await scenario(2)
      const before = await prisma.owner.count({ where: { tenantId } })

      const resolved = await postReview(jobId, [
        { rowNumber: 2, action: 'UPDATE_EXISTING', targetEntityId: b.id },
      ])
      expect(resolved.status).toBe(200)
      expect(resolved.body.undecided).toBe(0)
      expect(resolved.body.rows[0].decision).toEqual({
        action: 'UPDATE_EXISTING', targetEntityId: b.id,
      })

      const preview = await http().post(`/api/v1/imports/${jobId}/preview`).set(auth())
      expect(preview.body.rows[0].outcome).toBe('UPDATE')

      const commit = await http().post(`/api/v1/imports/${jobId}/commit`).set(auth()).send({})
      expect(commit.status).toBe(200)
      expect(commit.body.job.updatedRows).toBe(1)
      expect(commit.body.job.createdRows).toBe(0)

      // The chosen record took the sheet's values; the OTHER candidate is
      // untouched. Nothing was merged.
      expect((await prisma.owner.findUnique({ where: { id: b.id } }))!.fullName)
        .toBe('שורה מגיליון 2')
      expect((await prisma.owner.findUnique({ where: { id: a.id } }))!.fullName)
        .toBe('מועמד א 2')
      expect(await prisma.owner.count({ where: { tenantId } })).toBe(before)
    })

    it('CREATE_NEW creates a separate record and leaves BOTH candidates intact', async () => {
      const { jobId, a, b } = await scenario(3)

      expect((await postReview(jobId, [{ rowNumber: 2, action: 'CREATE_NEW' }])).status).toBe(200)
      const preview = await http().post(`/api/v1/imports/${jobId}/preview`).set(auth())
      expect(preview.body.rows[0].outcome).toBe('CREATE')

      const commit = await http().post(`/api/v1/imports/${jobId}/commit`).set(auth()).send({})
      expect(commit.status).toBe(200)
      expect(commit.body.job.createdRows).toBe(1)
      expect(commit.body.job.updatedRows).toBe(0)

      const created = await prisma.owner.findFirst({
        where: { tenantId, fullName: 'שורה מגיליון 3' },
      })
      expect(created).toBeTruthy()
      expect(created!.id).not.toBe(a.id)
      expect(created!.id).not.toBe(b.id)
      // Neither candidate was modified — the point of "never auto-merge".
      expect((await prisma.owner.findUnique({ where: { id: a.id } }))!.fullName).toBe('מועמד א 3')
      expect((await prisma.owner.findUnique({ where: { id: b.id } }))!.fullName).toBe('מועמד ב 3')
    })

    it('SKIP imports nothing at all', async () => {
      const { jobId, a, b } = await scenario(4)
      expect((await postReview(jobId, [{ rowNumber: 2, action: 'SKIP' }])).status).toBe(200)

      const commit = await http().post(`/api/v1/imports/${jobId}/commit`).set(auth()).send({})
      expect(commit.status).toBe(200)
      expect(commit.body.job.createdRows).toBe(0)
      expect(commit.body.job.updatedRows).toBe(0)
      expect((await prisma.owner.findUnique({ where: { id: a.id } }))!.fullName).toBe('מועמד א 4')
      expect((await prisma.owner.findUnique({ where: { id: b.id } }))!.fullName).toBe('מועמד ב 4')
      expect(await prisma.owner.count({ where: { tenantId, fullName: 'שורה מגיליון 4' } })).toBe(0)
    })

    it('an undecided row is still NOT imported — the default remains "never auto-merge"', async () => {
      const { jobId } = await scenario(5)
      const commit = await http().post(`/api/v1/imports/${jobId}/commit`).set(auth()).send({})
      expect(commit.status).toBe(200)
      expect(commit.body.job.createdRows).toBe(0)
      expect(commit.body.job.updatedRows).toBe(0)
    })

    it('a decision persists across a re-preview (it is not wiped with the issue rows)', async () => {
      const { jobId, b } = await scenario(6)
      await postReview(jobId, [{ rowNumber: 2, action: 'UPDATE_EXISTING', targetEntityId: b.id }])
      // persistIssues DELETES and recreates every ImportRowIssue for the job.
      await http().post(`/api/v1/imports/${jobId}/preview`).set(auth())
      await http().post(`/api/v1/imports/${jobId}/preview`).set(auth())
      const res = await getReview(jobId)
      expect(res.body.rows[0].decision.targetEntityId).toBe(b.id)
      expect(res.body.undecided).toBe(0)
    })

    it('a decision whose target stopped being a candidate FAILS the row instead of writing', async () => {
      const { jobId, a, b } = await scenario(7)
      await postReview(jobId, [{ rowNumber: 2, action: 'UPDATE_EXISTING', targetEntityId: b.id }])

      // Someone else changes the chosen record's phone, so it no longer matches.
      await prisma.owner.update({ where: { id: b.id }, data: { phone: '0529999999' } })

      const preview = await http().post(`/api/v1/imports/${jobId}/preview`).set(auth())
      expect(preview.status).toBe(200)
      const row = preview.body.rows[0]
      expect(row.outcome).toBe('INVALID')
      expect(row.issues.map((i: any) => i.code)).toContain('IMPORT_DECISION_TARGET_STALE')

      const commit = await http().post(`/api/v1/imports/${jobId}/commit`).set(auth()).send({})
      expect(commit.status).toBe(200)
      expect(commit.body.job.createdRows).toBe(0)
      expect(commit.body.job.updatedRows).toBe(0)
      // The stale target was NOT written to.
      expect((await prisma.owner.findUnique({ where: { id: b.id } }))!.fullName).toBe('מועמד ב 7')
      expect((await prisma.owner.findUnique({ where: { id: a.id } }))!.fullName).toBe('מועמד א 7')
    })

    it('clearing a decision returns the row to the queue undecided', async () => {
      const { jobId, b } = await scenario(8)
      await postReview(jobId, [{ rowNumber: 2, action: 'UPDATE_EXISTING', targetEntityId: b.id }])
      const cleared = await http()
        .delete(`/api/v1/imports/${jobId}/review/2`)
        .set(auth())
      expect(cleared.status).toBe(200)
      expect(cleared.body.undecided).toBe(1)
      expect(cleared.body.rows[0].decision).toBeNull()
    })

    it('refuses UPDATE_EXISTING with no target', async () => {
      const { jobId } = await scenario(9)
      const res = await postReview(jobId, [{ rowNumber: 2, action: 'UPDATE_EXISTING' }])
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('IMPORT_DECISION_TARGET_REQUIRED')
    })

    it("refuses a target that is not one of the row's candidates", async () => {
      const { jobId } = await scenario(10)
      const stranger = await prisma.owner.create({
        data: { tenantId, fullName: 'זר גמור', phone: '0521010101' },
      })
      decoyOwnerIds.push(stranger.id)
      const res = await postReview(jobId, [
        { rowNumber: 2, action: 'UPDATE_EXISTING', targetEntityId: stranger.id },
      ])
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('IMPORT_DECISION_TARGET_INVALID')
    })

    it("refuses another tenant's entity id as a target (it is simply not a candidate)", async () => {
      const { jobId } = await scenario(11)
      const res = await postReview(jobId, [
        { rowNumber: 2, action: 'UPDATE_EXISTING', targetEntityId: 'own_from_another_tenant' },
      ])
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('IMPORT_DECISION_TARGET_INVALID')
    })

    it('refuses a ruling on a row that is not awaiting one', async () => {
      const { jobId } = await scenario(12)
      const res = await postReview(jobId, [{ rowNumber: 999, action: 'SKIP' }])
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('IMPORT_DECISION_ROW_NOT_AMBIGUOUS')
    })

    it('refuses a target on an action that takes none', async () => {
      const { jobId, b } = await scenario(13)
      const res = await postReview(jobId, [
        { rowNumber: 2, action: 'SKIP', targetEntityId: b.id },
      ])
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('IMPORT_DECISION_TARGET_NOT_ALLOWED')
    })

    it('rejects an unknown body field on the review route', async () => {
      const { jobId } = await scenario(14)
      const res = await http()
        .post(`/api/v1/imports/${jobId}/review`)
        .set(auth())
        .send({ decisions: [{ rowNumber: 2, action: 'SKIP' }], jobId: 'other' })
      expect(res.status).toBe(400)
    })

    it('refuses a role outside IMPORT_ROLES on every review route with 403', async () => {
      const { jobId, b } = await scenario(15)
      expect((await getReview(jobId, observerToken)).status).toBe(403)
      expect((await postReview(jobId, [
        { rowNumber: 2, action: 'UPDATE_EXISTING', targetEntityId: b.id },
      ], observerToken)).status).toBe(403)
      const del = await http()
        .delete(`/api/v1/imports/${jobId}/review/2`)
        .set(auth(observerToken))
      expect(del.status).toBe(403)
    })

    it("returns 404 for another tenant's job on the review routes — never 403", async () => {
      expect((await getReview(FOREIGN_JOB)).status).toBe(404)
      expect((await postReview(FOREIGN_JOB, [{ rowNumber: 2, action: 'SKIP' }])).status).toBe(404)
    })

    it('records the ruling in the audit trail without any sheet values', async () => {
      const { jobId, b } = await scenario(16)
      await postReview(jobId, [
        { rowNumber: 2, action: 'UPDATE_EXISTING', targetEntityId: b.id, note: 'אושר טלפונית' },
      ])
      const logs = await prisma.auditLog.findMany({
        where: { tenantId, entity: 'ImportJob', entityId: jobId },
      })
      const resolveLog = logs.find((l) =>
        JSON.stringify(l.changes ?? {}).includes('resolvedRows'),
      )
      expect(resolveLog).toBeTruthy()
      const blob = JSON.stringify(resolveLog)
      expect(blob).toContain('UPDATE_EXISTING')
      // Row numbers and actions only — no names, no phones, no note text.
      expect(blob).not.toContain('שורה מגיליון 16')
      expect(blob).not.toContain('אושר טלפונית')
    })
  })

  // ── Residents ────────────────────────────────────────────────────────────

  describe('residents', () => {
    it('imports residents as a separate model, without touching ownership', async () => {
      const buf = await buildWorkbook({
        headers: ['שם פרטי', 'שם משפחה', 'ת.ז.', 'טלפון', 'דירה'],
        rows: [['משה', 'כהן', validNationalId(1101), '0502223301', '6']],
      })
      const up = await upload(buf, { entityType: 'RESIDENT' })
      expect(up.status).toBe(201)
      await confirmSuggested(up.body.job.id, up.body.mapping)
      await http().post(`/api/v1/imports/${up.body.job.id}/preview`).set(auth())
      const res = await http().post(`/api/v1/imports/${up.body.job.id}/commit`).set(auth()).send({})
      expect(res.status).toBe(200)
      expect(res.body.job.createdRows).toBe(1)

      const apt6 = apartmentIds[apartmentNumbers.indexOf('6')]
      const resident = await prisma.resident.findFirst({
        where: { tenantId, apartmentId: apt6, firstName: 'משה' },
      })
      expect(resident).toBeTruthy()
      expect(resident!.lastName).toBe('כהן')
      // An Owner row was NOT created — the two models stay distinct.
      expect(await prisma.owner.count({ where: { tenantId, fullName: 'משה כהן' } })).toBe(0)
    })
  })
})
