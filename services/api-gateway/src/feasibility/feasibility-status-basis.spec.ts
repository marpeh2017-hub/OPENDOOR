/**
 * על סמך מה ההכרעה נשענת.
 *
 * `feasibilityStatus` הוא הדבר היחיד במערכת שקורא "כן/לא" בלי הסתייגות.
 * `ה@62k` מוכרז `NOT_FEASIBLE` על סמך מרווח של 15% שהוא הנחת מחקר — לא
 * תקן — ולעסקת קומבינציה אין כלל ברישום בכלל. הסטטוס נשאר נכון תחת ההנחה
 * שנמסרה; `basis` אומר עד כמה היא מבוססת.
 *
 * ── למה הפרובננס נוסע עם הקלט ולא נשאב ────────────────────────────────────
 *
 * סיוג שמתווסף בשכבה שמעל אפשר לדלג עליו: מי שקורא ל-`compute()` ישירות
 * מקבל סטטוס בלי סיוג. זה בדיוק המבנה של הבאגים שתפסנו — `equityAmount`
 * שאי אפשר היה לנקות, ו-`actualLtc` בשמונה ספרות: התשובה נכונה, הנתיב
 * אליה עוקף אותה. כאן הפרובננס הוא שדה על שורת ההנחה, כלומר הוא כבר
 * בקלט הטעון, והמנוע אינו הולך לאיש.
 */
import { FeasibilityCalculationService, type LoadedFeasibilityProfile, type LoadedFeasibilityScenario, type RuleBasis } from './feasibility-calculation.service'

const build = (assumption: Record<string, unknown>) => {
  const profile = {
    id: 'p', valuationDate: new Date('2026-01-01T00:00:00.000Z'),
    parcels: [{ id: 'pa', gush: '1', chelka: '2', landAreaSqm: '500', sourceId: 's', isVerified: true }],
    areas: [{ id: 'a', areaType: 'GROSS', valueSqm: '1000', label: 'g', sourceId: 's', isVerified: true }],
    planningRights: [{ id: 'r', category: 'RESIDENTIAL', status: 'APPROVED', unitCount: 10, sourceId: 's', isVerified: true }],
    comparableTransactions: [],
    assumptions: [{ key: 'annual-discount-rate', value: '0.08' }, { key: 'required-developer-profit-margin', ...assumption }],
    sources: [], scenarios: [] as unknown[],
  } as unknown as LoadedFeasibilityProfile
  const scenario = {
    id: 'sc', name: 'b', kind: 'BASE', isBaseline: true,
    unitMix: [{ id: 'm', label: 'd', disposition: 'DEVELOPER_SALE', unitCount: 10, saleableAreaSqm: '100', pricePerSqm: '20000',
      fixedUnitPrice: null, parkingSpaces: 0, parkingPrice: null, balconyAreaSqm: null, balconyPricePerSqm: null,
      storageAreaSqm: null, storagePricePerSqm: null, sourceId: 's', isVerified: true, replacementAllocations: [] }],
    revenueLines: [],
    costLines: [{ id: 'c1', label: 'b', category: 'CONSTRUCTION', quantity: null, unit: null, unitCost: null,
      fixedAmount: '16000000', percentage: null, percentageBase: null, vatTreatment: 'VAT_EXCLUDED',
      escalationRate: null, contingencyRate: null, sourceId: 's', isVerified: true }],
    compensations: [], cashFlowAllocations: [], financing: null,
  } as unknown as LoadedFeasibilityScenario
  ;(profile as unknown as { scenarios: unknown[] }).scenarios = [scenario]
  return { profile, scenario }
}

const engine = new FeasibilityCalculationService(null as never, null as never, null as never, null as never)
const compute = (assumption: Record<string, unknown>, ruleBasis?: RuleBasis | null) => {
  const { profile, scenario } = build(assumption)
  return engine.compute(profile, scenario, ruleBasis)
}
const UNVERIFIED = { value: '0.15', classification: 'ASSUMPTION', confidence: 'UNKNOWN', isVerified: false, sourceId: null }
const VERIFIED = { value: '0.15', classification: 'FACT', confidence: 'HIGH', isVerified: true, sourceId: 'source-1' }

describe('הסיוג על מסקנת הכדאיות', () => {
  it('ההכרעה עצמה אינה משתנה — הסיוג אומר על סמך מה, לא במקום', () => {
    const plain = compute(UNVERIFIED)
    const withRule = compute(UNVERIFIED, { status: 'MATCHES', verification: 'VERIFIED_AGAINST_SOURCE' })
    expect(plain.feasibility.status).toBe(withRule.feasibility.status)
    expect(plain.profitability.profitOnCost).toBe(withRule.profitability.profitOnCost)
  })

  it('הנחה שלא אומתה מסייגת את ההכרעה', () => {
    const basis = compute(UNVERIFIED).feasibility.basis
    expect(basis.value).toBe('0.15')
    expect(basis.classification).toBe('ASSUMPTION')
    expect(basis.isVerified).toBe(false)
    expect(basis.hasSource).toBe(false)
    expect(basis.qualified).toBe(true)
  })

  it('שני חוסרים שונים, ושני דגלים: הנחה לא מאומתת מול כלל שאינו קיים', () => {
    /*
     * זה המקרה של ה@62k. גם אם ההנחה עצמה אומתה מול מקור, כלל שאינו ממופה
     * ברישום אומר שאין מול מה לאמת — וסיוג שמציג רק את הראשון מטעה.
     */
    const noRule = compute(VERIFIED, { status: 'UNMAPPED', verification: 'NEEDS_VERIFICATION' })
    expect(noRule.feasibility.basis.isVerified).toBe(true)
    expect(noRule.feasibility.basis.ruleStatus).toBe('UNMAPPED')
    expect(noRule.feasibility.basis.qualified).toBe(true)

    // ורק כששניהם עומדים, ההכרעה אינה מסויגת.
    const clean = compute(VERIFIED, { status: 'MATCHES', verification: 'VERIFIED_AGAINST_SOURCE' })
    expect(clean.feasibility.basis.qualified).toBe(false)
  })

  it('מה שלא נמסר מדווח NOT_PROVIDED — ולעולם לא כמאומת', () => {
    const basis = compute(VERIFIED).feasibility.basis
    expect(basis.ruleStatus).toBe('NOT_PROVIDED')
    expect(basis.ruleVerification).toBeNull()
    // הנחה מאומתת לבדה אינה מספיקה: אין ידיעה על הכלל, ולכן הסיוג עומד.
    expect(basis.qualified).toBe(true)
  })

  it('כלל שאומת אך הפרויקט חורג ממנו — עדיין מסויג', () => {
    const basis = compute(VERIFIED, { status: 'OVERRIDES', verification: 'VERIFIED_AGAINST_SOURCE' }).feasibility.basis
    expect(basis.ruleStatus).toBe('OVERRIDES')
    expect(basis.qualified).toBe(true)
  })
})
