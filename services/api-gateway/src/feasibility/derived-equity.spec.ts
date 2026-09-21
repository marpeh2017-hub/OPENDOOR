/**
 * גזירת ההון העצמי.
 *
 * עד לשינוי הזה ההקצאות מסוג EQUITY היו סכום שהוקלד לצד לוח החוב, ולרוב
 * נגזר כשארית — `סך עלויות − חוב` — והוזרם כולו בחודש אחד. התוצאה היתה
 * `equityIrr` שאינו מגיב לשום שינוי בלוח החוב, ותרחישים שרצו חודשים על כסף
 * שאיש לא התחייב לו בלי שאף ולידציה תראה זאת.
 *
 * הכלל כאן הוא זה שהמלווה באמת דורש: היתרה המצטברת לעולם אינה יורדת מתחת
 * לרצפה. ההון נכנס בחודש שבו הוא נדרש ובסכום שנדרש, והעודף שמעל הרצפה
 * בסוף מחולק. לכן לוח שמושך יותר חוב, או מושך אותו מוקדם יותר, דורש פחות
 * הון ומאוחר יותר — וה-IRR ההוני זז.
 *
 * התרחיש: 20M הכנסה ב-2028-06 מול 16M עלות ב-2027-01, משיכה ב-2027-01
 * ופירעון ב-2028-06, ריבית 6.5% עם 12 חודשי גרייס.
 */
import { FeasibilityCalculationService, type LoadedFeasibilityProfile, type LoadedFeasibilityScenario } from './feasibility-calculation.service'

const COST = '2027-01-01'
const REVENUE = '2028-06-01'

const build = (options: { draw?: string; equitySource?: string; equityBalanceFloor?: string; explicitEquity?: string } = {}) => {
  const profile = {
    id: 'profile-1', valuationDate: new Date('2026-01-01T00:00:00.000Z'),
    parcels: [{ id: 'parcel-1', gush: '1', chelka: '2', landAreaSqm: '500', sourceId: 's', isVerified: true }],
    areas: [{ id: 'area-1', areaType: 'GROSS', valueSqm: '1000', label: 'ברוטו', sourceId: 's', isVerified: true }],
    planningRights: [{ id: 'r', category: 'RESIDENTIAL', status: 'APPROVED', unitCount: 10, sourceId: 's', isVerified: true }],
    comparableTransactions: [],
    assumptions: [{ key: 'annual-discount-rate', value: '0.08' }, { key: 'required-developer-profit-margin', value: '0.15' }],
    sources: [], scenarios: [] as unknown[],
  } as unknown as LoadedFeasibilityProfile

  const draw = options.draw ?? '9000000'
  const al = (id: string, kind: string, direction: string, period: string, value: string, sourceLineId: string | null = null) =>
    ({ id, sourceKind: kind, direction, periodStart: new Date(`${period}T00:00:00.000Z`), amount: value, sourceLineId })

  const scenario = {
    id: 'scenario-1', name: 'בסיס', kind: 'BASE', isBaseline: true,
    unitMix: [{
      id: 'mix-1', label: 'דירות', disposition: 'DEVELOPER_SALE', unitCount: 10,
      saleableAreaSqm: '100', pricePerSqm: '20000', fixedUnitPrice: null, parkingSpaces: 0, parkingPrice: null,
      balconyAreaSqm: null, balconyPricePerSqm: null, storageAreaSqm: null, storagePricePerSqm: null,
      sourceId: 's', isVerified: true, replacementAllocations: [],
    }],
    revenueLines: [],
    costLines: [{
      id: 'cost-1', label: 'בנייה', category: 'CONSTRUCTION', quantity: null, unit: null, unitCost: null,
      fixedAmount: '16000000', percentage: null, percentageBase: null, vatTreatment: 'VAT_EXCLUDED',
      escalationRate: null, contingencyRate: null, sourceId: 's', isVerified: true,
    }],
    compensations: [],
    cashFlowAllocations: [
      al('alloc-cost', 'COST', 'OUTFLOW', COST, '16000000', 'cost-1'),
      al('alloc-revenue', 'REVENUE', 'INFLOW', REVENUE, '20000000', 'mix-1'),
      al('alloc-draw', 'DEBT', 'INFLOW', COST, draw),
      al('alloc-repay', 'DEBT', 'OUTFLOW', REVENUE, draw),
      ...(options.explicitEquity ? [al('alloc-equity-in', 'EQUITY', 'INFLOW', COST, options.explicitEquity), al('alloc-equity-out', 'EQUITY', 'OUTFLOW', REVENUE, options.explicitEquity)] : []),
    ],
    financing: {
      annualInterestRate: '0.065', graceMonths: 12, ltc: '0.6',
      /*
       * Left unset unless the test asks for an override — so these tests run
       * against the engine's DEFAULT, not against a flag the fixture turned
       * on. A default that has to be typed into every fixture is not a
       * default, and the "derived" behaviour could go back to being opt-in
       * without a single test noticing.
       */
      ...(options.equitySource ? { equitySource: options.equitySource } : {}),
      equityBalanceFloor: options.equityBalanceFloor ?? null,
    },
  } as unknown as LoadedFeasibilityScenario

  ;(profile as unknown as { scenarios: unknown[] }).scenarios = [scenario]
  return { profile, scenario }
}

