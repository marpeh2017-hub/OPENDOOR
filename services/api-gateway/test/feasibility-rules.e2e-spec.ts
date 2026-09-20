/**
 * The regulatory rules registry, against a real database.
 *
 * WHY NOT A UNIT TEST WITH A STUBBED PRISMA: the behaviour that matters here is
 * the half-open window, and the half-open window is a SQL `where` clause. A stub
 * that returns rows would be testing an in-memory re-implementation of the
 * filter — it would pass while the real query was wrong, which is precisely the
 * failure this table exists to prevent.
 *
 * Every fixture is namespaced by MARKER and purged in `beforeAll` as well as
 * `afterAll`, so an interrupted run cannot poison the next one.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { randomUUID } from 'crypto'
import { AuditService } from '../src/common/audit/audit.service'
import { FeasibilityRulesService } from '../src/feasibility/feasibility-rules.service'
import { PrismaService } from '../src/prisma.service'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e'

const MARKER = `RULES-${Date.now().toString(36)}`
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('Feasibility regulatory rules registry (e2e)', () => {
  let moduleRef: TestingModule
  let prisma: PrismaService
  let rules: FeasibilityRulesService
  let tenantId: string
  let otherTenantId: string
  let userId: string

  const actor = () => ({ userId, tenantId })

  /** A rule row with the boring fields filled in. */
  const add = (over: Partial<Parameters<FeasibilityRulesService['create']>[1]> & { code: string }) =>
    rules.create(tenantId, {
      name: over.code,
      authority: 'REGULATION',
      numericValue: 1,
      effectiveFrom: day('2000-01-01'),
      sourceReference: 'test fixture',
      ...over,
    } as any, actor())


  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        FeasibilityRulesService,
        PrismaService,
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile()

    prisma = moduleRef.get(PrismaService)
    rules = moduleRef.get(FeasibilityRulesService)
    await prisma.$connect()

    const mk = async (slug: string) => (await prisma.tenant.create({
      data: { name: `${MARKER}-${slug}`, slug: `${MARKER.toLowerCase()}-${slug}-${randomUUID().slice(0, 8)}` },
    })).id
    tenantId = await mk('a')
    otherTenantId = await mk('b')

    const user = await prisma.user.create({
      data: {
        tenantId, email: `${MARKER}@example.test`,
        firstName: 'Rules', lastName: 'Fixture',
        passwordHash: 'x', role: 'COMPANY_ADMIN',
      },
    })
    userId = user.id
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.feasibilityRule.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } })
      await prisma.user.deleteMany({ where: { tenantId } })
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } })
      await prisma.$disconnect()
    }
    await moduleRef?.close()
  })

  beforeEach(async () => {
    await prisma.feasibilityRule.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } })
  })

  describe('the window is half-open', () => {
    beforeEach(async () => {
      // VAT: 17% until 2025-01-01, 18% from it. Written the way anyone would
      // write it — the end of one is the start of the next.
      await add({
        code: 'vat-rate', numericValue: 0.17,
        effectiveFrom: day('2015-10-01'), effectiveUntil: day('2025-01-01'),
      })
      await add({ code: 'vat-rate', numericValue: 0.18, effectiveFrom: day('2025-01-01') })
    })

    it('gives the old rate the day before the change', async () => {
      const rule = await rules.resolve(tenantId, 'vat-rate', day('2024-12-31'))
      expect(rule?.numericValue?.toString()).toBe('0.17')
    })

    it('gives the NEW rate on the changeover day itself', async () => {
      // The boundary that a closed-closed window would get wrong in both
      // directions at once: ambiguous, and then arbitrary.
      const rule = await rules.resolve(tenantId, 'vat-rate', day('2025-01-01'))
      expect(rule?.numericValue?.toString()).toBe('0.18')
    })

    it('includes the first day a rule applies', async () => {
      const rule = await rules.resolve(tenantId, 'vat-rate', day('2015-10-01'))
      expect(rule?.numericValue?.toString()).toBe('0.17')
    })

    it('finds nothing before the registry starts', async () => {
      expect(await rules.resolve(tenantId, 'vat-rate', day('2010-01-01'))).toBeNull()
    })

    it('cites the version it used, so a report can name it', async () => {
      const rule = await rules.resolve(tenantId, 'vat-rate', day('2026-06-01'))
      expect(rule?.ruleId).toBeTruthy()
      expect(rule?.sourceReference).toBeTruthy()
      expect(rule?.effectiveFrom.toISOString()).toBe(day('2025-01-01').toISOString())
    })
  })

  describe('a local rule beats the national one', () => {
    beforeEach(async () => {
      await add({ code: 'parking-per-unit', numericValue: 1, jurisdiction: null })
      await add({ code: 'parking-per-unit', numericValue: 0.5, jurisdiction: 'תל אביב-יפו' })
    })

    it('uses the municipal standard for a project in that city', async () => {
      const rule = await rules.resolve(tenantId, 'parking-per-unit', day('2026-01-01'), 'תל אביב-יפו')
      expect(rule?.numericValue?.toString()).toBe('0.5')
      expect(rule?.jurisdictionSpecific).toBe(true)
    })

    it('does NOT leak that standard to a project in another city', async () => {
      const rule = await rules.resolve(tenantId, 'parking-per-unit', day('2026-01-01'), 'ירושלים')
      expect(rule?.numericValue?.toString()).toBe('1')
      expect(rule?.jurisdictionSpecific).toBe(false)
    })

    it('falls back to the national rule when no jurisdiction is given', async () => {
      const rule = await rules.resolve(tenantId, 'parking-per-unit', day('2026-01-01'))
      expect(rule?.numericValue?.toString()).toBe('1')
    })
  })

  describe('ambiguity stops the study rather than picking a winner', () => {
    it('refuses to write a version that overlaps an open-ended one', async () => {
      await add({ code: 'levy-rate', effectiveFrom: day('2020-01-01') })
      await expect(add({ code: 'levy-rate', effectiveFrom: day('2022-01-01') }))
        .rejects.toMatchObject({ details: [expect.objectContaining({ code: 'RULE_WINDOWS_OVERLAP' })] })
    })

    it('refuses a version that overlaps a closed one', async () => {
      await add({ code: 'levy-rate', effectiveFrom: day('2020-01-01'), effectiveUntil: day('2024-01-01') })
      await expect(add({ code: 'levy-rate', effectiveFrom: day('2023-06-01'), effectiveUntil: day('2025-01-01') }))
        .rejects.toMatchObject({ details: [expect.objectContaining({ code: 'RULE_WINDOWS_OVERLAP' })] })
    })

    it('allows consecutive versions that touch but do not overlap', async () => {
      await add({ code: 'levy-rate', effectiveFrom: day('2020-01-01'), effectiveUntil: day('2024-01-01') })
      await expect(add({ code: 'levy-rate', effectiveFrom: day('2024-01-01') })).resolves.toBeTruthy()
    })

    it('does not treat a national and a local rule as an overlap', async () => {
      await add({ code: 'levy-rate', effectiveFrom: day('2020-01-01') })
      await expect(add({ code: 'levy-rate', effectiveFrom: day('2020-01-01'), jurisdiction: 'חיפה' }))
        .resolves.toBeTruthy()
    })

    it('raises on read too, if overlapping rows got in some other way', async () => {
      // Written straight through Prisma, bypassing the write-time guard — the
      // read-time check is the backstop for rows created by a migration, an
      // import, or a future code path that forgets to validate.
      const base = {
        tenantId, code: 'imported-rate', name: 'imported', authority: 'REGULATION' as const,
        sourceReference: `${MARKER} direct`, createdById: userId, updatedById: userId,
      }
      await prisma.feasibilityRule.createMany({
        data: [
          { ...base, numericValue: 1, effectiveFrom: day('2020-01-01') },
          { ...base, numericValue: 2, effectiveFrom: day('2021-01-01') },
        ],
      })
      await expect(rules.resolve(tenantId, 'imported-rate', day('2026-01-01')))
        .rejects.toMatchObject({ details: [expect.objectContaining({ code: 'RULE_WINDOWS_OVERLAP' })] })
    })
  })

  describe('what the registry refuses to store', () => {
    it('rejects a rule with no citation', async () => {
      await expect(add({ code: 'no-source', sourceReference: '  ' }))
        .rejects.toMatchObject({ details: [expect.objectContaining({ code: 'RULE_SOURCE_REQUIRED' })] })
    })

    it('rejects a rule with neither a number nor text', async () => {
      await expect(add({ code: 'empty', numericValue: null }))
        .rejects.toMatchObject({ details: [expect.objectContaining({ code: 'RULE_VALUE_REQUIRED' })] })
    })

    it('rejects a window that ends before it starts', async () => {
      await expect(add({
        code: 'backwards', effectiveFrom: day('2025-01-01'), effectiveUntil: day('2024-01-01'),
      })).rejects.toMatchObject({ details: [expect.objectContaining({ code: 'RULE_WINDOW_INVALID' })] })
    })
  })

  describe('rules are retired, not deleted', () => {
    it('closes the window and stops the rule applying afterwards', async () => {
      const rule = await add({ code: 'retiring', effectiveFrom: day('2020-01-01') })
      await rules.retire(rule.id, tenantId, day('2025-01-01'), actor())

      expect(await rules.resolve(tenantId, 'retiring', day('2024-12-31'))).toBeTruthy()
      expect(await rules.resolve(tenantId, 'retiring', day('2025-01-01'))).toBeNull()
      // Still there to be cited by a report that used it.
      expect(await prisma.feasibilityRule.findUnique({ where: { id: rule.id } })).toBeTruthy()
    })

    it('refuses to retire a rule before it began', async () => {
      const rule = await add({ code: 'retiring-2', effectiveFrom: day('2020-01-01') })
      await expect(rules.retire(rule.id, tenantId, day('2019-01-01'), actor()))
        .rejects.toMatchObject({ details: [expect.objectContaining({ code: 'RULE_WINDOW_INVALID' })] })
    })

    it('an inactive rule does not resolve', async () => {
      await add({ code: 'switched-off', isActive: false })
      expect(await rules.resolve(tenantId, 'switched-off', day('2026-01-01'))).toBeNull()
    })
  })

  describe('tenant isolation', () => {
    it('does not resolve another tenant’s rule', async () => {
      await add({ code: 'private-rate', numericValue: 0.42 })
      expect(await rules.resolve(otherTenantId, 'private-rate', day('2026-01-01'))).toBeNull()
    })

    it('does not let another tenant retire a rule', async () => {
      const rule = await add({ code: 'private-rate-2' })
      await expect(rules.retire(rule.id, otherTenantId, day('2026-01-01'), { userId, tenantId: otherTenantId }))
        .rejects.toMatchObject({ details: [expect.objectContaining({ code: 'FEASIBILITY_RULE_NOT_FOUND' })] })
    })

    it('does not list another tenant’s rules', async () => {
      await add({ code: 'private-rate-3' })
      expect(await rules.list(otherTenantId)).toHaveLength(0)
    })
  })
})
