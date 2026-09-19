/**
 * P0-1 — שדות שנקלטו ולא השפיעו.
 *
 * עד לשינוי הזה `escalationRate`, `contingencyRate`, `graceMonths`,
 * `financingMonths`, `ltc` ו-`ltv` נשמרו במסד ולא הופיעו באף חישוב. משתמש
 * שהזין גרייס או מגבלת LTC קיבל בחזרה מספר שנראה סמכותי ולא נבע ממה שהזין.
 *
 * הבדיקות כאן קיימות כדי שזה לא יוכל לחזור בשקט: כל שדה חייב להראות
 * הפרש מדיד מול אותו תרחיש בדיוק בלעדיו.
 *
 * `compute` הפך לפונקציה טהורה מעל קלט טעון, ולכן אין כאן מסד ואין HTTP —
 * רק המנוע והחשבון.
 */
import Decimal from 'decimal.js'
import { FeasibilityCalculationService, type LoadedFeasibilityProfile, type LoadedFeasibilityScenario } from './feasibility-calculation.service'

// המנוע אינו נוגע ב-Prisma, ב-audit ובשירות הטעינה. הוא מקבל קלט טעון
// ומחזיר תוצאה, וזו בדיוק הסיבה שאפשר לבדוק אותו כך.
const engine = new FeasibilityCalculationService(null as never, null as never, null as never)

type Overrides = {
  escalationRate?: string
  contingencyRate?: string
  graceMonths?: number
  financingMonths?: number
  ltc?: string
  ltv?: string
  annualInterestRate?: string
  withDebt?: boolean
  withRevenueLinkedCost?: boolean
}

