/**
 * Data Quality Center — end-to-end tests.
 *
 * Runs against the real PostgreSQL dev database using an isolated fixture
 * tenant, and removes everything it creates in afterAll.
 *
 * Coverage:
 *   - a deliberately clean project produces NO issues (no false positives)
 *   - a deliberately corrupted project produces the EXPECTED issues
 *   - re-scanning creates no duplicates
 *   - fixing the data auto-resolves the issue on the next scan
 *   - manual status transitions (resolve / ignore / reopen) and their audit trail
 *   - an IGNORED issue is never reopened by a scan
 *   - tenant isolation and RBAC at the HTTP boundary
 *   - project and tenant summaries
 *   - no national ID is ever echoed into an issue payload
 */

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma.service'
import { DataQualityService } from '../src/data-quality/data-quality.service'
import { DataQualityEngine } from '../src/data-quality/data-quality.engine'

const T = 'dqt'                       // fixture prefix
const TENANT_A = `${T}_tenant_a`
const TENANT_B = `${T}_tenant_b`
const CLEAN_PROJECT = `${T}_prj_clean`
const DIRTY_PROJECT = `${T}_prj_dirty`
const B_PROJECT = `${T}_prj_b`
const PM_USER = `${T}_usr_pm`

const NID_SHARED = '123456782'        // deliberately duplicated across two owners
const DAY = 86_400_000

