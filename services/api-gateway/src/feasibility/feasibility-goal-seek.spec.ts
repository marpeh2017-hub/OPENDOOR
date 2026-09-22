/**
 * P1-2 — Goal Seek against the real engine.
 *
 * "מה המחיר שבו הפרויקט עובד?" A sensitivity grid answers this only by eye: it
 * prints -10%, -5%, 0, +5% and leaves the reader to interpolate. This solves it.
 *
 * The test that matters most is `it re-runs the engine rather than scaling the
 * result` — a scenario with a revenue-linked cost, where the naive answer and
 * the correct one differ by a margin nobody would notice by inspection.
 *
 * `compute` is pure over loaded input, so there is no database and no HTTP here.
 */
import { FeasibilityCalculationService, type LoadedFeasibilityProfile, type LoadedFeasibilityScenario } from './feasibility-calculation.service'
import type { CreateGoalSeekDto } from './dto/feasibility-goal-seek.dto'

const engine = new FeasibilityCalculationService(null as never, null as never, null as never)

type Overrides = { withRevenueLinkedCost?: boolean; withDebt?: boolean; ltc?: string }

/**
 * Base case, chosen so the arithmetic can be checked by hand:
 *   revenue 10,000,000 (10 units × 1,000,000), cost 6,000,000, profit 4,000,000.
 */
const build = (overrides: Overrides = {}) => {
  const withDebt = overrides.withDebt ?? false

  const profile = {
    id: 'profile-1',
    valuationDate: new Date('2026-01-01T00:00:00.000Z'),
    parcels: [{ id: 'parcel-1', gush: '1234', chelka: '56', landAreaSqm: '500', sourceId: 'source-1', isVerified: true }],
    areas: [{ id: 'area-1', areaType: 'GROSS', valueSqm: '1000', label: 'ברוטו', sourceId: 'source-1', isVerified: true }],
    planningRights: [{ id: 'right-1', category: 'RESIDENTIAL', status: 'APPROVED', unitCount: 10, sourceId: 'source-1', isVerified: true }],
    comparableTransactions: [],
    assumptions: [
      { key: 'annual-discount-rate', value: '0.08' },
      { key: 'required-developer-profit-margin', value: '0.15' },
    ],
    sources: [],
    scenarios: [],
  } as unknown as LoadedFeasibilityProfile

  const allocations: Array<Record<string, unknown>> = [
    { id: 'alloc-cost', periodStart: new Date('2027-01-01T00:00:00.000Z'), direction: 'OUTFLOW', sourceKind: 'COST', sourceLineId: 'cost-1', amount: '6000000' },
    { id: 'alloc-revenue', periodStart: new Date('2027-06-01T00:00:00.000Z'), direction: 'INFLOW', sourceKind: 'REVENUE', sourceLineId: 'mix-1', amount: '10000000' },
  ]
  if (withDebt) {
    allocations.push(
      { id: 'alloc-draw', periodStart: new Date('2026-07-01T00:00:00.000Z'), direction: 'INFLOW', sourceKind: 'DEBT', sourceLineId: null, amount: '5000000' },
      { id: 'alloc-repay', periodStart: new Date('2027-06-01T00:00:00.000Z'), direction: 'OUTFLOW', sourceKind: 'DEBT', sourceLineId: null, amount: '5000000' },
    )
  }

  const scenario = {
    id: 'scenario-1', name: 'בסיס', kind: 'BASE', isBaseline: true,
    unitMix: [{
      id: 'mix-1', label: 'דירות 4 חדרים', disposition: 'DEVELOPER_SALE', unitCount: 10, fixedUnitPrice: '1000000',
      saleableAreaSqm: null, pricePerSqm: null, parkingSpaces: 0, parkingPrice: null,
      balconyAreaSqm: null, balconyPricePerSqm: null, storageAreaSqm: null, storagePricePerSqm: null,
      sourceId: 'source-1', isVerified: true,
    }],
    revenueLines: [],
    costLines: [
      {
        id: 'cost-1', label: 'בנייה', category: 'CONSTRUCTION', quantity: null, unit: null, unitCost: null,
        fixedAmount: '6000000', percentage: null, percentageBase: null, vatTreatment: 'VAT_EXCLUDED',
        escalationRate: null, contingencyRate: null, sourceId: 'source-1', isVerified: true,
      },
      ...(overrides.withRevenueLinkedCost ? [{
        // 5% of revenue. This line is why the answer cannot be extrapolated:
        // raising the price raises this cost too, so the target recedes as you
        // approach it.
        id: 'cost-marketing', label: 'שיווק', category: 'MARKETING', quantity: null, unit: null, unitCost: null,
        fixedAmount: null, percentage: '0.05', percentageBase: 'TOTAL_REVENUE', vatTreatment: 'VAT_EXCLUDED',
        escalationRate: null, contingencyRate: null, sourceId: 'source-1', isVerified: true,
      }] : []),
    ],
    compensations: [],
    cashFlowAllocations: allocations,
    financing: withDebt || overrides.ltc ? {
      id: 'financing-1', debtAmount: '5000000', equityAmount: '2000000',
      ltc: overrides.ltc ?? null, ltv: null,
      annualInterestRate: withDebt ? '0.06' : null,
      arrangementFeeRate: null, guaranteeFeeRate: null, graceMonths: null, financingMonths: null,
    } : null,
  } as unknown as LoadedFeasibilityScenario

  return { profile, scenario }
}

const seek = (dto: Partial<CreateGoalSeekDto> & { targetValue: string }, overrides: Overrides = {}) => {
  const { profile, scenario } = build(overrides)
  return (engine as any).computeGoalSeek(profile, scenario, {
    variable: 'SALE_PRICE', metric: 'PROFIT_MARGIN', ...dto,
  } as CreateGoalSeekDto)
}

