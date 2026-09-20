/**
 * פער 1 — תמורה שאינה במזומן.
 *
 * הטענה שצריך להוכיח כאן היא **זהות**, לא פיצ׳ר: הרווח על בסיס נטו ועל בסיס
 * ברוטו הוא אותו מספר בדיוק, ולכן השינוי נוגע אך ורק למכנים. אם הרווח זז —
 * התיקון שגוי, ולא משנה כמה היחס נראה טוב יותר.
 *
 * התרחיש: בניין של 800 מ״ר במחיר 50,000 ₪/מ״ר = 40,000,000 ₪ שווי. מתוכו
 * 200 מ״ר (10,000,000 ₪) נמסרים למוכר כתמורת קרקע, ולכן היזם מוכר 600 מ״ר
 * = 30,000,000 ₪. עלות קשיחה 20,000,000 ₪ ועוד 5,000,000 ₪ מזומן על הקרקע.
 */
import Decimal from 'decimal.js'
import { FeasibilityCalculationService, type LoadedFeasibilityProfile, type LoadedFeasibilityScenario } from './feasibility-calculation.service'

const engine = new FeasibilityCalculationService(null as never, null as never, null as never)

const build = (options: { inKind?: string | null; saleSqm?: number; cashLand?: string } = {}) => {
  const profile = {
    id: 'profile-1',
    valuationDate: new Date('2026-01-01T00:00:00.000Z'),
    parcels: [{ id: 'p', gush: '1', chelka: '2', landAreaSqm: '500', sourceId: 's', isVerified: true }],
    areas: [{ id: 'a', areaType: 'GROSS', valueSqm: '2000', label: 'ברוטו', sourceId: 's', isVerified: true }],
    planningRights: [{ id: 'r', category: 'RESIDENTIAL', status: 'APPROVED', unitCount: 8, sourceId: 's', isVerified: true }],
    comparableTransactions: [],
    assumptions: [
      { key: 'annual-discount-rate', value: '0.08' },
      { key: 'required-developer-profit-margin', value: '0.15' },
    ],
    sources: [], scenarios: [],
  } as unknown as LoadedFeasibilityProfile

  const scenario = {
    id: 'scenario-1', name: 'בסיס', kind: 'BASE', isBaseline: true,
    considerationInKind: options.inKind === undefined ? null : options.inKind,
    unitMix: [{
      id: 'mix-1', label: 'דירות למכירה', disposition: 'DEVELOPER_SALE', unitCount: 1,
      saleableAreaSqm: String(options.saleSqm ?? 600), pricePerSqm: '50000', fixedUnitPrice: null,
      grossAreaSqm: '900', parkingSpaces: 0, parkingPrice: null,
      balconyAreaSqm: null, balconyPricePerSqm: null, storageAreaSqm: null, storagePricePerSqm: null,
      sourceId: 's', isVerified: true, replacementAllocations: [],
    }],
    revenueLines: [],
    costLines: [
      { id: 'c-build', label: 'בנייה', category: 'CONSTRUCTION', quantity: null, unit: null, unitCost: null,
        fixedAmount: '20000000', percentage: null, percentageBase: null, vatTreatment: 'VAT_EXCLUDED',
        escalationRate: null, contingencyRate: null, sourceId: 's', isVerified: true },
      { id: 'c-land', label: 'קרקע — מזומן', category: 'LAND', quantity: null, unit: null, unitCost: null,
        fixedAmount: options.cashLand ?? '5000000', percentage: null, percentageBase: null, vatTreatment: 'VAT_EXCLUDED',
        escalationRate: null, contingencyRate: null, sourceId: 's', isVerified: true },
    ],
    compensations: [], cashFlowAllocations: [], financing: null, equityTranches: [],
  } as unknown as LoadedFeasibilityScenario

  ;(profile as unknown as { scenarios: unknown[] }).scenarios = [scenario]
  return { profile, scenario }
}

const run = (o?: Parameters<typeof build>[0]) => { const { profile, scenario } = build(o); return engine.compute(profile, scenario) }