/**
 * תרחיש בסיס מכוון כך שהאריתמטיקה ניתנת לבדיקה ביד:
 * הוצאת הבנייה נופלת בדיוק 365 יום אחרי המועד הקובע, ולכן שיעור התייקרות
 * שנתי של 5% הוא בדיוק 5% ולא מספר שצריך להאמין לו.
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
    costLines: [{
      id: 'cost-1', label: 'בנייה', category: 'CONSTRUCTION', quantity: null, unit: null, unitCost: null,
      fixedAmount: '6000000', percentage: null, percentageBase: null, vatTreatment: 'VAT_EXCLUDED',
      escalationRate: overrides.escalationRate ?? null,
      contingencyRate: overrides.contingencyRate ?? null,
      sourceId: 'source-1', isVerified: true,
    },
    ...(overrides.withRevenueLinkedCost ? [{
      // עלות שהבסיס שלה הוא ההכנסה. זו השורה שחושפת את ההבדל בין הרצה
      // מחדש להכפלת פלט: היא זזה עם המחיר אף שאינה עלות בנייה ואינה קרקע.
      id: 'cost-marketing', label: 'שיווק', category: 'MARKETING', quantity: null, unit: null, unitCost: null,
      fixedAmount: null, percentage: '0.05', percentageBase: 'TOTAL_REVENUE', vatTreatment: 'VAT_EXCLUDED',
      escalationRate: null, contingencyRate: null, sourceId: 'source-1', isVerified: true,
    }] : []),
    ],
    compensations: [],
    cashFlowAllocations: allocations,
    financing: withDebt || overrides.ltc || overrides.ltv ? {
      id: 'financing-1', debtAmount: '5000000', equityAmount: '2000000',
      ltc: overrides.ltc ?? null, ltv: overrides.ltv ?? null,
      annualInterestRate: overrides.annualInterestRate ?? (withDebt ? '0.06' : null),
      arrangementFeeRate: null, guaranteeFeeRate: null,
      graceMonths: overrides.graceMonths ?? null,
      financingMonths: overrides.financingMonths ?? null,
    } : null,
  } as unknown as LoadedFeasibilityScenario

  return { profile, scenario }
}

const run = (overrides: Overrides = {}) => {
  const { profile, scenario } = build(overrides)
  return engine.compute(profile, scenario)
}

const codes = (result: ReturnType<typeof run>) => result.validation.map((issue) => issue.code)
const lineById = (result: ReturnType<typeof run>, id: string) => result.costs.lines.find((line) => line.id === id)

describe('P0-1 — שדות המימון משפיעים בפועל', () => {
  it('distinguishes source coverage from professional verification', () => {
    const { profile, scenario } = build()
    for (const row of [...profile.parcels, ...profile.areas, ...profile.planningRights, ...scenario.costLines]) row.isVerified = false
    const quality = engine.compute(profile, scenario).dataQuality
    expect(quality.confidenceScore).toBe(100)
    expect(quality.professionallyVerifiedRowCount).toBe(0)
    expect(quality.sourceLinkedRowCount).toBe(quality.evidenceRowCount)
    expect(quality.scoreBasis).toBe('SOURCE_OR_VERIFICATION_COVERAGE')
  })

  it('counts two co-owners of one existing apartment as one replacement commitment', () => {
    const { profile, scenario } = build()
    scenario.unitMix.push({ ...scenario.unitMix[0]!, id: 'replacement', disposition: 'OWNER_REPLACEMENT', unitCount: 1 } as never)
    scenario.compensations = ['holding-a', 'holding-b'].map((ownerApartmentId) => ({ id: ownerApartmentId, ownerApartmentId, replacementValue: new Decimal(500000), ownerApartment: { apartmentId: 'apartment-one', shareNumerator: 1, shareDenominator: 2 } })) as never
    const result = engine.compute(profile, scenario)
    expect(result.unitSummary.replacementHoldingCount).toBe(2)
    expect(result.unitSummary.replacementExistingApartmentCount).toBe(1)
    expect(result.validation.map((issue) => issue.code)).not.toContain('REPLACEMENT_UNITS_BELOW_COMMITMENTS')
    scenario.compensations[1]!.ownerApartment.apartmentId = 'apartment-two'
    expect(engine.compute(profile, scenario).validation.map((issue) => issue.code)).toContain('REPLACEMENT_UNITS_BELOW_COMMITMENTS')
  })

  it('freezes inputs, output and sensitivity from one profile read', async () => {
    const { profile, scenario } = build()
    profile.scenarios = [scenario]
    const find = jest.fn().mockResolvedValueOnce(profile).mockRejectedValue(new Error('second read would observe changed data'))
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'snapshot', ...data }))
    const prisma = { project: { findFirst: jest.fn().mockResolvedValue({ id: 'project', name: 'Synthetic test' }) }, $transaction: jest.fn().mockImplementation((fn) => fn({ feasibilityCalculationSnapshot: { create } })) }
    const service = new FeasibilityCalculationService({ find } as never, prisma as never, { record: jest.fn() } as never)
    const snapshot = await service.createSnapshot('project', scenario.id, { tenantId: 'tenant', userId: 'user' } as never, { sensitivity: { primaryVariable: 'SALE_PRICE', primaryChanges: ['0'] } } as never)
    expect(find).toHaveBeenCalledTimes(1)
    expect(snapshot.outputSnapshot).toEqual(engine.compute(profile, scenario))
    expect((snapshot.sensitivitySnapshot as any).baseline.revenue).toBe('10000000.00')
    expect((snapshot.inputSnapshot as any).scenarios[0].unitMix[0].disposition).toBe('DEVELOPER_SALE')
  })

  it.each(['OWNER_REPLACEMENT', 'RETAINED'] as const)('excludes %s units and their accessories from revenue and break-even area', (disposition) => {
    const { profile, scenario } = build()
    scenario.unitMix[0]!.saleableAreaSqm = new Decimal(100) as never
    scenario.unitMix.push({ ...scenario.unitMix[0]!, id: 'non-sale', disposition, unitCount: 2, parkingSpaces: 2, parkingPrice: new Decimal(100000), balconyAreaSqm: new Decimal(10), balconyPricePerSqm: new Decimal(10000), storageAreaSqm: new Decimal(5), storagePricePerSqm: new Decimal(10000) } as never)
    const result = engine.compute(profile, scenario)
    expect(result.revenue.total).toBe('10000000.00')
    expect(result.breakEven.saleableAreaSqm).toBe('1000.0000')
    expect(result.unitSummary.totalUnits).toBe(12)
    expect(result.validation.map((issue) => issue.code)).toContain('UNIT_MIX_EXCEEDS_RIGHTS')
  })

  it('blocks unclassified historical inventory and excludes speculative revenue', () => {
    const { profile, scenario } = build()
    scenario.unitMix[0]!.disposition = 'UNCLASSIFIED'
    const result = engine.compute(profile, scenario)
    expect(result.revenue.total).toBe('0.00')
    expect(result.feasibility.status).toBe('DATA_INCOMPLETE')
    expect(result.unitSummary.unclassifiedUnits).toBe(10)
    expect(result.validation.map((issue) => issue.code)).toContain('UNIT_DISPOSITION_MISSING')
  })

  it.each([['3000000', 'NOT_FEASIBLE'], ['2500000', 'FEASIBLE']])('checks the profit target after paying land costs of %s', (landCost, expected) => {
    const { profile, scenario } = build()
    scenario.costLines.push({ ...scenario.costLines[0]!, id: 'land', category: 'LAND', fixedAmount: landCost } as unknown as LoadedFeasibilityScenario['costLines'][number])
    scenario.cashFlowAllocations.push({ ...scenario.cashFlowAllocations[0]!, id: 'land-allocation', sourceLineId: 'land', amount: landCost } as unknown as LoadedFeasibilityScenario['cashFlowAllocations'][number])
    const result = engine.compute(profile, scenario)
    expect(result.validation.filter((issue) => issue.severity === 'CRITICAL')).toEqual([])
    expect(result.feasibility.status).toBe(expected)
  })

  it('תרחיש הבסיס עקבי: 10,000,000 הכנסה מול 6,000,000 עלות', () => {
    const base = run()
    expect(base.revenue.total).toBe('10000000.00')
    expect(base.costs.total).toBe('6000000.00')
    expect(base.profitability.profit).toBe('4000000.00')
  })

  describe('התייקרות', () => {
    it('מוסיפה שורה נגזרת ומשנה את הרווח', () => {
      const base = run()
      const escalated = run({ escalationRate: '0.05' })
      // ההוצאה נופלת 365 יום אחרי המועד הקובע, ולכן 5% שנתי הם בדיוק 5%.
      expect(lineById(escalated, 'cost-1:escalation')!.amount).toBe('300000.00')
      expect(escalated.costs.total).toBe('6300000.00')
      expect(new Decimal(escalated.profitability.profit).lt(base.profitability.profit)).toBe(true)
    })

    it('משאירה את שורת הבסיס מפויסת מול ההקצאה שהמשתמש הזין', () => {
      const escalated = run({ escalationRate: '0.05' })
      expect(lineById(escalated, 'cost-1')!.amount).toBe('6000000.00')
      expect(codes(escalated)).not.toContain('CASH_FLOW_RECONCILIATION_MISMATCH')
      expect(codes(escalated)).not.toContain('CASH_FLOW_ALLOCATION_MISSING')
    })

    it('נכנסת לתזרים באותו חודש שבו ההוצאה מתרחשת, ולא בסופו', () => {
      const base = run()
      const escalated = run({ escalationRate: '0.05' })
      const month = (result: ReturnType<typeof run>) => result.cashFlow.periods.find((period) => period.periodStart === '2027-01-01')!
      expect(new Decimal(month(escalated).outflows).minus(month(base).outflows).toFixed(2)).toBe('300000.00')
    })

    it('נושאת נוסחה שמצהירה על המועד הקובע ששימש לחישוב', () => {
      const escalated = run({ escalationRate: '0.05' })
      expect(lineById(escalated, 'cost-1:escalation')!.formula).toContain('2026-01-01')
    })
  })

  describe('רזרבה', () => {
    it('מוסיפה אחוז קבוע שאינו תלוי בזמן', () => {
      const withContingency = run({ contingencyRate: '0.1' })
      expect(lineById(withContingency, 'cost-1:contingency')!.amount).toBe('600000.00')
      expect(withContingency.costs.total).toBe('6600000.00')
    })

    it('מצטברת עם התייקרות בלי לבלוע אותה', () => {
      const both = run({ escalationRate: '0.05', contingencyRate: '0.1' })
      expect(lineById(both, 'cost-1:escalation')!.amount).toBe('300000.00')
      expect(lineById(both, 'cost-1:contingency')!.amount).toBe('600000.00')
      expect(both.costs.total).toBe('6900000.00')
    })

    it('מסמנת שיעור שלילי כתקלה קריטית ואינה מחשבת אותו', () => {
      const negative = run({ contingencyRate: '-0.1' })
      expect(codes(negative)).toContain('COST_UPLIFT_RATE_NEGATIVE')
      expect(negative.costs.total).toBe('6000000.00')
    })
  })

  describe('חודשי גרייס', () => {
    it('צובר ריבית לקרן במקום לשלם אותה, ולכן מגדיל את יתרת החוב', () => {
      const noGrace = run({ withDebt: true })
      const grace = run({ withDebt: true, graceMonths: 6 })
      // הריבית עצמה נשארת עלות; מה שמשתנה הוא מתי היא יוצאת במזומן.
      expect(new Decimal(grace.financing.accumulatedInterest).gt(noGrace.financing.accumulatedInterest)).toBe(true)
      expect(new Decimal(grace.financing.peakDebt).gt(noGrace.financing.peakDebt)).toBe(true)
    })

    it('מסמן את החודשים שנצברו בגרייס בנוסחה של שורת הריבית', () => {
      const grace = run({ withDebt: true, graceMonths: 6 })
      const graceLines = grace.costs.lines.filter((line) => line.id.startsWith('interest:') && line.label.includes('גרייס'))
      expect(graceLines).toHaveLength(6)
      expect(graceLines[0]!.formula).toContain('גרייס 6 חודשים')
    })

    it('מדווח על גרייס שהוגדר ללא משיכת חוב במקום ליישם אותו בשקט', () => {
      const orphanGrace = run({ graceMonths: 6, ltc: '0.9' })
      expect(codes(orphanGrace)).toContain('GRACE_WITHOUT_DRAWDOWN')
    })
  })

  describe('LTC ו-LTV כאמות מידה', () => {
    it('מחשב את היחסים בפועל ומדווח על הבסיס שנמדד', () => {
      const measured = run({ withDebt: true, ltc: '0.9', ltv: '0.9' })
      expect(measured.financing.actualLtc).not.toBeNull()
      expect(measured.financing.actualLtv).not.toBeNull()
      expect(measured.financing.measuredDebtBasis).toBe('חוב שיא בתזרים')
    })

    it('חוסם חריגה מ-LTC כתקלה קריטית', () => {
      const breach = run({ withDebt: true, ltc: '0.1' })
      expect(codes(breach)).toContain('LTC_LIMIT_EXCEEDED')
      expect(breach.feasibility.status).toBe('DATA_INCOMPLETE')
    })

    it('חוסם חריגה מ-LTV כתקלה קריטית', () => {
      const breach = run({ withDebt: true, ltv: '0.1' })
      expect(codes(breach)).toContain('LTV_LIMIT_EXCEEDED')
    })

    it('אינו מתריע כאשר החוב בתוך המגבלה', () => {
      const within = run({ withDebt: true, ltc: '0.95', ltv: '0.95' })
      expect(codes(within)).not.toContain('LTC_LIMIT_EXCEEDED')
      expect(codes(within)).not.toContain('LTV_LIMIT_EXCEEDED')
    })

    it('דוחה מגבלה שאינה שבר תקין', () => {
      expect(codes(run({ withDebt: true, ltc: '1.4' }))).toContain('FINANCING_RATIO_LIMIT_INVALID')
    })
  })

  describe('תקופת מימון', () => {
    it('מסמן חוב שנותר פתוח מעבר לתקופה שהוגדרה', () => {
      // משיכה ב-2026-07, פירעון ב-2027-06 — שנים־עשר חודשים בסך הכול.
      const tooShort = run({ withDebt: true, financingMonths: 6 })
      expect(codes(tooShort)).toContain('FINANCING_TERM_EXCEEDED')
      expect(tooShort.financing.financingTermUsedMonths).toBe(12)
    })

    it('אינו מתריע כאשר התקופה מספיקה', () => {
      const enough = run({ withDebt: true, financingMonths: 24 })
      expect(codes(enough)).not.toContain('FINANCING_TERM_EXCEEDED')
    })

    it('מדווח על תקופה שהוגדרה ללא משיכת חוב', () => {
      expect(codes(run({ financingMonths: 12, ltc: '0.9' }))).toContain('FINANCING_TERM_WITHOUT_DRAWDOWN')
    })
  })

  describe('P0-3 — ציר חודשי רציף', () => {
    it('מייצר חודש לכל חודש בין הראשון לאחרון, גם בלי תנועה', () => {
      // הקצאות ב-2027-01 וב-2027-06 בלבד. ארבעת החודשים שביניהם קיימים בזמן.
      const base = run()
      expect(base.cashFlow.periods.map((period) => period.periodStart)).toEqual([
        '2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01', '2027-06-01',
      ])
    })

    it('נמתח על פני מעבר שנה כשיש חוב מוקדם יותר', () => {
      const financed = run({ withDebt: true })
      expect(financed.cashFlow.periods).toHaveLength(12)
      expect(financed.cashFlow.periods[0]!.periodStart).toBe('2026-07-01')
      expect(financed.cashFlow.periods[11]!.periodStart).toBe('2027-06-01')
    })

    it('גובה ריבית בכל חודש שהחוב היה פתוח בו, לא רק בחודשי תנועה', () => {
      const financed = run({ withDebt: true })
      const interestLines = financed.costs.lines.filter((line) => line.id.startsWith('interest:'))
      expect(interestLines).toHaveLength(12)
    })

    it('חודש שקט הוא אפס תנועה ולא קפיצה במצטבר', () => {
      const quiet = run().cashFlow.periods.find((period) => period.periodStart === '2027-03-01')!
      expect(quiet.inflows).toBe('0.00')
      expect(quiet.outflows).toBe('0.00')
      expect(quiet.net).toBe('0.00')
    })
  })

  describe('P0-4 — בסיס התשואה מוצהר ובר־בדיקה', () => {
    it('מצהיר על הבסיס שבו חושבה התשואה במקום להשאיר אותו מרומז', () => {
      expect(run({ withDebt: true }).returns.basis).toBe('PERIODIC_MONTHLY')
    })

    it('מפרסם גם XIRR לפי ימים בפועל, להשוואה מול הגיליון של השמאי', () => {
      const financed = run({ withDebt: true })
      expect(financed.returns.projectXirrAnnual).not.toBeNull()
      // שני הבסיסים מודדים את אותו תזרים ולכן קרובים, אך אינם זהים:
      // חודש קלנדרי אינו 365/12 יום. פער גדול היה מעיד על באג.
      const periodic = new Decimal(financed.returns.projectIrrAnnual!)
      const actualDays = new Decimal(financed.returns.projectXirrAnnual!)
      // ההפרש נמדד יחסית ולא במונחים מוחלטים: בתשואה של מאות אחוזים שלוש
      // נקודות אחוז הן פער זניח, ובתשואה של 8% הן פער מהותי. סף מוחלט היה
      // אומר דברים שונים בשני המקרים.
      expect(periodic.minus(actualDays).abs().div(periodic).lt('0.02')).toBe(true)
    })
  })

  it('כל שדה משנה את התוצאה: אף אחד מהם אינו נבלע', () => {
    const base = JSON.stringify(run({ withDebt: true }))
    const variants: Overrides[] = [
      { withDebt: true, escalationRate: '0.05' },
      { withDebt: true, contingencyRate: '0.1' },
      { withDebt: true, graceMonths: 6 },
      { withDebt: true, financingMonths: 6 },
      { withDebt: true, ltc: '0.1' },
      { withDebt: true, ltv: '0.1' },
    ]
    for (const variant of variants) {
      expect(JSON.stringify(run(variant))).not.toBe(base)
    }
  })
})

/**
 * P0-2 — ניתוח הרגישות.
 *
 * הגרסה הקודמת הכפילה את הפלט הקפוא של חישוב הבסיס. הבדיקות כאן בנויות
 * סביב מקרים שהכפלה כזו *לא יכולה* לתת עליהם תשובה נכונה, ולכן הן נכשלות
 * אם מישהו יחזיר את הקיצור.
 */