const compute = (options?: Parameters<typeof build>[0]) => {
  const { profile, scenario } = build(options)
  return new FeasibilityCalculationService(null as never, null as never, null as never).compute(profile, scenario)
}

describe('גזירת ההון העצמי מפער המימון', () => {
  it('ההון נכנס בחודש שבו הכסף נגמר ובסכום שחסר — לא כשארית שהוקלדה', () => {
    const result = compute()
    /*
     * 16M עלות מול 9M משיכה באותו חודש: 7M נכנסים מיד. הסכום הכולל גדול
     * מזה, וזה נכון — אחרי הגרייס הריבית משולמת חודשית ומעמיקה את החור עוד
     * קצת בכל חודש. הבדיקה היא על הזהות ולא על מספר עגול שנוח לי: ההון
     * שהוזרם שווה בדיוק לחור המצטבר שהמנוע מדד.
     */
    const first = result.cashFlow.periods.find((period) => period.periodStart === COST)!
    expect(Number(first.inflows)).toBeCloseTo(9_000_000 + 7_000_000, 2)
    expect(Number(result.returns.equityInvested)).toBeGreaterThanOrEqual(7_000_000)
    expect(Number(result.returns.equityInvested)).toBeCloseTo(Number(result.cashFlow.peakEquityRequirement), 2)
    // והכלל עצמו: אף חודש אינו יורד מתחת לרצפה.
    for (const period of result.cashFlow.periods) expect(Number(period.cumulative)).toBeGreaterThanOrEqual(-0.01)
  })

  it('העודף שמעל הרצפה בסוף מחולק — אחרת אין לתזרים ההוני רגל חיובית ואין IRR', () => {
    const result = compute()
    expect(Number(result.returns.equityDistributed)).toBeGreaterThan(Number(result.returns.equityInvested))
    expect(result.returns.equityIrrAnnual).not.toBeNull()
    const last = result.cashFlow.periods[result.cashFlow.periods.length - 1]!
    expect(Number(last.cumulative)).toBeCloseTo(0, 2)
  })

  it('‏equityIrr מגיב ללוח החוב: שלוש משיכות — שלושה ערכים שונים, ובכיוון שניתן להסבר', () => {
    /*
     * זו הבדיקה שהפער הזה נפתח בגללה. אותו תרחיש בדיוק, שלוש משיכות שונות.
     * יותר חוב = פחות הון עצמי מול אותו רווח (בניכוי הריבית הנוספת), ולכן
     * IRR הוני גבוה יותר. מינוף.
     */
    const low = compute({ draw: '6000000' })
    const mid = compute({ draw: '9000000' })
    const high = compute({ draw: '12000000' })
    const irr = [low, mid, high].map((r) => Number(r.returns.equityIrrAnnual))
    const equity = [low, mid, high].map((r) => Number(r.returns.equityInvested))

    expect(new Set(irr).size).toBe(3)
    expect(equity[0]).toBeGreaterThan(equity[1]!)
    expect(equity[1]).toBeGreaterThan(equity[2]!)
    expect(irr[0]).toBeLessThan(irr[1]!)
    expect(irr[1]).toBeLessThan(irr[2]!)
  })

  it('נכשל אם ההון חוזר להיות סכום קבוע: הקצאה ידנית קפואה אינה זזה בין הלוחות', () => {
    /*
     * ההוכחה השלילית. אותן שלוש משיכות, אבל עם הקצאה ידנית — וה-IRR ההוני
     * זהה בשלושתן. זה בדיוק המצב שהיה קודם, והוא נשמר כאן כדי שיהיה מתועד
     * מה בדיוק נשבר אם מישהו יחזיר אותו כברירת מחדל.
     */
    const explicit = { equitySource: 'EXPLICIT_ALLOCATIONS', explicitEquity: '7000000' }
    const irr = ['6000000', '9000000', '12000000'].map((draw) => compute({ ...explicit, draw }).returns.equityIrrAnnual)
    expect(new Set(irr).size).toBe(1)

    // ואותן משיכות בדיוק, בברירת המחדל הגזורה, נותנות שלושה ערכים.
    const derived = ['6000000', '9000000', '12000000'].map((draw) => compute({ draw }).returns.equityIrrAnnual)
    expect(new Set(derived).size).toBe(3)
  })

  it('הרצפה היא פרמטר ולא אפס קשיח, וההון גדל בדיוק בגובהה', () => {
    const atZero = compute()
    const atFloor = compute({ equityBalanceFloor: '500000' })
    expect(Number(atFloor.returns.equityInvested)).toBeCloseTo(Number(atZero.returns.equityInvested) + 500_000, 2)
    for (const period of atFloor.cashFlow.periods) expect(Number(period.cumulative)).toBeGreaterThanOrEqual(500_000 - 0.01)
  })

  it('שתי כמויות, שני שדות: שם קיים אינו משנה משמעות מתחת לקורא', () => {
    /*
     * `peakFundingRequirement` נשאר מה שתמיד היה — מה שנותר לא ממומן אחרי
     * כל המקורות — ולכן תחת גזירה הוא אפס, והאפס הזה הוא האמירה שהתוכנית
     * ממומנת. הכמות החדשה קיבלה שם משלה. אחרת קורא שמכיר את השדה הישן היה
     * קורא מספר חדש בכללים הישנים, בלי שום דרך לדעת.
     */
    const result = compute()
    expect(Number(result.cashFlow.peakEquityRequirement)).toBeGreaterThan(7_000_000)
    expect(Number(result.cashFlow.peakEquityRequirement)).toBeCloseTo(Number(result.returns.equityInvested), 2)
    expect(Number(result.cashFlow.peakFundingRequirement)).toBeCloseTo(0, 2)
    // צורך ההון עצמאי מהרצפה, ומה שנותר לא ממומן נשאר אפס בשתיהן.
    const withFloor = compute({ equityBalanceFloor: '500000' })
    expect(withFloor.cashFlow.peakEquityRequirement).toBe(result.cashFlow.peakEquityRequirement)
    expect(Number(withFloor.cashFlow.peakFundingRequirement)).toBeCloseTo(0, 2)
    for (const period of result.cashFlow.periods) expect(Number(period.cumulative)).toBeGreaterThanOrEqual(-0.01)
  })

  it('בהקצאה ידנית השתיים אינן ניתנות להפרדה, ולכן צורך ההון מדווח כלא-זמין ולא כמספר', () => {
    const explicit = compute({ equitySource: 'EXPLICIT_ALLOCATIONS', explicitEquity: '7000000' })
    expect(explicit.cashFlow.peakEquityRequirement).toBeNull()
    // והשדה הישן שומר בדיוק על משמעותו: החור שנשאר אחרי ההון שהוקלד.
    expect(Number(explicit.cashFlow.peakFundingRequirement)).toBeGreaterThan(0)
  })

  it('תשואת הפרויקט אינה מושפעת: ההון הוא מימון, לא רווח', () => {
    const derived = compute()
    const explicit = compute({ equitySource: 'EXPLICIT_ALLOCATIONS', explicitEquity: '7000000' })
    expect(derived.profitability.profit).toBe(explicit.profitability.profit)
    expect(derived.profitability.profitOnCost).toBe(explicit.profitability.profitOnCost)
    expect(derived.costs.total).toBe(explicit.costs.total)
    expect(derived.returns.projectIrrAnnual).toBe(explicit.returns.projectIrrAnnual)
  })
})