describe('P1-2 — Goal Seek', () => {
  describe('it answers the question that was asked', () => {
    it('solves the sale price that reaches a 50% margin', () => {
      // revenue R against a fixed 6M cost: (R - 6M)/R = 0.5  →  R = 12M,
      // which is 1.2× the 10M base.
      const result = seek({ targetValue: '0.5' })
      expect(result.status).toBe('CONVERGED')
      expect(Number(result.solutionFactor)).toBeCloseTo(1.2, 6)
      expect(Number(result.requiredChangePercent)).toBeCloseTo(20, 4)
    })

    it('reports the metric it actually achieved, not merely the target', () => {
      const result = seek({ targetValue: '0.5' })
      expect(Number(result.achievedMetric)).toBeCloseTo(0.5, 7)
    })

    it('hands back the full result at the solution, not just a number', () => {
      const result = seek({ targetValue: '0.5' })
      expect(Number(result.atSolution.revenue)).toBeCloseTo(12_000_000, 0)
      expect(Number(result.atSolution.profit)).toBeCloseTo(6_000_000, 0)
      expect(result.atSolution.feasibilityStatus).toBeTruthy()
    })

    it('solves downward when the variable pushes the metric the other way', () => {
      // Cutting construction cost also reaches a 50% margin: revenue stays 10M,
      // so cost must fall to 5M — a 0.8333× factor on the 6M line.
      const result = seek({ variable: 'CONSTRUCTION_COST', targetValue: '0.5' })
      expect(result.status).toBe('CONVERGED')
      expect(Number(result.solutionFactor)).toBeCloseTo(5 / 6, 6)
    })

    it('leaves the scenario untouched — it is a question, not an edit', () => {
      const { profile, scenario } = build()
      const before = JSON.stringify(scenario)
      ;(engine as any).computeGoalSeek(profile, scenario, {
        variable: 'SALE_PRICE', metric: 'PROFIT_MARGIN', targetValue: '0.5',
      } as CreateGoalSeekDto)
      expect(JSON.stringify(scenario)).toBe(before)
    })
  })

  describe('it re-runs the engine rather than scaling the result', () => {
    it('accounts for a cost that moves with the price it is solving for', () => {
      // With marketing at 5% of revenue:
      //   (R - 6,000,000 - 0.05R) / R = 0.5   →   0.45R = 6,000,000
      //   R = 13,333,333  →  factor 1.3333
      // Scaling the frozen base result would have answered 1.2 — the same
      // answer as the no-marketing case, which cannot be right, because the
      // scenario is strictly less profitable.
      const result = seek({ targetValue: '0.5' }, { withRevenueLinkedCost: true })

      expect(result.status).toBe('CONVERGED')
      expect(Number(result.solutionFactor)).toBeCloseTo(4 / 3, 5)
      expect(Number(result.solutionFactor)).toBeGreaterThan(1.2)
      expect(result.method).toBe('BISECTION_FULL_RECALCULATION')
    })

    it('shows the marketing cost really did grow at the solution', () => {
      const result = seek({ targetValue: '0.5' }, { withRevenueLinkedCost: true })
      // 6,000,000 fixed + 5% of 13,333,333 ≈ 6,666,667
      expect(Number(result.atSolution.costs)).toBeCloseTo(6_666_667, -1)
      expect(Number(result.atSolution.revenue)).toBeCloseTo(13_333_333, -1)
    })
  })

  describe('it refuses rather than inventing a number', () => {
    it('says NOT_BRACKETED when no price in range reaches the target', () => {
      // A 99% margin on a 6M fixed cost needs revenue of 600M — sixty times the
      // base, far outside any sane search range.
      const result = seek({ targetValue: '0.99' })
      expect(result.status).toBe('NOT_BRACKETED')
      expect(result.solutionFactor).toBeNull()
      expect(result.atSolution).toBeNull()
    })

    it('reports what the ends of the range do reach, so the answer is usable', () => {
      const result = seek({ targetValue: '0.99' })
      expect(result.searchedRange.metricAtUpper).not.toBeNull()
      expect(Number(result.searchedRange.metricAtUpper)).toBeLessThan(0.99)
      expect(result.notes.join(' ')).toContain('searchedRange')
    })

    it('rejects an inverted search range', () => {
      expect(() => seek({ targetValue: '0.5', lowerFactor: '3', upperFactor: '1' }))
        .toThrow()
    })

    it('rejects a zero or negative lower bound', () => {
      // A factor of zero means "price everything at nothing", which is not a
      // scenario — and it would put a division by zero inside the engine.
      expect(() => seek({ targetValue: '0.5', lowerFactor: '0' })).toThrow()
    })
  })

  describe('a solution that breaks something says so', () => {
    it('surfaces issues the solution itself triggers, not ones already there', () => {
      // LTC of 1% is breached at any price; the point is that the breach is
      // reported against the SOLUTION, alongside the number.
      const result = seek({ targetValue: '0.5' }, { withDebt: true, ltc: '0.01' })
      expect(result.status).toBe('CONVERGED')
      expect(Array.isArray(result.atSolution.triggeredIssues)).toBe(true)
    })

    it('carries the baseline alongside, so the move is visible', () => {
      const result = seek({ targetValue: '0.5' })
      // Base margin is 4M/10M = 0.4; the target is 0.5.
      expect(Number(result.baseline.metric)).toBeCloseTo(0.4, 6)
      expect(Number(result.targetValue)).toBe(0.5)
    })
  })
})