describe('Data Quality Center (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let service: DataQualityService
  let engine: DataQualityEngine

  // ── Fixtures ──────────────────────────────────────────────────────────────

  async function cleanup() {
    await prisma.dataQualityIssue.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } })
    await prisma.dataQualityScan.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } })
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } })
    await prisma.task.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } })
    await prisma.ownerApartment.deleteMany({ where: { owner: { tenantId: { in: [TENANT_A, TENANT_B] } } } })
    await prisma.resident.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } })
    await prisma.owner.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } })
    await prisma.apartment.deleteMany({
      where: { building: { complex: { project: { tenantId: { in: [TENANT_A, TENANT_B] } } } } },
    })
    await prisma.building.deleteMany({
      where: { complex: { project: { tenantId: { in: [TENANT_A, TENANT_B] } } } },
    })
    await prisma.complex.deleteMany({ where: { project: { tenantId: { in: [TENANT_A, TENANT_B] } } } })
    await prisma.project.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } })
    await prisma.user.deleteMany({ where: { tenantId: { in: [TENANT_A, TENANT_B] } } })
    await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } })
  }

  async function makeProject(id: string, tenantId: string, extras: Record<string, unknown> = {}) {
    await prisma.project.create({
      data: {
        id, tenantId,
        code: id.slice(-10), name: `פרויקט ${id}`, city: 'תל אביב',
        stage: 'DISCOVERY', status: 'ACTIVE',
        projectManagerId: PM_USER,
        ...extras,
      },
    })
    await prisma.complex.create({ data: { id: `${id}_cx`, projectId: id, name: 'מתחם' } })
  }

  async function seed() {
    await prisma.tenant.createMany({
      data: [
        { id: TENANT_A, name: 'DQ Fixture A', slug: `${T}-a` },
        { id: TENANT_B, name: 'DQ Fixture B', slug: `${T}-b` },
      ],
    })

    // A real user is required: manual status changes write to AuditLog, whose
    // userId carries a foreign key to users.
    await prisma.user.create({
      data: {
        id: PM_USER, tenantId: TENANT_A, firstName: 'מנהל', lastName: 'בדיקה',
        role: 'PROJECT_MANAGER', email: 'dq-fixture-pm@example.com',
      },
    })

    // ── CLEAN project: every rule must pass ────────────────────────────────
    await makeProject(CLEAN_PROJECT, TENANT_A, { totalUnits: 2 })
    await prisma.building.create({
      data: {
        id: `${T}_bld_clean`, complexId: `${CLEAN_PROJECT}_cx`,
        address: 'הרצל 1', floors: 4, totalApartments: 2, constructionYear: 1975,
      },
    })
    for (const [i, num] of ['1', '2'].entries()) {
      await prisma.apartment.create({
        data: {
          id: `${T}_apt_clean_${num}`, buildingId: `${T}_bld_clean`,
          apartmentNumber: num, floor: i + 1, sizeSqm: 80, rooms: 3,
        },
      })
      await prisma.owner.create({
        data: {
          id: `${T}_own_clean_${num}`, tenantId: TENANT_A,
          fullName: `בעלים תקין ${num}`,
          phone: `05011122${num}${num}`,
          email: `clean${num}@example.com`,
          nationalId: `9000000${num}1`,
        },
      })
      await prisma.ownerApartment.create({
        data: {
          ownerId: `${T}_own_clean_${num}`, apartmentId: `${T}_apt_clean_${num}`,
          shareNumerator: 1, shareDenominator: 1,
        },
      })
      await prisma.resident.create({
        data: {
          id: `${T}_res_clean_${num}`, tenantId: TENANT_A,
          apartmentId: `${T}_apt_clean_${num}`,
          firstName: 'דייר', lastName: `תקין ${num}`,
          phone: `05022233${num}${num}`, email: `res${num}@example.com`,
        },
      })
    }

    // ── DIRTY project: one deliberate defect per rule under test ───────────
    await makeProject(DIRTY_PROJECT, TENANT_A, { totalUnits: 99 }) // unit-count mismatch
    await prisma.building.create({
      data: {
        id: `${T}_bld_dirty`, complexId: `${DIRTY_PROJECT}_cx`,
        address: 'ביאליק 2', floors: 3, totalApartments: 7, constructionYear: 1980,
      },
    })

    // apt D1 — no owner, no resident, missing size/rooms/floor
    await prisma.apartment.create({
      data: { id: `${T}_apt_d1`, buildingId: `${T}_bld_dirty`, apartmentNumber: 'D1' },
    })
    // apt D2 — shares sum to 3/4
    await prisma.apartment.create({
      data: {
        id: `${T}_apt_d2`, buildingId: `${T}_bld_dirty`, apartmentNumber: 'D2',
        floor: 1, sizeSqm: 70, rooms: 3,
      },
    })
    // apt D3 — a single illegal fraction 3/2
    await prisma.apartment.create({
      data: {
        id: `${T}_apt_d3`, buildingId: `${T}_bld_dirty`, apartmentNumber: 'D3',
        floor: 2, sizeSqm: 70, rooms: 3,
      },
    })

    // owner with no phone, holding half of D2
    await prisma.owner.create({
      data: {
        id: `${T}_own_nophone`, tenantId: TENANT_A, fullName: 'בעלים ללא טלפון',
        email: 'nophone@example.com', nationalId: '900000031',
      },
    })
    await prisma.ownerApartment.create({
      data: {
        ownerId: `${T}_own_nophone`, apartmentId: `${T}_apt_d2`,
        shareNumerator: 1, shareDenominator: 2,
      },
    })
    // second D2 owner holds only a quarter → sum 3/4
    await prisma.owner.create({
      data: {
        id: `${T}_own_dup1`, tenantId: TENANT_A, fullName: 'בעלים כפול א',
        phone: '0503334444', email: 'dup1@example.com', nationalId: NID_SHARED,
      },
    })
    await prisma.ownerApartment.create({
      data: {
        ownerId: `${T}_own_dup1`, apartmentId: `${T}_apt_d2`,
        shareNumerator: 1, shareDenominator: 4,
      },
    })
    // duplicate national ID + illegal fraction on D3
    await prisma.owner.create({
      data: {
        id: `${T}_own_dup2`, tenantId: TENANT_A, fullName: 'בעלים כפול ב',
        phone: '0504445555', email: 'dup2@example.com', nationalId: NID_SHARED,
      },
    })
    await prisma.ownerApartment.create({
      data: {
        ownerId: `${T}_own_dup2`, apartmentId: `${T}_apt_d3`,
        shareNumerator: 3, shareDenominator: 2,
      },
    })

    // overdue task
    await prisma.task.create({
      data: {
        id: `${T}_task_overdue`, tenantId: TENANT_A, projectId: DIRTY_PROJECT,
        title: 'משימה באיחור', status: 'PENDING',
        dueDate: new Date(Date.now() - 10 * DAY),
        assigneeId: null,
      },
    })

    // ── TENANT B: its own broken data, must never leak into tenant A ───────
    await makeProject(B_PROJECT, TENANT_B)
    await prisma.building.create({
      data: { id: `${T}_bld_b`, complexId: `${B_PROJECT}_cx`, address: 'רחוב ב 1' },
    })
    await prisma.apartment.create({
      data: { id: `${T}_apt_b`, buildingId: `${T}_bld_b`, apartmentNumber: 'B1' },
    })
    await prisma.owner.create({
      data: { id: `${T}_own_b`, tenantId: TENANT_B, fullName: 'בעלים של ארגון ב' },
    })
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }))
    await app.init()

    prisma  = app.get(PrismaService)
    service = app.get(DataQualityService)
    engine  = app.get(DataQualityEngine)

    await cleanup()
    await seed()
  })

  afterAll(async () => {
    await cleanup()
    await app?.close()
  })

  // ── Rule catalogue ────────────────────────────────────────────────────────

  it('exposes a rule catalogue with independently identified rules', () => {
    const rules = engine.getRuleCatalogue()
    expect(rules.length).toBeGreaterThanOrEqual(10)
    expect(new Set(rules.map(r => r.id)).size).toBe(rules.length)
    for (const r of rules) expect(r.issueTypes.length).toBeGreaterThan(0)
  })

  // ── Negative case: valid data must not produce issues ─────────────────────

  it('produces NO issues for a fully valid project (no false positives)', async () => {
    const { issues } = await engine.detect(TENANT_A, CLEAN_PROJECT)
    expect(issues).toEqual([])
  })

  // ── Positive cases ────────────────────────────────────────────────────────

  describe('detection on deliberately corrupted data', () => {
    let types: string[]
    let issuesFor: (t: string) => { entityId: string; severity: string }[]

    beforeAll(async () => {
      const { issues } = await engine.detect(TENANT_A)
      types = issues.map(i => i.issueType)
      issuesFor = (t: string) => issues.filter(i => i.issueType === t)
    })

    it('detects an apartment with no owner', () => {
      expect(issuesFor('APARTMENT_NO_OWNER').map(i => i.entityId)).toContain(`${T}_apt_d1`)
    })

    it('detects an apartment with no resident', () => {
      expect(issuesFor('APARTMENT_NO_RESIDENT').map(i => i.entityId)).toContain(`${T}_apt_d1`)
    })

    it('detects missing apartment attributes', () => {
      expect(issuesFor('APARTMENT_MISSING_SIZE').map(i => i.entityId)).toContain(`${T}_apt_d1`)
      expect(issuesFor('APARTMENT_MISSING_ROOMS').map(i => i.entityId)).toContain(`${T}_apt_d1`)
      expect(issuesFor('APARTMENT_MISSING_FLOOR').map(i => i.entityId)).toContain(`${T}_apt_d1`)
    })

    it('detects an owner with no phone number', () => {
      expect(issuesFor('OWNER_MISSING_PHONE').map(i => i.entityId)).toContain(`${T}_own_nophone`)
    })

    it('detects a duplicate national ID across two owners', () => {
      const ids = issuesFor('OWNER_DUPLICATE_NATIONAL_ID').map(i => i.entityId)
      expect(ids).toContain(`${T}_own_dup1`)
      expect(ids).toContain(`${T}_own_dup2`)
      expect(issuesFor('OWNER_DUPLICATE_NATIONAL_ID')[0].severity).toBe('CRITICAL')
    })

    it('detects an invalid ownership fraction (numerator > denominator)', () => {
      expect(types).toContain('OWNERSHIP_INVALID_FRACTION')
    })

    it('detects ownership shares that do not sum to 1', () => {
      const shareIssues = issuesFor('OWNERSHIP_SHARE_SUM_INVALID')
      expect(shareIssues.map(i => i.entityId)).toContain(`${T}_apt_d2`)
    })

    it('detects a building unit-count mismatch', () => {
      expect(issuesFor('BUILDING_UNIT_COUNT_MISMATCH').map(i => i.entityId))
        .toContain(`${T}_bld_dirty`)
    })

    it('detects a project unit-count mismatch', () => {
      expect(issuesFor('PROJECT_UNIT_COUNT_MISMATCH').map(i => i.entityId))
        .toContain(DIRTY_PROJECT)
    })

    it('detects an overdue task and a task without an assignee', () => {
      expect(issuesFor('TASK_OVERDUE').map(i => i.entityId)).toContain(`${T}_task_overdue`)
      expect(issuesFor('TASK_NO_ASSIGNEE').map(i => i.entityId)).toContain(`${T}_task_overdue`)
    })

    it('detects an orphan record in the other tenant only within that tenant', async () => {
      const { issues } = await engine.detect(TENANT_B)
      expect(issues.some(i => i.entityId === `${T}_own_b`)).toBe(true)
    })

    it('never echoes a national ID into any issue payload', async () => {
      const { issues } = await engine.detect(TENANT_A)
      const blob = JSON.stringify(issues)
      expect(blob).not.toContain(NID_SHARED)
      expect(blob).not.toContain('900000031')
    })
  })

  // ── Persistence, dedupe, auto-resolution ──────────────────────────────────

  describe('scanning and persistence', () => {
    it('persists issues and records scan metadata', async () => {
      const result = await service.scanTenant(TENANT_A, PM_USER)
      expect(result.issuesFound).toBeGreaterThan(0)
      expect(result.issuesNew).toBe(result.issuesFound)
      expect(result.rulesExecuted.length).toBeGreaterThanOrEqual(10)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)

      const scan = await service.getScan(TENANT_A, result.scanId)
      expect(scan.status).toBe('COMPLETED')
      expect(scan.scope).toBe('TENANT')
      expect(scan.triggeredById).toBe(PM_USER)
    })

    it('re-running the scan creates NO duplicate issues', async () => {
      const before = await prisma.dataQualityIssue.count({ where: { tenantId: TENANT_A } })
      const result = await service.scanTenant(TENANT_A, null)
      const after = await prisma.dataQualityIssue.count({ where: { tenantId: TENANT_A } })

      expect(result.issuesNew).toBe(0)
      expect(after).toBe(before)

      // The natural key is genuinely unique in the database.
      const grouped = await prisma.dataQualityIssue.groupBy({
        by: ['issueType', 'entityType', 'entityId'],
        where: { tenantId: TENANT_A },
        _count: { _all: true },
      })
      expect(grouped.every(g => g._count._all === 1)).toBe(true)
    })

    it('auto-resolves an issue once the underlying data is fixed', async () => {
      const key = {
        tenantId_issueType_entityType_entityId: {
          tenantId: TENANT_A,
          issueType: 'OWNER_MISSING_PHONE',
          entityType: 'OWNER' as const,
          entityId: `${T}_own_nophone`,
        },
      }
      expect((await prisma.dataQualityIssue.findUnique({ where: key }))!.status).toBe('OPEN')

      // Fix the source data…
      await prisma.owner.update({
        where: { id: `${T}_own_nophone` },
        data: { phone: '0509998877' },
      })
      const result = await service.scanTenant(TENANT_A, null)
      expect(result.issuesResolved).toBeGreaterThanOrEqual(1)

      const fixed = await prisma.dataQualityIssue.findUnique({ where: key })
      expect(fixed!.status).toBe('RESOLVED')
      expect(fixed!.resolutionType).toBe('AUTO')
      expect(fixed!.resolvedAt).not.toBeNull()
      // Resolved, never deleted.
      expect(fixed!.id).toBeTruthy()
    })

    it('reopens an auto-resolved issue when the problem comes back', async () => {
      await prisma.owner.update({ where: { id: `${T}_own_nophone` }, data: { phone: null } })
      await service.scanTenant(TENANT_A, null)

      const reopened = await prisma.dataQualityIssue.findUnique({
        where: {
          tenantId_issueType_entityType_entityId: {
            tenantId: TENANT_A, issueType: 'OWNER_MISSING_PHONE',
            entityType: 'OWNER', entityId: `${T}_own_nophone`,
          },
        },
      })
      expect(reopened!.status).toBe('OPEN')
      expect(reopened!.resolvedAt).toBeNull()
    })
  })

  // ── Manual status transitions + audit ─────────────────────────────────────

  describe('status transitions and audit trail', () => {
    let issueId: string

    beforeAll(async () => {
      const issue = await prisma.dataQualityIssue.findFirst({
        where: { tenantId: TENANT_A, issueType: 'APARTMENT_NO_RESIDENT', status: 'OPEN' },
      })
      issueId = issue!.id
    })

    it('marks an issue IN_PROGRESS, then RESOLVED, and writes an audit entry for each', async () => {
      const actor = { userId: PM_USER, ip: '127.0.0.1', userAgent: 'jest' }

      const started = await service.startIssue(TENANT_A, issueId, actor, 'התחלנו לטפל')
      expect(started.status).toBe('IN_PROGRESS')

      const resolved = await service.resolveIssue(TENANT_A, issueId, actor, 'הוזן דייר')
      expect(resolved.status).toBe('RESOLVED')
      expect(resolved.resolutionType).toBe('MANUAL')
      expect(resolved.resolvedById).toBe(PM_USER)

      const audit = await prisma.auditLog.findMany({
        where: { tenantId: TENANT_A, entity: 'DataQualityIssue', entityId: issueId },
        orderBy: { createdAt: 'asc' },
      })
      expect(audit.length).toBe(2)
      expect((audit[0].changes as { after: { status: string } }).after.status).toBe('IN_PROGRESS')
      expect((audit[1].changes as { before: { status: string } }).before.status).toBe('IN_PROGRESS')
      expect(audit[1].userId).toBe(PM_USER)
    })

    it('rejects a no-op transition', async () => {
      await expect(
        service.resolveIssue(TENANT_A, issueId, { userId: null }),
      ).rejects.toThrow()
    })

    it('reopens a manually resolved issue', async () => {
      const reopened = await service.reopenIssue(TENANT_A, issueId, { userId: PM_USER })
      expect(reopened.status).toBe('OPEN')
      expect(reopened.resolvedAt).toBeNull()
    })

    it('never lets a scan overwrite a manually IGNORED status', async () => {
      await service.ignoreIssue(TENANT_A, issueId, { userId: PM_USER }, 'לא רלוונטי')
      await service.scanTenant(TENANT_A, null)

      const after = await prisma.dataQualityIssue.findUnique({ where: { id: issueId } })
      expect(after!.status).toBe('IGNORED')
      expect(after!.resolutionNote).toBe('לא רלוונטי')
    })

    it('surfaces the resolution history on the issue detail', async () => {
      const detail = await service.getIssue(TENANT_A, issueId)
      expect(detail.history.length).toBeGreaterThanOrEqual(3)
      expect(detail.deepLink).toBeTruthy()
      expect(detail.recommendation).toBeTruthy()
      expect(detail.impact).toBeTruthy()
    })
  })

  // ── Tenant isolation ──────────────────────────────────────────────────────

  describe('tenant isolation', () => {
    beforeAll(async () => {
      await service.scanTenant(TENANT_B, null)
    })

    it('never returns another tenant\'s issues', async () => {
      const listed = await service.listIssues(TENANT_A, { take: 200 })
      expect(listed.items.every(i => i.tenantId === TENANT_A)).toBe(true)
      expect(listed.items.some(i => i.entityId === `${T}_own_b`)).toBe(false)
    })

    it('cannot read another tenant\'s issue by id', async () => {
      const foreign = await prisma.dataQualityIssue.findFirst({ where: { tenantId: TENANT_B } })
      expect(foreign).toBeTruthy()
      await expect(service.getIssue(TENANT_A, foreign!.id)).rejects.toThrow()
    })

    it('cannot mutate another tenant\'s issue (no IDOR)', async () => {
      const foreign = await prisma.dataQualityIssue.findFirst({ where: { tenantId: TENANT_B } })
      await expect(
        service.resolveIssue(TENANT_A, foreign!.id, { userId: PM_USER }),
      ).rejects.toThrow()

      const unchanged = await prisma.dataQualityIssue.findUnique({ where: { id: foreign!.id } })
      expect(unchanged!.status).toBe('OPEN')
    })

    it('cannot scan another tenant\'s project', async () => {
      await expect(service.scanProject(TENANT_A, B_PROJECT, null)).rejects.toThrow()
    })

    it('cannot read another tenant\'s project summary', async () => {
      await expect(service.getProjectSummary(TENANT_A, B_PROJECT)).rejects.toThrow()
    })
  })

  // ── Summaries ─────────────────────────────────────────────────────────────

  describe('summaries', () => {
    it('returns a project summary with a 0-100 score and headline metrics', async () => {
      const dirty = await service.getProjectSummary(TENANT_A, DIRTY_PROJECT)
      expect(dirty.score).toBeGreaterThanOrEqual(0)
      expect(dirty.score).toBeLessThanOrEqual(100)
      expect(dirty.openIssues).toBeGreaterThan(0)
      expect(dirty.headline.apartmentsWithoutOwners).toBeGreaterThanOrEqual(1)
      expect(dirty.headline.overdueTasks).toBeGreaterThanOrEqual(1)
      expect(dirty.project.id).toBe(DIRTY_PROJECT)
    })

    it('scores the clean project higher than the corrupted one', async () => {
      const clean = await service.getProjectSummary(TENANT_A, CLEAN_PROJECT)
      const dirty = await service.getProjectSummary(TENANT_A, DIRTY_PROJECT)
      expect(clean.openIssues).toBe(0)
      expect(clean.score).toBe(100)
      expect(clean.score).toBeGreaterThan(dirty.score)
    })

    it('caps the score below 80 while an open CRITICAL issue exists', async () => {
      const summary = await service.getTenantSummary(TENANT_A)
      expect(summary.bySeverity.CRITICAL).toBeGreaterThan(0)
      expect(summary.score).toBeLessThanOrEqual(79)
      expect(summary.byProject.length).toBeGreaterThan(0)
      expect(summary.lastScan).not.toBeNull()
    })

    it('supports filtering, sorting and pagination of the issue list', async () => {
      const critical = await service.listIssues(TENANT_A, { severity: 'CRITICAL', status: 'OPEN' })
      expect(critical.items.every(i => i.severity === 'CRITICAL')).toBe(true)

      const byProject = await service.listIssues(TENANT_A, { projectId: DIRTY_PROJECT })
      expect(byProject.items.every(i => i.projectId === DIRTY_PROJECT)).toBe(true)

      const paged = await service.listIssues(TENANT_A, { take: 2, skip: 0 })
      expect(paged.items.length).toBeLessThanOrEqual(2)
      expect(paged.total).toBeGreaterThanOrEqual(paged.items.length)

      const byType = await service.listIssues(TENANT_A, { issueType: 'APARTMENT_NO_OWNER' })
      expect(byType.items.every(i => i.issueType === 'APARTMENT_NO_OWNER')).toBe(true)
    })

    it('keeps a project-scoped scan inside its project', async () => {
      const result = await service.scanProject(TENANT_A, CLEAN_PROJECT, null)
      expect(result.scope).toBe('PROJECT')
      expect(result.projectId).toBe(CLEAN_PROJECT)
      expect(result.issuesFound).toBe(0)
    })
  })

  // ── HTTP boundary: authentication and RBAC ────────────────────────────────

  describe('HTTP boundary', () => {
    const base = '/api/v1/data-quality'

    it('rejects unauthenticated reads', async () => {
      const res = await request(app.getHttpServer()).get(`${base}/issues`)
      expect(res.status).toBe(401)
    })

    it('rejects unauthenticated summaries', async () => {
      const res = await request(app.getHttpServer()).get(`${base}/summary`)
      expect(res.status).toBe(401)
    })

    it('rejects unauthenticated scans', async () => {
      const res = await request(app.getHttpServer()).post(`${base}/scan/tenant`).send({})
      expect([401, 403]).toContain(res.status)
    })

    it('rejects unauthenticated mutations', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${base}/issues/whatever/resolve`)
        .send({ note: 'x' })
      expect([401, 403]).toContain(res.status)
    })

    it('is reachable at /api/v1/data-quality (not /api/api/v1/...)', async () => {
      const res = await request(app.getHttpServer()).get(`${base}/rules`)
      // 401 proves the route exists and is guarded; 404 would prove it does not.
      expect(res.status).not.toBe(404)
    })

    it('exposes the project health route at /api/v1/health, not /api/api/v1/health', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health/portfolio')
      expect(res.status).not.toBe(404)
      const doubled = await request(app.getHttpServer()).get('/api/api/v1/health/portfolio')
      expect(doubled.status).toBe(404)
    })
  })
})
