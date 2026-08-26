/**
 * Excel import performance harness — 10 / 100 / 1,000 / 5,000 rows.
 *
 * NOT part of the default suite. `jest.config.js` matches
 * `test/.*\.e2e-spec\.ts$`; this file is `perf/*.spec.ts`, so it only runs when
 * invoked explicitly:
 *
 *   npx jest --config jest.config.js --forceExit \
 *     --testRegex "test/perf/.*\\.spec\\.ts$"
 *
 * Kept out of the default run because a 5,000-row commit takes seconds and the
 * numbers are for the report, not a pass/fail gate. The assertions that ARE
 * here are the ones worth regressing on: query counts must not grow with row
 * count. A timing threshold would be flaky on a developer laptop; an N+1 is a
 * structural defect and shows up as a query count that scales.
 */
import { Test, TestingModule } from '@nestjs/testing'
import {
  INestApplication, ValidationPipe, VersioningType, OnModuleInit, OnModuleDestroy,
} from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { ThrottlerStorage } from '@nestjs/throttler'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/prisma.service'
import { StorageService } from '../../src/storage/storage.service'
import { buildWorkbook, validNationalId, HEBREW_OWNER_HEADERS } from '../helpers/excel-fixtures'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'
}

const SEED_EMAIL = 'admin@opendoor.co.il'
const SEED_PASSWORD = 'demo1234'
const TAG = `IMPORTPERF-${Date.now().toString(36)}`

/** Prisma with query events on, so we can count round trips. */
class LoggingPrisma extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ log: [{ emit: 'event', level: 'query' }] })
  }
  async onModuleInit() { await this.$connect() }
  async onModuleDestroy() { await this.$disconnect() }
}

interface Measurement {
  rows: number
  parseAndValidateMs: number
  commitMs: number
  previewQueries: number
  commitQueries: number
  created: number
}

