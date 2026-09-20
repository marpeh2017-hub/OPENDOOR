/**
 * P2 — גזירת לוח המימון.
 *
 * ה-LTC נמדד על חוב השיא, וחוב השיא כולל את הריבית שהוונה בגרייס. הריבית
 * נכנסת גם לסך העלויות, שהוא המכנה של אותו יחס עצמו. הפירעון סוגר יתרה, לא
 * קרן, והיתרה היא הקרן שנמשכה ועוד אותה ריבית מהוונת. כלומר המשיכה קובעת את
 * הריבית, הריבית קובעת את שני צידי היחס, והיחס אמור היה לקבוע את המשיכה.
 *
 * עד לפותר הזה הלולאה נסגרה ביד. כאן היא נסגרת מול אותו `compute` — ולכן מה
 * שהפותר מחזיר הוא מה שהמנוע באמת מייצר, לא מה שמודל שני חושב שהוא מייצר.
 *
 * התרחיש בנוי כך שהחשבון ניתן לבדיקה: 10 יח״ד × 100 מ״ר × 20,000 ₪ = 20M
 * הכנסה ב-2028-06, מול 16M עלות בנייה ב-2027-01. המשיכה ב-2027-01, הפירעון
 * ב-2028-06, ריבית 6.5% עם 12 חודשי גרייס.
 */
import { FeasibilityCalculationService, type LoadedFeasibilityProfile, type LoadedFeasibilityScenario } from './feasibility-calculation.service'

const DRAW = '2027-01-01'
const REPAY = '2028-06-01'

const build = (financing: Record<string, unknown> | null = { annualInterestRate: '0.065', graceMonths: 12, ltc: '0.6' }) => {
  const profile = {
    id: 'profile-1',
    valuationDate: new Date('2026-01-01T00:00:00.000Z'),
    parcels: [{ id: 'parcel-1', gush: '1234', chelka: '56', landAreaSqm: '500', sourceId: 'source-1', isVerified: true }],
    areas: [{ id: 'area-1', areaType: 'GROSS', valueSqm: '1000', label: 'ברוטו', sourceId: 'source-1', isVerified: true }],
    planningRights: [{ id: 'right-1', category: 'RESIDENTIAL', status: 'APPROVED', unitCount: 10, sourceId: 'source-1', isVerified: true }],
    comparableTransactions: [],
    assumptions: [{ key: 'annual-discount-rate', value: '0.08' }, { key: 'required-developer-profit-margin', value: '0.15' }],
    sources: [],
    scenarios: [] as unknown[],
  } as unknown as LoadedFeasibilityProfile

  const allocation = (id: string, sourceKind: string, direction: string, periodStart: string, amount: string, sourceLineId: string | null = null) =>
    ({ id, sourceKind, direction, periodStart: new Date(`${periodStart}T00:00:00.000Z`), amount, sourceLineId })

  const scenario = {
    id: 'scenario-1', name: 'בסיס', kind: 'BASE', isBaseline: true,
    unitMix: [{
      id: 'mix-1', label: 'דירות', disposition: 'DEVELOPER_SALE', unitCount: 10,
      saleableAreaSqm: '100', pricePerSqm: '20000', fixedUnitPrice: null,
      parkingSpaces: 0, parkingPrice: null, balconyAreaSqm: null, balconyPricePerSqm: null,
      storageAreaSqm: null, storagePricePerSqm: null, sourceId: 'source-1', isVerified: true, replacementAllocations: [],
    }],
    revenueLines: [],
    costLines: [{
      id: 'cost-1', label: 'בנייה', category: 'CONSTRUCTION', quantity: null, unit: null, unitCost: null,
      fixedAmount: '16000000', percentage: null, percentageBase: null, vatTreatment: 'VAT_EXCLUDED',
      escalationRate: null, contingencyRate: null, sourceId: 'source-1', isVerified: true,
    }],
    compensations: [],
    cashFlowAllocations: [
      allocation('alloc-cost', 'COST', 'OUTFLOW', DRAW, '16000000', 'cost-1'),
      allocation('alloc-revenue', 'REVENUE', 'INFLOW', REPAY, '20000000', 'mix-1'),
      allocation('alloc-draw', 'DEBT', 'INFLOW', DRAW, '9000000'),
      allocation('alloc-repay', 'DEBT', 'OUTFLOW', REPAY, '9000000'),
    ],
    financing,
  } as unknown as LoadedFeasibilityScenario

  ;(profile as unknown as { scenarios: unknown[] }).scenarios = [scenario]
  return { profile, scenario }
}

const engineFor = (profile: LoadedFeasibilityProfile) =>
  new FeasibilityCalculationService({ find: async () => profile } as never, null as never, null as never)

