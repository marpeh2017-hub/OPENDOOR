/**
 * P1-6 — חתירה ליעד (Goal Seek).
 *
 * הפותר אינו מנוע מקביל: הוא קורא ל-`compute` הקיים שוב ושוב מעל אותו קלט
 * טעון, ומזיז קלט אחד בכל פעם. לכן כל מה שהמנוע יודע — הצמדה, רזרבה, ריבית,
 * חריגות — תקף גם בתוצאת החתירה, ואין שום נוסחה שנכתבה פעמיים.
 *
 * התרחיש כאן נבנה כך שהחשבון ניתן לבדיקה ביד: 10 יח״ד × 100 מ״ר × 20,000 ₪
 * למ״ר = 20,000,000 ₪ הכנסה, מול 16,000,000 ₪ עלות קבועה. רווח על עלות
 * בבסיס = 4,000,000 / 16,000,000 = 0.25 בדיוק. העלויות קבועות ואינן נגזרות
 * מההכנסה, ולכן יעד של 0.40 דורש הכנסה של 1.40 × 16,000,000 = 22,400,000,
 * כלומר 22,400 ₪ למ״ר — מספר שאפשר להחזיק מולו את פלט הפותר בלי להאמין לו.
 */
import { FeasibilityCalculationService, type LoadedFeasibilityProfile, type LoadedFeasibilityScenario } from './feasibility-calculation.service'
import type { CreateGoalSeekDto } from './dto/feasibility-foundation.dto'

const build = (overrides: { secondPricePerSqm?: string } = {}) => {
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
    scenarios: [] as unknown[],
  } as unknown as LoadedFeasibilityProfile

  const mixLine = (id: string, label: string, pricePerSqm: string, unitCount: number) => ({
    id, label, disposition: 'DEVELOPER_SALE', unitCount,
    saleableAreaSqm: '100', pricePerSqm, fixedUnitPrice: null,
    parkingSpaces: 0, parkingPrice: null,
    balconyAreaSqm: null, balconyPricePerSqm: null, storageAreaSqm: null, storagePricePerSqm: null,
    sourceId: 'source-1', isVerified: true, replacementAllocations: [],
  })

  const scenario = {
    id: 'scenario-1', name: 'בסיס', kind: 'BASE', isBaseline: true,
    unitMix: overrides.secondPricePerSqm
      ? [mixLine('mix-1', 'דירות 4 חדרים', '20000', 5), mixLine('mix-2', 'פנטהאוז', overrides.secondPricePerSqm, 5)]
      : [mixLine('mix-1', 'דירות 4 חדרים', '20000', 10)],
    revenueLines: [],
    costLines: [{
      id: 'cost-1', label: 'בנייה', category: 'CONSTRUCTION', quantity: null, unit: null, unitCost: null,
      fixedAmount: '16000000', percentage: null, percentageBase: null, vatTreatment: 'VAT_EXCLUDED',
      escalationRate: null, contingencyRate: null, sourceId: 'source-1', isVerified: true,
    }],
    compensations: [],
    cashFlowAllocations: [],
    financing: null,
  } as unknown as LoadedFeasibilityScenario

  ;(profile as unknown as { scenarios: unknown[] }).scenarios = [scenario]
  return { profile, scenario }
}

/**
 * `goalSeek` טוען דרך שירות הפרופיל; כאן הטעינה מוחלפת בקלט הטעון עצמו.
 * שאר הנתיב — כולל `compute` ו-`applySensitivityFactors` — הוא הקוד האמיתי.
 */
const engineFor = (profile: LoadedFeasibilityProfile) =>
  new FeasibilityCalculationService({ find: async () => profile } as never, null as never, null as never, null as never)

const seek = (dto: CreateGoalSeekDto, overrides?: { secondPricePerSqm?: string }) => {
  const { profile, scenario } = build(overrides)
  return { run: engineFor(profile).goalSeek('project-1', scenario.id, dto, 'tenant-1'), profile, scenario }
}

