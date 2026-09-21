/**
 * P1-7 — Monte Carlo.
 *
 * הבדיקה המרכזית כאן אינה "רץ בלי לקרוס" אלא ששלוש טענות מתקיימות בפועל:
 * שהדגימה באמת אקראית ולא מריצה את הבסיס אלף פעם, שסדר האחוזונים הגיוני,
 * ושהזמן בפועל נמדד ולא מונח.
 *
 * התרחיש: 20 יח״ד × 100 מ״ר × 30,000 ₪ למ״ר = 60,000,000 ₪ הכנסה מול
 * 50,000,000 ₪ עלות — רווח על עלות 0.20 בבסיס. מספרים עגולים בכוונה, כדי
 * שהחציון של דגימה סימטרית יהיה ניתן להשוואה מול ערך ידוע.
 */
import { FeasibilityCalculationService, type LoadedFeasibilityProfile, type LoadedFeasibilityScenario } from './feasibility-calculation.service'
import type { CreateMonteCarloDto } from './dto/feasibility-foundation.dto'

/**
 * `withCashFlow` is the expensive axis, not the number of lines.
 *
 * A scenario with dated cash-flow allocations makes every engine run solve
 * XIRR, which costs some two orders of magnitude more than the rest of the
 * calculation put together. The fixture defaults to the cheap shape and opts
 * into the dear one, so the performance tests below measure both rather than
 * quoting one and implying the other.
 */
const build = (options: { withFinancing?: boolean; withCashFlow?: boolean; mixLines?: number; costLines?: number } = {}) => {
  const profile = {
    id: 'profile-1',
    valuationDate: new Date('2026-01-01T00:00:00.000Z'),
    parcels: [{ id: 'parcel-1', gush: '1234', chelka: '56', landAreaSqm: '500', sourceId: 'source-1', isVerified: true }],
    areas: [{ id: 'area-1', areaType: 'GROSS', valueSqm: '1000', label: 'ברוטו', sourceId: 'source-1', isVerified: true }],
    planningRights: [{ id: 'right-1', category: 'RESIDENTIAL', status: 'APPROVED', unitCount: 20, sourceId: 'source-1', isVerified: true }],
    comparableTransactions: [],
    assumptions: [{ key: 'annual-discount-rate', value: '0.08' }, { key: 'required-developer-profit-margin', value: '0.15' }],
    sources: [],
    scenarios: [] as unknown[],
  } as unknown as LoadedFeasibilityProfile

  const mixCount = options.mixLines ?? 1
  const unitMix = Array.from({ length: mixCount }, (unused, index) => ({
    id: `mix-${index}`, label: `דירות ${index}`, disposition: 'DEVELOPER_SALE',
    unitCount: 20 / mixCount, saleableAreaSqm: '100', pricePerSqm: '30000', fixedUnitPrice: null,
    parkingSpaces: 0, parkingPrice: null, balconyAreaSqm: null, balconyPricePerSqm: null,
    storageAreaSqm: null, storagePricePerSqm: null, sourceId: 'source-1', isVerified: true,
    replacementAllocations: [],
  }))

  const costCount = options.costLines ?? 1
  const costLines = [
    ...Array.from({ length: costCount }, (unused, index) => ({
      id: `cost-${index}`, label: `בנייה ${index}`, category: 'CONSTRUCTION', quantity: null, unit: null, unitCost: null,
      fixedAmount: String(40000000 / costCount), percentage: null, percentageBase: null,
      vatTreatment: 'VAT_EXCLUDED', escalationRate: '0.03', contingencyRate: '0.05',
      sourceId: 'source-1', isVerified: true,
    })),
    { id: 'cost-land', label: 'קרקע', category: 'LAND', quantity: null, unit: null, unitCost: null,
      fixedAmount: '10000000', percentage: null, percentageBase: null, vatTreatment: 'VAT_EXCLUDED',
      escalationRate: null, contingencyRate: null, sourceId: 'source-1', isVerified: true },
  ]

  const scenario = {
    id: 'scenario-1', name: 'בסיס', kind: 'BASE', isBaseline: true,
    unitMix, revenueLines: [], costLines, compensations: [],
    cashFlowAllocations: options.withCashFlow === true ? [
      { id: 'a-cost', periodStart: new Date('2026-06-01T00:00:00.000Z'), direction: 'OUTFLOW', sourceKind: 'COST', sourceLineId: 'cost-0', amount: '40000000' },
      { id: 'a-land', periodStart: new Date('2026-01-01T00:00:00.000Z'), direction: 'OUTFLOW', sourceKind: 'COST', sourceLineId: 'cost-land', amount: '10000000' },
      { id: 'a-rev', periodStart: new Date('2028-01-01T00:00:00.000Z'), direction: 'INFLOW', sourceKind: 'REVENUE', sourceLineId: 'mix-0', amount: '60000000' },
      { id: 'a-eq-in', periodStart: new Date('2026-01-01T00:00:00.000Z'), direction: 'OUTFLOW', sourceKind: 'EQUITY', sourceLineId: null, amount: '20000000' },
      { id: 'a-eq-out', periodStart: new Date('2028-01-01T00:00:00.000Z'), direction: 'INFLOW', sourceKind: 'EQUITY', sourceLineId: null, amount: '30000000' },
      // משיכת החוב ופירעונו. בלעדיהן אין לוח חוב, ולכן ריבית נצברת היא
      // אפס יהיה השיעור אשר יהיה — ודגימת ריבית לא הייתה מזיזה דבר.
      { id: 'a-draw', periodStart: new Date('2026-06-01T00:00:00.000Z'), direction: 'INFLOW', sourceKind: 'DEBT', sourceLineId: null, amount: '30000000' },
      { id: 'a-repay', periodStart: new Date('2028-01-01T00:00:00.000Z'), direction: 'OUTFLOW', sourceKind: 'DEBT', sourceLineId: null, amount: '30000000' },
    ] : [],
    financing: options.withFinancing === false ? null : {
      id: 'financing-1', debtAmount: '30000000', equityAmount: '20000000', ltc: null, ltv: null,
      annualInterestRate: '0.06', arrangementFeeRate: null, guaranteeFeeRate: null,
      graceMonths: 12, financingMonths: 24,
    },
  } as unknown as LoadedFeasibilityScenario

  ;(profile as unknown as { scenarios: unknown[] }).scenarios = [scenario]
  return { profile, scenario }
}