const solve = (dto: Record<string, unknown> = {}, financing?: Record<string, unknown> | null) => {
  const { profile, scenario } = build(financing === undefined ? undefined : financing)
  return { run: engineFor(profile).solveFinancing('project-1', scenario.id, dto as never, 'tenant-1'), profile, scenario }
}

/** The same schedule, fed back through a PLAIN compute — the solver does not get to grade its own answer. */
const recompute = (draw: string, repayment: string) => {
  const { profile, scenario } = build()
  const allocations = scenario.cashFlowAllocations as unknown as Array<{ id: string; amount: string }>
  allocations.find((a) => a.id === 'alloc-draw')!.amount = draw
  allocations.find((a) => a.id === 'alloc-repay')!.amount = repayment
  return new FeasibilityCalculationService(null as never, null as never, null as never).compute(profile, scenario)
}

describe('P2 — פתרון לוח המימון', () => {
  it('מגיע ל-LTC המבוקש בדיוק ולסגירת יתרה — והמנוע הרגיל מאשר את אותו לוח', async () => {
    const { run } = solve()
    const result = await run

    expect(result.status).toBe('CONVERGED')
    expect(result.solution).not.toBeNull()
    expect(Number(result.solution!.actualLtc)).toBeCloseTo(0.6, 9)
    expect(Math.abs(Number(result.solution!.debtBalance))).toBeLessThanOrEqual(0.01)

    // ההוכחה שאינה של הפותר: אותם שני מספרים, דרך compute רגיל.
    const back = recompute(result.solution!.drawdown, result.solution!.repayment)
    expect(Number(back.financing.actualLtc)).toBeCloseTo(0.6, 9)
    expect(Math.abs(Number(back.financing.debtBalance))).toBeLessThanOrEqual(0.01)
    expect(back.validation.some((issue) => issue.code === 'LTC_LIMIT_EXCEEDED')).toBe(false)
    expect(back.validation.some((issue) => issue.code === 'DEBT_NOT_REPAID')).toBe(false)
  })

  it('הפירעון סוגר יתרה ולא קרן: הוא גדול מהמשיכה בדיוק בריבית שהוונה בגרייס', async () => {
    const result = await solve().run
    const draw = Number(result.solution!.drawdown)
    const repayment = Number(result.solution!.repayment)
    expect(repayment).toBeGreaterThan(draw)

    // חוב השיא הוא הקרן ועוד הריבית המהוונת, וזה בדיוק מה שנפרע.
    const back = recompute(result.solution!.drawdown, result.solution!.repayment)
    expect(repayment - draw).toBeCloseTo(Number(back.financing.peakDebt) - draw, 2)
    expect(Number(back.financing.peakDebt)).toBeCloseTo(repayment, 2)
    // ופירעון בגובה הקרן בלבד היה משאיר בדיוק את אותו פער פתוח.
    const principalOnly = recompute(result.solution!.drawdown, result.solution!.drawdown)
    expect(Number(principalOnly.financing.debtBalance)).toBeCloseTo(repayment - draw, 2)
    expect(principalOnly.validation.some((issue) => issue.code === 'DEBT_NOT_REPAID')).toBe(true)
  })

  it('מתכנס לאותו לוח שהתכנסות ידנית נתנה: יעד = ה-LTC שהלוח הידני משיג בפועל', async () => {
    /*
     * זה המבחן שמכריע. לוח "ידני" נבנה כאן ביד — משיכה עגולה, ופירעון שנסגר
     * בשתי פעימות כפי שנעשה בפועל — ואז נמדד ה-LTC שהוא משיג. הפותר מקבל את
     * אותו LTC כיעד, ואמור להחזיר את אותם שני מספרים. אם הפותר פותר משוואה
     * אחרת, כאן זה ייראה.
     */
    const manualDraw = '9000000'
    let manualRepayment = manualDraw
    for (let pass = 0; pass < 6; pass += 1) {
      const attempt = recompute(manualDraw, manualRepayment)
      const balance = Number(attempt.financing.debtBalance)
      if (Math.abs(balance) <= 0.01) break
      manualRepayment = (Number(manualRepayment) + balance).toFixed(2)
    }
    const manual = recompute(manualDraw, manualRepayment)
    expect(Math.abs(Number(manual.financing.debtBalance))).toBeLessThanOrEqual(0.01)

    const result = await solve({ targetLtc: Number(manual.financing.actualLtc).toFixed(10) }).run
    expect(result.status).toBe('CONVERGED')
    // לשקל, לא ל"בערך": הפותר חוזר בדיוק ללוח הידני.
    expect(Number(result.solution!.drawdown)).toBeCloseTo(Number(manualDraw), 0)
    expect(Number(result.solution!.repayment)).toBeCloseTo(Number(manualRepayment), 0)
  })

  it('הסוגר העליון אמיתי: גם יעד קיצוני בטווח החוקי נתפס בתוך בסיס העלויות', async () => {
    /*
     * זה המשלים לבדיקה הקודמת, ולא קישוט: הפותר מכריז "לא בר־השגה" רק אם
     * הסוגר העליון אינו מגיע ליעד. כאן נבדק שהסוגר הזה באמת מכסה את כל טווח
     * ה-LTC החוקי (עד 1), ולכן ההכרזה ההיא היא הגנה ולא מסלול שהקורא צריך
     * לצפות לו. משיכה בגובה בסיס העלויות מייצרת LTC של 1 לפחות.
     */
    const result = await solve({ targetLtc: '0.99' }).run
    expect(result.status).toBe('CONVERGED')
    expect(Number(result.solution!.actualLtc)).toBeCloseTo(0.99, 6)
    expect(Math.abs(Number(result.solution!.debtBalance))).toBeLessThanOrEqual(0.01)
  })

  it('היחס המדווח מסביר את הדגל: חריגה גבולית נראית במספר, ולא רק בהודעת השגיאה', () => {
    /*
     * בדיקת הקובננט בפנים משווה ערכים לא מעוגלים. כל עוד היחס דווח בשמונה
     * ספרות, חריגה גבולית הופיעה כ-LTC_LIMIT_EXCEEDED ליד "60.00000000% מול
     * מגבלה של 60.00000000%" — דגל שאין במוצג שום דבר שמסביר אותו, ולכן גם
     * פותר שקרא את המספר המדווח הסיק שהלוח תקין.
     *
     * כאן נמצא הגבול בחציה, ונבדק שבנקודה הראשונה שהמנוע מכריז עליה חריגה,
     * המספר המדווח אכן גדול מהמגבלה. בשמונה ספרות הבדיקה הזו נכשלת.
     */
    const engine = new FeasibilityCalculationService(null as never, null as never, null as never)
    const at = (draw: number) => {
      const { profile, scenario } = build()
      const allocations = scenario.cashFlowAllocations as unknown as Array<{ id: string; amount: string }>
      allocations.find((a) => a.id === 'alloc-draw')!.amount = draw.toFixed(2)
      allocations.find((a) => a.id === 'alloc-repay')!.amount = (draw * 1.2).toFixed(2)
      return engine.compute(profile, scenario)
    }
    let below = 1_000_000
    let above = 15_000_000
    for (let i = 0; i < 60; i += 1) {
      const mid = (below + above) / 2
      if (at(mid).validation.some((issue) => issue.code === 'LTC_LIMIT_EXCEEDED')) above = mid
      else below = mid
    }

    const breaching = at(above)
    expect(breaching.validation.some((issue) => issue.code === 'LTC_LIMIT_EXCEEDED')).toBe(true)
    // הטענה עצמה: המספר גדול מהמגבלה, כפי שהוא מדווח.
    expect(Number(breaching.financing.actualLtc)).toBeGreaterThan(Number(breaching.financing.ltcLimit))
    // ולראיה שזו אכן נקודה גבולית ולא חריגה גסה — בשמונה ספרות השניים זהים.
    expect(Number(breaching.financing.actualLtc).toFixed(8)).toBe(Number(breaching.financing.ltcLimit).toFixed(8))
  }, 30000)

  it('אינו כותב: התרחיש שנטען יוצא מהפותר כפי שנכנס', async () => {
    const { run, scenario } = solve()
    const before = JSON.stringify(scenario.cashFlowAllocations)
    await run
    expect(JSON.stringify(scenario.cashFlowAllocations)).toBe(before)
  })

  it('בלי מגבלת LTC ובלי יעד — אומר שאין למה לחתור, ולא ממציא קובננט', async () => {
    await expect(solve({}, { annualInterestRate: '0.065', graceMonths: 12 }).run).rejects.toMatchObject({
      details: [{ code: 'FEASIBILITY_FINANCING_SOLVE_TARGET_MISSING' }],
    })
  })

  it('בלי משיכה ובלי פירעון בתזרים — אומר שהמועדים חסרים, ולא בוחר אותם בעצמו', async () => {
    const { profile, scenario } = build()
    ;(scenario as unknown as { cashFlowAllocations: Array<{ sourceKind: string }> }).cashFlowAllocations =
      scenario.cashFlowAllocations.filter((allocation) => (allocation as unknown as { sourceKind: string }).sourceKind !== 'DEBT') as never
    await expect(engineFor(profile).solveFinancing('project-1', scenario.id, {} as never, 'tenant-1')).rejects.toMatchObject({
      details: [{ code: 'FEASIBILITY_FINANCING_SOLVE_PERIODS_MISSING' }],
    })
  })

  it('פירעון לפני המשיכה נדחה', async () => {
    await expect(solve({ repaymentPeriod: '2026-06-01' }).run).rejects.toMatchObject({
      details: [{ code: 'FEASIBILITY_FINANCING_SOLVE_PERIODS_INVALID' }],
    })
  })
})