describe('פער 1 — תמורה שאינה במזומן', () => {
  it('לא משנה דבר בתרחיש ללא תמורה בשווה־כסף — ההתנהגות הקיימת נשמרת בדיוק', () => {
    const none = run({ inKind: null })
    const zero = run({ inKind: '0' })

    // 600 מ״ר × 50,000 = 30,000,000 מול 25,000,000 עלות.
    expect(none.revenue.total).toBe('30000000.00')
    expect(none.costs.total).toBe('25000000.00')
    expect(none.profitability.profit).toBe('5000000.00')
    expect(Number(none.profitability.profitOnCost)).toBeCloseTo(5 / 25, 8)
    // null ו-0 חייבים להיות אותו דבר בדיוק, עד הספרה האחרונה.
    expect(zero.profitability).toEqual(none.profitability)
    expect(zero.valuation.residualLandValue).toBe(none.valuation.residualLandValue)
    // והבסיסים החדשים מתלכדים עם הישנים כשאין תמורה בשווה־כסף.
    expect(none.costs.totalWithConsiderationInKind).toBe(none.costs.total)
    expect(none.revenue.totalWithConsiderationInKind).toBe(none.revenue.total)
    expect(none.profitability.profitOnCost).toBe(none.profitability.profitOnCashCost)
  })

  /** הטענה המרכזית: הרווח זהה בשני הבסיסים, ולכן רק המכנה זז. */
  it('הרווח אינו זז כשנרשמת תמורה בשווה־כסף — רק היחסים', () => {
    const cash = run({ inKind: null })
    const kind = run({ inKind: '10000000' })

    expect(kind.profitability.profit).toBe(cash.profitability.profit)
    expect(kind.revenue.total).toBe(cash.revenue.total)
    expect(kind.costs.total).toBe(cash.costs.total)

    // אבל הבסיסים גדלים בדיוק בשווי התמורה, ושניהם באותו סכום.
    expect(kind.costs.considerationInKind).toBe('10000000.00')
    expect(kind.costs.totalWithConsiderationInKind).toBe('35000000.00')
    expect(kind.revenue.totalWithConsiderationInKind).toBe('40000000.00')

    // 5,000,000 / 35,000,000 = 14.29%, לא 5/25 = 20%.
    expect(Number(kind.profitability.profitOnCost)).toBeCloseTo(5 / 35, 8)
    expect(Number(kind.profitability.profitOnCashCost)).toBeCloseTo(5 / 25, 8)
    expect(Number(kind.profitability.profitMargin)).toBeCloseTo(5 / 40, 8)
  })

  /**
   * הבדיקה שמוכיחה שהבסיס הברוטו הוא הנכון: עסקת מזומן שקולה כלכלית —
   * אותה קרקע, הכול במזומן, והדירות נמכרות — חייבת לתת אותו ROC.
   */
  it('נותן אותו ROC כמו עסקת מזומן שקולה כלכלית', () => {
    // קומבינציה: 5M מזומן + 10M בדירות, היזם מוכר 600 מ״ר.
    const combination = run({ inKind: '10000000' })
    // מזומן שקול: 15M קרקע במזומן, היזם מוכר את כל 800 המ״ר.
    const allCash = run({ inKind: null, saleSqm: 800, cashLand: '15000000' })

    expect(allCash.revenue.total).toBe('40000000.00')
    expect(allCash.costs.total).toBe('35000000.00')
    expect(allCash.profitability.profit).toBe(combination.profitability.profit)
    expect(allCash.profitability.profitOnCost).toBe(combination.profitability.profitOnCost)
    expect(allCash.profitability.profitMargin).toBe(combination.profitability.profitMargin)
    // וזה בדיוק מה שהיחס הישן החמיץ.
    expect(combination.profitability.profitOnCashCost).not.toBe(allCash.profitability.profitOnCost)
  })

  it('שווי קרקע שיורי נמדד על מלוא התמורה, ומשתווה לעסקת המזומן השקולה', () => {
    const combination = run({ inKind: '10000000' })
    const allCash = run({ inKind: null, saleSqm: 800, cashLand: '15000000' })
    // 40,000,000 − 20,000,000 בנייה − 6,000,000 רווח נדרש (15%) = 14,000,000.
    expect(combination.valuation.residualLandValue).toBe('14000000.00')
    expect(combination.valuation.residualLandValue).toBe(allCash.valuation.residualLandValue)
  })

  /**
   * רגרסיה: תמורה בשווה־כסף אינה תזרים ואסור לה להיות תזרים.
   *
   * אם מישהו יחבר אותה בטעות להקצאות התזרים, הריבית, חוב השיא וה-IRR יזוזו.
   * הבדיקה הזאת מקבעת שהם לא.
   */
  it('אינה נוגעת בתזרים — ריבית, חוב שיא ותשואות אינם זזים', () => {
    const withDebt = (inKind: string | null) => {
      const { profile, scenario } = build({ inKind })
      scenario.cashFlowAllocations = [
        { id: 'a-cost', periodStart: new Date('2026-06-01T00:00:00.000Z'), direction: 'OUTFLOW', sourceKind: 'COST', sourceLineId: 'c-build', amount: '20000000' },
        { id: 'a-rev', periodStart: new Date('2028-01-01T00:00:00.000Z'), direction: 'INFLOW', sourceKind: 'REVENUE', sourceLineId: 'mix-1', amount: '30000000' },
        { id: 'a-draw', periodStart: new Date('2026-06-01T00:00:00.000Z'), direction: 'INFLOW', sourceKind: 'DEBT', sourceLineId: null, amount: '12000000' },
        { id: 'a-repay', periodStart: new Date('2028-01-01T00:00:00.000Z'), direction: 'OUTFLOW', sourceKind: 'DEBT', sourceLineId: null, amount: '12000000' },
      ] as never
      scenario.financing = { id: 'f', debtAmount: '12000000', equityAmount: '13000000', ltc: null, ltv: null,
        annualInterestRate: '0.06', arrangementFeeRate: null, guaranteeFeeRate: null, graceMonths: 0, financingMonths: 24 } as never
      return engine.compute(profile, scenario)
    }
    const cash = withDebt(null)
    const kind = withDebt('10000000')

    expect(kind.financing.accumulatedInterest).toBe(cash.financing.accumulatedInterest)
    expect(kind.financing.peakDebt).toBe(cash.financing.peakDebt)
    expect(kind.returns.projectIrrAnnual).toBe(cash.returns.projectIrrAnnual)
    expect(kind.returns.projectNpv).toBe(cash.returns.projectNpv)
    expect(kind.cashFlow).toEqual(cash.cashFlow)
  })

  /**
   * `solveFor: 'totalConsideration'` — מה הסכום הכולל שהקרקע יכולה לשאת.
   *
   * המנוף מזיז מזומן ותמורה בשווה־כסף **יחד ובאותו מקדם**, כי זה המספר
   * היחיד ששני הצדדים מנהלים עליו משא ומתן. להזיז רק את המזומן היה עונה על
   * שאלה שאיש לא שאל.
   */
  it('פותר את מלוא התמורה — מזומן ושווה־כסף יחד — ומחזיר סכום מוחלט', async () => {
    const { profile, scenario } = build({ inKind: '10000000' })
    const solver = new FeasibilityCalculationService({ find: async () => profile } as never, null as never, null as never)
    const result = await solver.goalSeek('project-1', scenario.id, {
      solveFor: 'totalConsideration', targetMetric: 'profitOnCost', targetValue: '0.25',
    }, 'tenant-1')

    expect(result.status).toBe('CONVERGED')
    expect(result.solvedInput.basis).toBe('CASH_PLUS_IN_KIND')
    // בסיס = 5,000,000 מזומן + 10,000,000 בדירות.
    expect(result.solvedInput.baseValue).toBe('15000000.00')
    expect(Number(result.achievedValue)).toBeCloseTo(0.25, 8)

    /*
     * שני הרכיבים זזו באותו מקדם. נבדק כיחס ולא מול `requiredFactor`, שמדווח
     * ב-8 ספרות — השוואה מול המקדם המעוגל נכשלת על אגורה אחת שמקורה בעיגול
     * הדיווח ולא בחישוב.
     */
    const cash = result.solvedInput.perLine.find((l) => l.lineId === 'cash')!
    const inKind = result.solvedInput.perLine.find((l) => l.lineId === 'in-kind')!
    const cashRatio = Number(cash.solvedValue) / Number(cash.baseValue)
    const inKindRatio = Number(inKind.solvedValue) / Number(inKind.baseValue)
    expect(cashRatio).toBeCloseTo(inKindRatio, 8)
    expect(cashRatio).toBeCloseTo(Number(result.requiredFactor), 6)
    // וסכום הרכיבים הוא בדיוק התשובה.
    expect(Number(cash.solvedValue) + Number(inKind.solvedValue)).toBeCloseTo(Number(result.solvedInput.solvedValue), 2)

    // ההוכחה: מזינים את שני הרכיבים חזרה כקלט רגיל, והמנוע — לא הפותר — מחשב.
    const fed = build({ inKind: inKind.solvedValue })
    fed.scenario.costLines.find((l) => l.category === 'LAND')!.fixedAmount = cash.solvedValue as never
    expect(Number(engine.compute(fed.profile, fed.scenario).profitability.profitOnCost)).toBeCloseTo(0.25, 6)
  })

  it('דוחה תמורה שלילית במקום לחשב יחס חסר משמעות', () => {
    const codes = run({ inKind: '-1' }).validation.map((i) => i.code)
    expect(codes).toContain('CONSIDERATION_IN_KIND_NEGATIVE')
  })
})