describe('P1-6 — Goal Seek', () => {
  it('מחזיר מחיר למ״ר מוחלט, ואותו מחיר מוחזר לתרחיש רגיל אכן מייצר את היעד', async () => {
    const { run } = seek({ solveFor: 'pricePerSqm', targetMetric: 'profitOnCost', targetValue: '0.40' })
    const result = await run

    expect(result.status).toBe('CONVERGED')
    expect(result.converged).toBe(true)
    // 1.40 × 16,000,000 = 22,400,000 על פני 1,000 מ״ר מכירה.
    expect(Number(result.solvedInput.solvedValue)).toBeCloseTo(22400, 2)
    expect(result.solvedInput.baseValue).toBe('20000.00')
    expect(result.solvedInput.basis).toBe('SINGLE_BASE_PRICE')
    expect(Number(result.requiredChangePercent)).toBeCloseTo(12, 6)

    // ההוכחה: המספר מוזן חזרה לתרחיש רגיל, והמנוע — לא הפותר — מחשב אותו.
    const { profile, scenario } = build()
    scenario.unitMix[0]!.pricePerSqm = result.solvedInput.solvedValue as never
    const recomputed = new FeasibilityCalculationService(null as never, null as never, null as never, null as never).compute(profile, scenario)
    expect(Number(recomputed.profitability.profitOnCost)).toBeCloseTo(0.40, 6)
    expect(Number(recomputed.revenue.total)).toBeCloseTo(22400000, 0)
  })

  it('אומר שאין פתרון בטווח במקום להחזיר את הקצה כאילו היה תשובה', async () => {
    // רווח על עלות של 500% אינו בר־השגה בעליית מחיר של עד 10%.
    const { run } = seek({ solveFor: 'pricePerSqm', targetMetric: 'profitOnCost', targetValue: '5', maxChangePercent: '10' })
    const result = await run

    expect(result.status).toBe('UNREACHABLE_WITHIN_RANGE')
    expect(result.converged).toBe(false)
    expect(result.searchedRangePercent).toBe('±10')
    // הערך הקרוב ביותר מדווח כפי שהוא, ולא מוצג כפתרון: 1.10 × 20M מול 16M.
    expect(Number(result.achievedValue)).toBeCloseTo(0.375, 6)
    expect(Number(result.remainingGap)).toBeLessThan(0)
    // ובעיקר: לא מוצע שום מחיר. הקצה הקרוב ביותר אינו תשובה.
    expect(result.solvedInput.basis).toBe('NOT_CONVERGED')
    expect(result.solvedInput.solvedValue).toBeNull()
    expect(result.solvedInput.perLine).toEqual([])
  })

  it('מתכנס במספר הרצות חסום — ולא בלולאה פתוחה', async () => {
    const { run } = seek({ solveFor: 'pricePerSqm', targetMetric: 'profitOnCost', targetValue: '0.40' })
    const result = await run

    // 24 צעדי תיחום לכל היותר בכל כיוון, 40 חציות, ועוד הרצת סיום.
    expect(result.evaluations).toBeGreaterThan(1)
    expect(result.evaluations).toBeLessThanOrEqual(90)
    // והדיוק שהושג בתוך אותו חסם הוא דיוק אמיתי, לא "קרוב מספיק".
    expect(Math.abs(Number(result.achievedValue) - 0.40)).toBeLessThan(1e-9)
  })

  it('לא ממציא מחיר יחיד כשלשורות המכירה יש כמה מחירי בסיס', async () => {
    const { run } = seek(
      { solveFor: 'pricePerSqm', targetMetric: 'profitOnCost', targetValue: '0.40' },
      { secondPricePerSqm: '30000' },
    )
    const result = await run

    expect(result.status).toBe('CONVERGED')
    expect(result.solvedInput.basis).toBe('MULTIPLE_BASE_PRICES')
    expect(result.solvedInput.solvedValue).toBeNull()
    // הפירוט לפי שורה נמסר תמיד, כי שם התשובה כן קיימת.
    expect(result.solvedInput.perLine.map((line) => line.baseValue)).toEqual(['20000.00', '30000.00'])
    const factor = Number(result.requiredFactor)
    expect(Number(result.solvedInput.perLine[1]!.solvedValue)).toBeCloseTo(30000 * factor, 1)
  })

  it('מסרב לחתור למדד שאינו מוגדר בבסיס במקום להמציא נקודת מוצא', async () => {
    const { profile, scenario } = build()
    scenario.costLines = [] as never
    await expect(engineFor(profile).goalSeek('project-1', scenario.id, { solveFor: 'pricePerSqm', targetMetric: 'profitOnCost', targetValue: '0.40' }, 'tenant-1'))
      .rejects.toMatchObject({ kind: 'VALIDATION', details: [{ code: 'FEASIBILITY_GOAL_SEEK_METRIC_UNAVAILABLE' }] })
  })
})