const engineFor = (profile: LoadedFeasibilityProfile) =>
  new FeasibilityCalculationService({ find: async () => profile } as never, null as never, null as never)

const run = (dto: CreateMonteCarloDto, options?: Parameters<typeof build>[0]) => {
  const { profile, scenario } = build(options)
  return engineFor(profile).monteCarlo('project-1', scenario.id, dto, 'tenant-1')
}

/** The summary shape is the same whether or not the metric was available. */
type Stats = {
  available: boolean; samples: number; undefinedRuns: number
  p10: number | null; p50: number | null; p90: number | null
  mean: number | null; stdDev: number | null; min: number | null; max: number | null
  probabilityOfLoss: number | null; histogram: Array<{ from: number | null; to: number | null; count: number }>
}
const stats = (result: { metrics: Record<string, unknown> }, metric = 'profitOnCost') => result.metrics[metric] as Stats

const PRICE_AND_COST: CreateMonteCarloDto['variables'] = [
  { field: 'pricePerSqm', distribution: 'normal', stdDevPct: '0.10' },
  { field: 'constructionCost', distribution: 'normal', stdDevPct: '0.15' },
]

describe('P1-7 — Monte Carlo', () => {
  it('מחזיר P10 < P50 < P90, ופילוג אמיתי — לא אלף עותקים של הבסיס', async () => {
    const result = await run({ runs: 1000, seed: 42, variables: PRICE_AND_COST })
    const poc = stats(result)

    expect(result.runs).toBe(1000)
    expect(poc.samples).toBe(1000)
    expect(poc.p10).toBeLessThan(poc.p50!)
    expect(poc.p50).toBeLessThan(poc.p90!)

    // ההוכחה שהדגימה עובדת: אילו המנוע היה רץ על הבסיס אלף פעם, סטיית
    // התקן הייתה 0 וכל האחוזונים היו זהים. גם ספירת הערכים הייחודיים
    // הייתה 1. שניהם נבדקים, כי כל אחד מהם לבדו ניתן לזיוף.
    expect(poc.stdDev).toBeGreaterThan(0.01)
    expect(poc.p90! - poc.p10!).toBeGreaterThan(0.05)
    expect(poc.min).toBeLessThan(0.20)
    expect(poc.max).toBeGreaterThan(0.20)

    // וההיסטוגרמה מכסה את כל הדגימות בדיוק — אין ערך שנפל בין הדליים.
    expect(poc.histogram).toHaveLength(20)
    expect(poc.histogram.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1000)
  })

  it('קלט סימטרי סביב הבסיס מייצר פילוג שממורכז על הבסיס — ולא מוטה', async () => {
    // רק המחיר נדגם, נורמלית סביב מקדם 1. החציון חייב לנחות על 0.20 של
    // הבסיס, והזנבות להיות סימטריים בערך סביבו.
    const runs = 10000
    const result = await run({ runs, seed: 7, variables: [{ field: 'pricePerSqm', distribution: 'normal', stdDevPct: '0.10' }] })
    const poc = stats(result)

    expect(Number(result.baseCase.profitOnCost)).toBeCloseTo(0.20, 6)

    /*
     * The tolerance is derived, not chosen. profit-on-cost is linear in the
     * price factor here (60m·f − 50m)/50m, so a 10% spread on the factor is a
     * 0.12 standard deviation on the metric. The standard error of a sample
     * mean is σ/√n; of a sample MEDIAN it is 1.253σ/√n. Four of those is a
     * bound a correct sampler clears essentially always and a biased one does
     * not — where a round number like 0.005 would have failed this very test
     * on a correct sampler, purely because 10,000 draws is 10,000 draws.
     */
    const sigma = 1.2 * 0.10
    const meanError = 4 * sigma / Math.sqrt(runs)
    const medianError = 4 * 1.253 * sigma / Math.sqrt(runs)
    expect(Math.abs(poc.mean! - 0.20)).toBeLessThan(meanError)
    expect(Math.abs(poc.p50! - 0.20)).toBeLessThan(medianError)

    // וסימטריה: הזנב התחתון והעליון באותו אורך בערך, כי הקלט סימטרי.
    const lower = poc.p50! - poc.p10!
    const upper = poc.p90! - poc.p50!
    expect(Math.abs(upper - lower) / lower).toBeLessThan(0.05)
    // ובאמת נדגם מה שנטען שנדגם.
    expect(result.variables[0]!.unit).toBe('FACTOR_OF_BASE')
    expect(result.variables[0]!.drawnMean).toBeCloseTo(1, 1)
    expect(result.clampedDraws).toBe(0)
  })

  it('אותו seed מחזיר בדיוק אותה תוצאה, ו-seed אחר מחזיר תוצאה אחרת', async () => {
    const a = await run({ runs: 500, seed: 99, variables: PRICE_AND_COST })
    const b = await run({ runs: 500, seed: 99, variables: PRICE_AND_COST })
    const c = await run({ runs: 500, seed: 100, variables: PRICE_AND_COST })
    expect(b.metrics.profitOnCost).toEqual(a.metrics.profitOnCost)
    expect(c.metrics.profitOnCost).not.toEqual(a.metrics.profitOnCost)
    // seed שלא נמסר מוחזר, אחרת אי אפשר לשחזר הרצה שצוטטה בדוח.
    const unseeded = await run({ runs: 100, variables: PRICE_AND_COST })
    expect(unseeded.seed).toBeGreaterThan(0)
  })

  it('1,000 הרצות מסתיימות הרבה מתחת ל-10 שניות — והזמן נמדד, לא מונח', async () => {
    const started = Date.now()
    const result = await run({ runs: 1000, seed: 5, variables: PRICE_AND_COST }, { mixLines: 4, costLines: 6 })
    const wallClock = Date.now() - started

    // eslint-disable-next-line no-console
    console.log(`[perf] 1,000 runs, no dated cash flow — engine ${result.elapsedMs}ms (${result.msPerRun}ms/run), wall clock ${wallClock}ms`)
    expect(result.elapsedMs).toBeLessThan(10000)
    expect(wallClock).toBeLessThan(10000)
    expect(result.msPerRun).toBeGreaterThan(0)
  }, 30000)

  it('גבול 10,000 הרצות אינו קורס ואינו נתקע', async () => {
    const started = Date.now()
    const result = await run({ runs: 10000, seed: 11, variables: PRICE_AND_COST }, { mixLines: 4, costLines: 6 })
    const wallClock = Date.now() - started

    // eslint-disable-next-line no-console
    console.log(`[perf] 10,000 runs, no dated cash flow — engine ${result.elapsedMs}ms (${result.msPerRun}ms/run), wall clock ${wallClock}ms`)
    const poc = stats(result)
    expect(poc.samples).toBe(10000)
    expect(poc.p10).toBeLessThan(poc.p90!)
    expect(wallClock).toBeLessThan(30000)
  }, 120000)

  /**
   * The scenario that does NOT fit the target, measured rather than assumed.
   *
   * With dated cash-flow allocations every run solves XIRR, and one run costs
   * tens of milliseconds instead of a fifth of one. The guard refuses up front
   * and says what it measured; the alternative would be an HTTP request that
   * runs for half a minute and is cut off by a proxy with nothing to show.
   */
  it('מסרב מראש להרצה שלא תספיק בזמן — ומוסר את העלות שמדד, לא הערכה', async () => {
    const { profile, scenario } = build({ withCashFlow: true })
    const engine = engineFor(profile)

    const started = Date.now()
    engine.compute(profile, scenario)
    const oneRun = Date.now() - started
    // eslint-disable-next-line no-console
    console.log(`[perf] one compute() WITH dated cash flow: ${oneRun}ms => 1,000 runs would be ~${(oneRun * 1000 / 1000).toFixed(0)}s`)
    expect(oneRun).toBeGreaterThan(5)

    await expect(engine.monteCarlo('project-1', scenario.id, { runs: 1000, seed: 1, variables: PRICE_AND_COST }, 'tenant-1'))
      .rejects.toMatchObject({ details: [{ code: 'FEASIBILITY_MONTE_CARLO_BUDGET_EXCEEDED' }] })

    /*
     * ומה שכן נכנס בתקציב — רץ, ומחזיר גם את מדדי ה-IRR שרק לתזרים מתוארך
     * יש. 50 ולא 100: מאז שההון נגזר מהתזרים, כל הרצה פותרת גם XIRR הוני,
     * ו-100 הרצות נוחתות בדיוק על גבול התקציב של 15 שניות — כך שהשומר סירב
     * להן תחת עומס. הספירה זזה כדי שהבדיקה תמדוד את מה שהיא מתיימרת למדוד;
     * התקציב עצמו לא זז.
     */
    const small = await engine.monteCarlo('project-1', scenario.id, { runs: 50, seed: 1, variables: PRICE_AND_COST }, 'tenant-1')
    // eslint-disable-next-line no-console
    console.log(`[perf] 50 runs WITH dated cash flow — engine ${small.elapsedMs}ms (${small.msPerRun}ms/run)`)
    expect(stats(small, 'projectIrrAnnual').available).toBe(true)
    expect(stats(small, 'equityIrrAnnual').available).toBe(true)
    expect(stats(small, 'projectIrrAnnual').p10).toBeLessThan(stats(small, 'projectIrrAnnual').p90!)
  }, 120000)

  it('מדווח מדד שאינו קיים כלא-זמין, במקום כפילוג של כלום', async () => {
    const result = await run({ runs: 200, seed: 8, variables: PRICE_AND_COST })
    // בלי תזרים מתוארך אין IRR כלל — וזה מדווח ככה, לא כאפס.
    const irr = stats(result, 'projectIrrAnnual')
    expect(irr.available).toBe(false)
    expect(irr.samples).toBe(0)
    expect(irr.p50).toBeNull()
    expect(irr.undefinedRuns).toBe(200)
    expect(stats(result).available).toBe(true)
  })

  it('דוגם ריבית ומשך מימון, ומדווח את משך המימון בחודשים ולא כמקדם', async () => {
    // עם תזרים מתוארך דווקא: ריבית נצברת נגזרת מלוח המשיכות, ולכן בלי
    // תזרים שינוי בריבית אינו מזיז דבר — וזו התנהגות נכונה, לא באג.
    /*
     * 80 runs and not 200: with equity derived from the cash flow every
     * scenario now has a real dated equity flow, so equity XIRR runs on every
     * draw where it used to be skipped for want of any equity movement. That
     * roughly doubled the cost of a dated run, and the budget guard says so
     * rather than quietly taking half a minute. The count moved; the guard
     * did not.
     */
    const result = await run({
      runs: 80, seed: 3,
      variables: [
        { field: 'interestRate', distribution: 'normal', stdDevPct: '0.20' },
        { field: 'financingMonths', distribution: 'triangular', min: '18', mostLikely: '24', max: '36' },
      ],
    }, { withCashFlow: true })
    const months = result.variables.find((variable) => variable.field === 'financingMonths')!
    expect(months.unit).toBe('MONTHS')
    expect(months.drawnMin).toBeGreaterThanOrEqual(18)
    expect(months.drawnMax).toBeLessThanOrEqual(36)
    // המצב השכיח הוא 24, ולכן הממוצע של משולשת 18/24/36 הוא 26 — לא 27
    // (אמצע הטווח). ההבדל הזה הוא בדיוק מה שמבדיל משולשת מאחידה.
    expect(months.drawnMean).toBeCloseTo(26, 0)
    expect(stats(result).stdDev).toBeGreaterThan(0)
    expect(stats(result).p10).toBeLessThan(stats(result).p90!)
  })

  it('מסרב לדגום מנוף שאינו קיים בתרחיש במקום להחזיר פילוג צר יותר בשקט', async () => {
    await expect(run({ runs: 100, seed: 1, variables: [{ field: 'financingMonths', distribution: 'triangular', min: '18', mostLikely: '24', max: '36' }] }, { withFinancing: false, withCashFlow: true }))
      .rejects.toMatchObject({ details: [{ code: 'FEASIBILITY_MONTE_CARLO_VARIABLE_NOT_APPLICABLE' }] })
  })

  it('מסרב לפרמטרים שאינם מתארים פילוג', async () => {
    await expect(run({ runs: 100, seed: 1, variables: [{ field: 'pricePerSqm', distribution: 'normal', stdDevPct: '0' }] }))
      .rejects.toMatchObject({ details: [{ code: 'FEASIBILITY_MONTE_CARLO_PARAMS_INVALID' }] })
    await expect(run({ runs: 100, seed: 1, variables: [{ field: 'pricePerSqm', distribution: 'triangular', min: '0.9', mostLikely: '1.5', max: '1.2' }] }))
      .rejects.toMatchObject({ details: [{ code: 'FEASIBILITY_MONTE_CARLO_PARAMS_INVALID' }] })
    await expect(run({ runs: 100, seed: 1, variables: [
      { field: 'pricePerSqm', distribution: 'normal', stdDevPct: '0.1' },
      { field: 'pricePerSqm', distribution: 'normal', stdDevPct: '0.2' },
    ] })).rejects.toMatchObject({ details: [{ code: 'FEASIBILITY_MONTE_CARLO_DUPLICATE_VARIABLE' }] })
  })

  it('מדווח הסתברות להפסד, ובתרחיש רעוע היא אינה אפס', async () => {
    const steady = await run({ runs: 2000, seed: 21, variables: [{ field: 'pricePerSqm', distribution: 'normal', stdDevPct: '0.05' }] })
    const shaky = await run({ runs: 2000, seed: 21, variables: [{ field: 'pricePerSqm', distribution: 'normal', stdDevPct: '0.25' }] })

    // ברווח על עלות של 0.20 בבסיס, סטייה של 5% במחיר כמעט אינה מגיעה
    // להפסד; סטייה של 25% כן. ההפרש הוא המדד עצמו, לא מספר שרירותי.
    expect(stats(steady).probabilityOfLoss).toBeLessThan(0.01)
    expect(stats(shaky).probabilityOfLoss).toBeGreaterThan(0.05)
  })
})