describe('Excel import performance', () => {
  let app: INestApplication
  let prisma: any
  let storage: StorageService
  let tenantId: string
  let adminToken: string
  let projectId: string
  let complexId: string
  const buildingIds: string[] = []
  const apartmentIds: string[] = []
  const results: Measurement[] = []

  let queryCount = 0
  let counting = false

  const auth = () => ({ Authorization: `Bearer ${adminToken}` })
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useClass(LoggingPrisma)
      // See the note in excel-import.e2e-spec.ts — the guard is registered with
      // `useClass`, so its storage is the reliable seam.
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    )
    await app.init()

    prisma = app.get(PrismaService)
    storage = app.get(StorageService)
    prisma.$on('query', () => { if (counting) queryCount++ })

    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
    expect(login.status).toBe(200)
    adminToken = login.body.accessToken

    const decoded = JSON.parse(
      Buffer.from(adminToken.split('.')[1], 'base64').toString('utf8'),
    )
    tenantId = decoded.tenantId

    const project = await prisma.project.create({
      data: { tenantId, code: TAG.slice(0, 20), name: `${TAG} פרויקט`, city: 'תל אביב' },
    })
    projectId = project.id
    const complex = await prisma.complex.create({ data: { projectId, name: `${TAG} מתחם` } })
    complexId = complex.id

    // 7,000 apartments across 7 buildings of 1,000 — one apartment per imported
    // row, which is the worst case for the ownership plan builder. Seven
    // thousand covers the cumulative 6,110 the four runs consume (10 + 100 +
    // 1,000 + 5,000, each on fresh apartments so no run inherits an owner from
    // the previous one and trips the share-sum rule).
    for (let b = 0; b < 7; b++) {
      const building = await prisma.building.create({
        data: { complexId, address: `רחוב ${b}`, streetNumber: '1', city: 'תל אביב' },
      })
      buildingIds.push(building.id)
      await prisma.apartment.createMany({
        data: Array.from({ length: 1000 }, (_, i) => ({
          buildingId: building.id,
          apartmentNumber: `${b * 1000 + i + 1}`,
        })),
      })
    }
    const apts = await prisma.apartment.findMany({
      where: { buildingId: { in: buildingIds } },
      select: { id: true },
    })
    apartmentIds.push(...apts.map((a: any) => a.id))
    expect(apartmentIds).toHaveLength(7000)
  }, 300_000)

  afterAll(async () => {
    if (prisma) {
      const jobs = await prisma.importJob.findMany({
        where: { tenantId, projectId }, select: { id: true, storageKey: true },
      })
      for (const j of jobs) {
        if (j.storageKey) await storage.delete(tenantId, j.storageKey).catch(() => undefined)
      }
      const ownerIds = (
        await prisma.owner.findMany({
          where: { tenantId, fullName: { startsWith: TAG } }, select: { id: true },
        })
      ).map((o: any) => o.id)

      await prisma.auditLog.deleteMany({
        where: { tenantId, entityId: { in: [...jobs.map((j: any) => j.id), ...ownerIds, projectId] } },
      })
      await prisma.importRowIssue.deleteMany({ where: { jobId: { in: jobs.map((j: any) => j.id) } } })
      await prisma.importJob.deleteMany({ where: { tenantId, projectId } })
      await prisma.ownerApartment.deleteMany({ where: { apartmentId: { in: apartmentIds } } })
      await prisma.owner.deleteMany({ where: { id: { in: ownerIds } } })
      await prisma.apartment.deleteMany({ where: { buildingId: { in: buildingIds } } })
      await prisma.building.deleteMany({ where: { id: { in: buildingIds } } })
      await prisma.complex.deleteMany({ where: { id: complexId } })
      await prisma.projectStageHistory.deleteMany({ where: { projectId } })
      await prisma.project.deleteMany({ where: { id: projectId } })
    }
    await app?.close()

    // eslint-disable-next-line no-console
    console.log(
      '\n  rows | parse+validate | commit   | preview Q | commit Q | created\n' +
      '  -----+----------------+----------+-----------+----------+--------\n' +
      results
        .map((r) =>
          `  ${String(r.rows).padStart(4)} | ${String(r.parseAndValidateMs + 'ms').padStart(14)} | ` +
          `${String(r.commitMs + 'ms').padStart(8)} | ${String(r.previewQueries).padStart(9)} | ` +
          `${String(r.commitQueries).padStart(8)} | ${String(r.created).padStart(7)}`,
        )
        .join('\n'),
    )
  }, 300_000)

  /** Distinct apartment and national ID per row — no accidental duplicates. */
  const sheetFor = (n: number, offset: number) =>
    buildWorkbook({
      headers: HEBREW_OWNER_HEADERS,
      rows: Array.from({ length: n }, (_, i) => [
        `${TAG} בעלים ${offset + i}`,
        validNationalId(offset + i + 1),
        `05${String(10000000 + offset + i).slice(0, 8)}`,
        `perf${offset + i}@example.com`,
        `${offset + i + 1}`,
        '1/1',
        '',
      ]),
    })

  const measure = async (n: number, offset: number): Promise<Measurement> => {
    const buf = await sheetFor(n, offset)

    const up = await http()
      .post('/api/v1/imports/upload')
      .set(auth())
      .field('projectId', projectId)
      .field('entityType', 'OWNER')
      .field('mode', 'ADD_AND_UPDATE')
      .attach('file', buf, {
        filename: `perf-${n}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    expect(up.status).toBe(201)
    const jobId = up.body.job.id

    const mapping = up.body.mapping
      .filter((m: any) => m.field != null)
      .map((m: any) => ({ field: m.field, index: m.index }))
    const mapped = await http().post(`/api/v1/imports/${jobId}/mapping`).set(auth()).send({ mapping })
    expect(mapped.status).toBe(200)

    queryCount = 0; counting = true
    const t0 = Date.now()
    const preview = await http().post(`/api/v1/imports/${jobId}/preview`).set(auth())
    const parseAndValidateMs = Date.now() - t0
    counting = false
    const previewQueries = queryCount
    expect(preview.status).toBe(200)
    expect(preview.body.counts.create).toBe(n)

    queryCount = 0; counting = true
    const t1 = Date.now()
    const commit = await http().post(`/api/v1/imports/${jobId}/commit`).set(auth()).send({})
    const commitMs = Date.now() - t1
    counting = false
    const commitQueries = queryCount
    expect(commit.status).toBe(200)

    return {
      rows: n, parseAndValidateMs, commitMs, previewQueries, commitQueries,
      created: commit.body.job.createdRows,
    }
  }

  it('10 rows', async () => {
    const m = await measure(10, 0)
    results.push(m)
    expect(m.created).toBe(10)
  }, 120_000)

  it('100 rows', async () => {
    const m = await measure(100, 10)
    results.push(m)
    expect(m.created).toBe(100)
  }, 120_000)

  it('1,000 rows', async () => {
    const m = await measure(1000, 110)
    results.push(m)
    expect(m.created).toBe(1000)
  }, 300_000)

  it('5,000 rows', async () => {
    const m = await measure(5000, 1110)
    results.push(m)
    expect(m.created).toBe(5000)
  }, 900_000)

  /**
   * The structural assertion. Query counts are allowed to differ a little
   * between sizes (the preview's issue-persistence `createMany` is one
   * statement either way), but they must NOT scale with row count — a per-row
   * query would show up as thousands here.
   */
  it('issues a bounded number of queries regardless of row count', () => {
    const smallest = results[0]
    const largest = results[results.length - 1]
    expect(largest.rows / smallest.rows).toBeGreaterThan(50)
    expect(largest.previewQueries).toBeLessThan(smallest.previewQueries + 15)
    expect(largest.commitQueries).toBeLessThan(smallest.commitQueries + 15)
  })
})