describe('P0-2 — רגישות כהרצה מלאה של המנוע', () => {
  const sensitise = (overrides: Overrides, variable: string, changePercent: string) => {
    const { profile, scenario } = build(overrides)
    const factors = new Map([[variable, new Decimal(1).plus(new Decimal(changePercent).div(100))]])
    const adjusted = (engine as unknown as {
      applySensitivityFactors: (p: LoadedFeasibilityProfile, sc: LoadedFeasibilityScenario, f: Map<string, Decimal>) => { profile: LoadedFeasibilityProfile; scenario: LoadedFeasibilityScenario }
    }).applySensitivityFactors(profile, scenario, factors)
    return engine.compute(adjusted.profile, adjusted.scenario)
  }

  it('מזיז עלות אחוזית שבסיסה הכנסה — מה שהכפלת פלט קפוא החמיצה', () => {
    const base = run({ withRevenueLinkedCost: true })
    const raised = sensitise({ withRevenueLinkedCost: true }, 'SALE_PRICE', '10')
    const marketing = (result: ReturnType<typeof run>) => new Decimal(result.costs.lines.find((line) => line.id === 'cost-marketing')!.amount)
    expect(marketing(base).toFixed(2)).toBe('500000.00')
    // 5% מהכנסה שגדלה ב-10% הם 550,000, ולא 500,000 קפואים.
    expect(marketing(raised).toFixed(2)).toBe('550000.00')
  })

  it('מזיז את ההתייקרות יחד עם עלות הבנייה שהיא נגזרת ממנה', () => {
    const raised = sensitise({ escalationRate: '0.05' }, 'CONSTRUCTION_COST', '50')
    // עלות של 9,000,000 שנופלת שנה אחרי המועד הקובע: 5% הם 450,000.
    expect(raised.costs.lines.find((line) => line.id === 'cost-1')!.amount).toBe('9000000.00')
    expect(raised.costs.lines.find((line) => line.id === 'cost-1:escalation')!.amount).toBe('450000.00')
  })

  it('משאיר את התזרים מפויס: ההקצאות זזות עם השורות', () => {
    const raised = sensitise({ withRevenueLinkedCost: true }, 'SALE_PRICE', '10')
    expect(raised.validation.map((issue) => issue.code)).not.toContain('CASH_FLOW_RECONCILIATION_MISMATCH')
    expect(raised.cashFlow.periods.find((period) => period.periodStart === '2027-06-01')!.inflows).toBe('11000000.00')
  })

  it('מחשב ריבית מחדש על היתרות בפועל ולא מכפיל ריבית קפואה', () => {
    const base = run({ withDebt: true })
    const raised = sensitise({ withDebt: true }, 'INTEREST_RATE', '100')
    // הכפלת הריבית מכפילה את עלות המימון, אך גם מזיזה את התזרים ואת
    // דרישת ההון — דבר שהכפלת שדה בודד לא היתה מייצרת.
    expect(new Decimal(raised.financing.accumulatedInterest).div(base.financing.accumulatedInterest).toFixed(4)).toBe('2.0000')
    expect(new Decimal(raised.cashFlow.peakFundingRequirement).gt(base.cashFlow.peakFundingRequirement)).toBe(true)
  })

  it('חושף חריגה מ-LTC שנולדה רק בתרחיש הרגיש', () => {
    // בבסיס החוב בתוך המגבלה. ירידת מחירים מקטינה את ההכנסה, ולכן
    // יחס ה-LTV מזנק — בדיקה שקיימת רק כי המנוע רץ מחדש.
    const base = run({ withDebt: true, ltv: '0.55' })
    const dropped = sensitise({ withDebt: true, ltv: '0.55' }, 'SALE_PRICE', '-40')
    expect(base.validation.map((issue) => issue.code)).not.toContain('LTV_LIMIT_EXCEEDED')
    expect(dropped.validation.map((issue) => issue.code)).toContain('LTV_LIMIT_EXCEEDED')
  })

  it('יכול להפוך את מסקנת הכדאיות, ולא רק את המספר', () => {
    const base = run({ withDebt: true })
    const collapsed = sensitise({ withDebt: true }, 'SALE_PRICE', '-60')
    expect(base.feasibility.status).toBe('FEASIBLE')
    expect(collapsed.feasibility.status).not.toBe('FEASIBLE')
  })

  it('אינו נוגע בשיעורי התייקרות ורזרבה כשמזיזים מחיר', () => {
    const raised = sensitise({ escalationRate: '0.05', contingencyRate: '0.1' }, 'SALE_PRICE', '25')
    expect(raised.costs.lines.find((line) => line.id === 'cost-1:escalation')!.amount).toBe('300000.00')
    expect(raised.costs.lines.find((line) => line.id === 'cost-1:contingency')!.amount).toBe('600000.00')
  })
})
