import { Injectable } from '@nestjs/common'
import Decimal from 'decimal.js'
import { DomainError } from '../common/errors/domain-error'
import { computeEquityWaterfall, type EquityFlow, type EquityTrancheTerms } from './equity-waterfall'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { PrismaService } from '../prisma.service'
import { annualizeMonthlyRate, averageMonthlyDebtInterest, continuousMonthlyPeriodAxis, daysBetween, irr, isUniformMonthlyAxis, monthlyPeriodDistance, monthlyRateFromAnnual, npv, xirr, xnpv } from './financial-math'
import type { CreateFeasibilitySnapshotDto, CreateGoalSeekDto, SolveFinancingDto,
  CreateMonteCarloDto,
  MonteCarloVariableDto, CreateSensitivityDto } from './dto/feasibility-foundation.dto'
import { FeasibilityService } from './feasibility.service'
import { type ReplacementAllocation, replacementAllocationSummary } from './replacement-allocation'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })


type Severity = 'CRITICAL' | 'WARNING' | 'INFO'
type ValidationIssue = { code: string; severity: Severity; message: string; entityId?: string }
type CalculationLine = { id: string; label: string; category: string; amount: string; formula: string }
type CashFlowPeriod = { periodStart: string; inflows: string; outflows: string; net: string; cumulative: string }

function amount(value: Decimal.Value) { return new Decimal(value).toFixed(2) }
function read(value: { toString(): string } | null | undefined) { return new Decimal(value?.toString() ?? '0') }

/** צורת הקלט הטעון, נגזרת מהשירות עצמו כדי שלא תוכל להיפרד ממנו בשקט. */
export type LoadedFeasibilityProfile = NonNullable<Awaited<ReturnType<FeasibilityService['find']>>>
export type LoadedFeasibilityScenario = LoadedFeasibilityProfile['scenarios'][number]

/**
 * Authoritative calculation layer. It receives only normalised Prisma values,
 * uses Decimal throughout, and returns a traceable result rather than saving a
 * calculated value back into an input table. Snapshot/version persistence is a
 * later phase.
 */
@Injectable()
export class FeasibilityCalculationService {
  constructor(private readonly feasibility: FeasibilityService, private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /**
   * טוען פרופיל ותרחיש פעם אחת. מופרד מ-`compute` כדי שניתוח הרגישות
   * יוכל להריץ את אותו מנוע בדיוק על קלט מותאם, בלי לגעת שוב במסד.
   */
  private async load(projectId: string, scenarioId: string, tenantId: string) {
    const profile = await this.feasibility.find(projectId, tenantId)
    if (!profile) throw DomainError.notFound('FEASIBILITY_PROFILE_NOT_FOUND', 'לא קיים עדיין פרופיל דוח אפס לפרויקט')
    const scenario = profile.scenarios.find((row) => row.id === scenarioId)
    if (!scenario) throw DomainError.notFound('FEASIBILITY_SCENARIO_NOT_FOUND', 'התרחיש לא נמצא בפרויקט')
    return { profile, scenario }
  }

  async calculate(projectId: string, scenarioId: string, tenantId: string) {
    const { profile, scenario } = await this.load(projectId, scenarioId, tenantId)
    return this.compute(profile, scenario)
  }

  /**
   * המנוע עצמו. פונקציה טהורה מעל קלט טעון: אין בה גישה למסד ואין בה
   * תלות ב-`projectId`. זו הנקודה שמאפשרת לרגישות להיות הרצה אמיתית
   * ולא הכפלה של תוצאה קפואה.
   */
  compute(profile: LoadedFeasibilityProfile, scenario: LoadedFeasibilityScenario) {
    const issues: ValidationIssue[] = []
    const revenue: CalculationLine[] = []
    const costs: CalculationLine[] = []

    // A draft may be incomplete, but an approved report cannot silently turn
    // missing fundamental evidence into a plausible-looking calculation.
    if (!profile.parcels.some((parcel) => read(parcel.landAreaSqm).gt(0))) {
      issues.push({ code: 'LAND_AREA_MISSING', severity: 'CRITICAL', message: 'חסר שטח חלקה מאומת לפחות עבור גוש/חלקה אחד.' })
    }
    if (profile.planningRights.length === 0) {
      issues.push({ code: 'PLANNING_RIGHTS_MISSING', severity: 'CRITICAL', message: 'לא הוזנו זכויות תכנון; לא ניתן לאשר דוח אפס ללא מצב תכנוני.' })
    }
    for (const parcel of profile.parcels) {
      if (read(parcel.landAreaSqm).gt(0) && !parcel.sourceId && !parcel.isVerified) {
        issues.push({ code: 'PARCEL_EVIDENCE_MISSING', severity: 'WARNING', message: `לגוש ${parcel.gush}, חלקה ${parcel.chelka} חסר מקור או אימות מקצועי לשטח החלקה.`, entityId: parcel.id })
      }
    }
    for (const area of profile.areas) {
      if (!area.sourceId && !area.isVerified) {
        issues.push({ code: 'AREA_EVIDENCE_MISSING', severity: 'WARNING', message: `לשטח „${area.label ?? area.areaType}” חסר מקור או אימות מקצועי.`, entityId: area.id })
      }
    }
    for (const right of profile.planningRights) {
      if (!right.sourceId && !right.isVerified) {
        issues.push({ code: 'PLANNING_RIGHT_EVIDENCE_MISSING', severity: 'WARNING', message: `לזכות התכנון „${right.category}” חסר מקור או אימות מקצועי.`, entityId: right.id })
      }
    }
    if (!profile.areas.some((area) => area.areaType === 'GROSS' && read(area.valueSqm).gt(0))) {
      issues.push({ code: 'GROSS_AREA_MISSING', severity: 'CRITICAL', message: 'חסר שטח ברוטו. עלות בנייה למ״ר אינה ניתנת לאימות.' })
    }
    if (scenario.unitMix.length === 0) {
      issues.push({ code: 'UNIT_MIX_MISSING', severity: 'CRITICAL', message: 'לא הוזן תמהיל יחידות לתרחיש.' })
    }
    for (const line of [...scenario.revenueLines, ...scenario.costLines]) {
      if (line.vatTreatment === 'VAT_INCLUDED') {
        issues.push({ code: 'VAT_INCLUDED_LINE_IN_PRE_VAT_MODEL', severity: 'CRITICAL', message: `השורה „${line.label}” מסומנת כולל מע״מ, בעוד שהמודל כולו מוגדר לפני מע״מ.`, entityId: line.id })
      }
    }

    for (const line of scenario.unitMix) {
      if (!line.disposition || line.disposition === 'UNCLASSIFIED') {
        issues.push({ code: 'UNIT_DISPOSITION_MISSING', severity: 'CRITICAL', message: `לשורת התמהיל „${line.label}” חסר שיוך ליזם, לתמורה או ליחידות קיימות. היא אינה נכללת בהכנסות עד לסיווג.`, entityId: line.id })
        continue
      }
      if (line.disposition !== 'DEVELOPER_SALE') continue
      const unitCount = new Decimal(line.unitCount)
      let unitValue: Decimal | null = null
      let formula = ''
      if (line.fixedUnitPrice) {
        unitValue = read(line.fixedUnitPrice)
        formula = 'מספר יח״ד × מחיר קבוע ליחידה'
      } else if (line.saleableAreaSqm && line.pricePerSqm) {
        unitValue = read(line.saleableAreaSqm).mul(read(line.pricePerSqm))
        formula = 'מספר יח״ד × שטח מכירה ליחידה × מחיר למ״ר'
      } else {
        issues.push({ code: 'UNIT_MIX_PRICE_MISSING', severity: 'WARNING', message: `לתמהיל „${line.label}” חסר מחיר קבוע או שטח מכירה ומחיר למ״ר.`, entityId: line.id })
      }
      if (unitValue) revenue.push({ id: line.id, label: line.label, category: 'RESIDENTIAL', amount: amount(unitValue.mul(unitCount)), formula })

      // parkingSpaces is deliberately interpreted as the total allocated
      // saleable spaces for this mix line (not per-unit) to avoid an implicit
      // multiplication. This is visible in the trace below.
      if (line.parkingSpaces > 0 && line.parkingPrice) revenue.push({ id: `${line.id}:parking`, label: `${line.label} · חניה`, category: 'PARKING', amount: amount(new Decimal(line.parkingSpaces).mul(read(line.parkingPrice))), formula: 'מספר חניות מוקצות בתמהיל × מחיר לחניה' })
      if (line.balconyAreaSqm && line.balconyPricePerSqm) revenue.push({ id: `${line.id}:balcony`, label: `${line.label} · מרפסות`, category: 'RESIDENTIAL', amount: amount(unitCount.mul(read(line.balconyAreaSqm)).mul(read(line.balconyPricePerSqm))), formula: 'מספר יח״ד × שטח מרפסת ליחידה × מחיר מרפסת למ״ר' })
      if (line.storageAreaSqm && line.storagePricePerSqm) revenue.push({ id: `${line.id}:storage`, label: `${line.label} · מחסנים`, category: 'STORAGE', amount: amount(unitCount.mul(read(line.storageAreaSqm)).mul(read(line.storagePricePerSqm))), formula: 'מספר יח״ד × שטח מחסן ליחידה × מחיר מחסן למ״ר' })
    }

    for (const line of scenario.revenueLines) {
      let value = new Decimal(0)
      let formula = ''
      if (line.saleableAreaSqm && line.pricePerSqm) { value = read(line.saleableAreaSqm).mul(read(line.pricePerSqm)); formula = 'שטח מכירה × מחיר למ״ר' }
      else if (line.quantity && line.fixedUnitPrice) { value = read(line.quantity).mul(read(line.fixedUnitPrice)); formula = 'כמות × מחיר יחידה' }
      else if (line.annualNoi && line.capitalizationRate) { value = read(line.annualNoi).div(read(line.capitalizationRate)); formula = 'NOI שנתי ÷ שיעור היוון' }
      revenue.push({ id: line.id, label: line.label, category: line.category, amount: amount(value), formula })
    }
    const totalRevenue = revenue.reduce((sum, line) => sum.plus(line.amount), new Decimal(0))

    const directCostLines = scenario.costLines.filter((line) => line.quantity && line.unitCost || line.fixedAmount)
    for (const line of directCostLines) {
      const value = line.fixedAmount ? read(line.fixedAmount) : read(line.quantity).mul(read(line.unitCost))
      costs.push({ id: line.id, label: line.label, category: line.category, amount: amount(value), formula: line.fixedAmount ? 'סכום קבוע' : 'כמות × עלות יחידה' })
    }
    const directCosts = costs.reduce((sum, line) => sum.plus(line.amount), new Decimal(0))
    for (const line of scenario.costLines.filter((row) => row.percentage)) {
      const base = line.percentageBase === 'TOTAL_REVENUE' ? totalRevenue : line.percentageBase === 'DIRECT_COSTS' ? directCosts : null
      if (!base) {
        issues.push({ code: 'COST_PERCENTAGE_BASE_UNSUPPORTED', severity: 'CRITICAL', message: `לעלות „${line.label}” יש בסיס אחוזי לא נתמך. בחרו TOTAL_REVENUE או DIRECT_COSTS.`, entityId: line.id })
        continue
      }
      costs.push({ id: line.id, label: line.label, category: line.category, amount: amount(base.mul(read(line.percentage))), formula: `${line.percentageBase} × אחוז` })
    }
    const compensation: CalculationLine[] = []
    for (const line of scenario.compensations) {
      const directCashCost = read(line.cashCompensation)
        .plus(read(line.monthlyRelocationRent).mul(line.relocationMonths ?? 0))
        .plus(read(line.movingCost)).plus(read(line.temporaryHousingCost))
        .plus(read(line.legalCost)).plus(read(line.inspectionCost)).plus(read(line.otherCost))
      const benefitValue = read(line.replacementValue).plus(read(line.parkingValue)).plus(read(line.storageValue)).plus(read(line.balconyValue))
      compensation.push({ id: line.id, label: `תמורה לבעלות ${line.ownerApartmentId}`, category: 'EXISTING_OWNER_CONSIDERATION', amount: amount(directCashCost), formula: 'מזומן + שכירות פינוי × חודשים + מעבר + דיור חלופי + עלויות נלוות' })
      if (benefitValue.gt(0)) issues.push({ code: 'COMPENSATION_BENEFIT_VALUE_NOT_COSTED', severity: 'INFO', message: 'שווי דירת התמורה מתועד אך אינו מתווסף שוב לעלות הפרויקט, כדי למנוע ספירה כפולה מול עלות הבנייה.', entityId: line.id })
    }
    costs.push(...compensation)
    let totalCosts = costs.reduce((sum, line) => sum.plus(line.amount), new Decimal(0))

    const expectedRevenueBySource = new Map<string, Decimal>()
    for (const line of revenue) {
      const rootId = line.id.split(':')[0]
      expectedRevenueBySource.set(rootId, (expectedRevenueBySource.get(rootId) ?? new Decimal(0)).plus(line.amount))
    }
    const expectedCostsBySource = new Map(costs.map((line) => [line.id, new Decimal(line.amount)]))
    const allocatedRevenueBySource = new Map<string, Decimal>()
    const allocatedCostsBySource = new Map<string, Decimal>()
    const allocatedCompensationBySource = new Map<string, Decimal>()
    const costAllocationSchedule = new Map<string, Array<{ month: string; amount: Decimal }>>()
    const nonCanonicalPeriods = new Set<string>()
    const periods = new Map<string, { inflows: Decimal; outflows: Decimal }>()
    const debtMovementByPeriod = new Map<string, Decimal>()
    for (const allocation of scenario.cashFlowAllocations) {
      // הדלי הוא חודש קלנדרי. תאריך שאינו הראשון בחודש נכנס לחודש שלו,
      // ומדווח — כדי שהנרמול יהיה גלוי ולא שקט.
      const month = `${allocation.periodStart.toISOString().slice(0, 7)}-01`
      if (allocation.periodStart.toISOString().slice(0, 10) !== month) nonCanonicalPeriods.add(allocation.periodStart.toISOString().slice(0, 10))
      const period = periods.get(month) ?? { inflows: new Decimal(0), outflows: new Decimal(0) }
      const value = read(allocation.amount)
      if (allocation.direction === 'INFLOW') period.inflows = period.inflows.plus(value)
      else period.outflows = period.outflows.plus(value)
      periods.set(month, period)
      if (allocation.sourceKind === 'REVENUE' && allocation.sourceLineId) allocatedRevenueBySource.set(allocation.sourceLineId, (allocatedRevenueBySource.get(allocation.sourceLineId) ?? new Decimal(0)).plus(value))
      if (allocation.sourceKind === 'COST' && allocation.sourceLineId) {
        allocatedCostsBySource.set(allocation.sourceLineId, (allocatedCostsBySource.get(allocation.sourceLineId) ?? new Decimal(0)).plus(value))
        // התאריך נשמר לצד הסכום: התייקרות היא פונקציה של מתי ההוצאה מתרחשת,
        // ולא של גודלה בלבד, ולכן סכום בלי מועד אינו מספיק כאן.
        costAllocationSchedule.set(allocation.sourceLineId, [...(costAllocationSchedule.get(allocation.sourceLineId) ?? []), { month, amount: value }])
      }
      if (allocation.sourceKind === 'COMPENSATION' && allocation.sourceLineId) allocatedCompensationBySource.set(allocation.sourceLineId, (allocatedCompensationBySource.get(allocation.sourceLineId) ?? new Decimal(0)).plus(value))
      if (allocation.sourceKind === 'DEBT') debtMovementByPeriod.set(month, (debtMovementByPeriod.get(month) ?? new Decimal(0)).plus(allocation.direction === 'INFLOW' ? value : value.negated()))
    }
    if (nonCanonicalPeriods.size > 0) {
      issues.push({ code: 'CASH_FLOW_PERIOD_NOT_MONTH_START', severity: 'WARNING', message: `${nonCanonicalPeriods.size} הקצאות תזרים אינן בתחילת חודש ושויכו לחודש שלהן. בדקו את מועדי ההקצאה.` })
    }
    this.reconcileAllocations(expectedRevenueBySource, allocatedRevenueBySource, 'REVENUE', issues)
    const expectedDirectCosts = new Map([...expectedCostsBySource].filter(([id]) => !scenario.compensations.some((line) => line.id === id)))
    const expectedCompensation = new Map(compensation.map((line) => [line.id, new Decimal(line.amount)]))
    this.reconcileAllocations(expectedDirectCosts, allocatedCostsBySource, 'COST', issues)
    this.reconcileAllocations(expectedCompensation, allocatedCompensationBySource, 'COMPENSATION', issues)

    // ── התייקרות ורזרבה ──────────────────────────────────────────────────────
    //
    // שני השדות האלה נקלטו עד כה ולא השפיעו על דבר. הם מיושמים כשורות עלות
    // *נגזרות ונפרדות*, ולא כהגדלה של שורת הבסיס, משתי סיבות:
    //
    // 1. פיוס. שורת הבסיס חייבת להמשיך להתאים בדיוק להקצאות התזרים שהמשתמש
    //    הזין. הגדלת השורה עצמה היתה שוברת את הפיוס לכל שורה עם התייקרות.
    // 2. עקיבות. תוספת נפרדת עם נוסחה משלה ניתנת להסבר מול בעל מקצוע;
    //    מספר מנופח בתוך שורת הבסיס אינו.
    //
    // ההתייקרות מחושבת מהמועד הקובע של הפרופיל עד מועד ההוצאה בפועל, לפי
    // ההקצאה שהמשתמש קבע. תוספת שאין לה מועד אינה ניתנת לחישוב, ולכן שורה
    // עם שיעור התייקרות וללא הקצאת תזרים מסומנת ואינה מומצאת.
    const valuationDay = profile.valuationDate.toISOString().slice(0, 10)
    const escalationLines: CalculationLine[] = []
    const upliftOutflowByPeriod = new Map<string, Decimal>()
    const addUpliftOutflow = (month: string, value: Decimal) => {
      upliftOutflowByPeriod.set(month, (upliftOutflowByPeriod.get(month) ?? new Decimal(0)).plus(value))
    }
    for (const line of scenario.costLines) {
      const escalationRate = line.escalationRate ? read(line.escalationRate) : new Decimal(0)
      const contingencyRate = line.contingencyRate ? read(line.contingencyRate) : new Decimal(0)
      if (escalationRate.isZero() && contingencyRate.isZero()) continue
      if (escalationRate.lt(0) || contingencyRate.lt(0)) {
        issues.push({ code: 'COST_UPLIFT_RATE_NEGATIVE', severity: 'CRITICAL', message: `לשורה „${line.label}” יש שיעור התייקרות או רזרבה שלילי.`, entityId: line.id })
        continue
      }
      const schedule = costAllocationSchedule.get(line.id) ?? []
      if (schedule.length === 0) {
        issues.push({ code: 'COST_UPLIFT_WITHOUT_SCHEDULE', severity: 'WARNING', message: `לשורה „${line.label}” הוגדרה התייקרות או רזרבה, אך אין לה הקצאת תזרים ולכן התוספת אינה מחושבת.`, entityId: line.id })
        continue
      }
      if (escalationRate.gt(0)) {
        let escalationUplift = new Decimal(0)
        for (const entry of schedule) {
          const years = new Decimal(daysBetween(valuationDay, entry.month)).div(365)
          const uplift = entry.amount.mul(new Decimal(1).plus(escalationRate).pow(years).minus(1))
          escalationUplift = escalationUplift.plus(uplift)
          addUpliftOutflow(entry.month, uplift)
        }
        escalationLines.push({ id: `${line.id}:escalation`, label: `${line.label} · התייקרות`, category: line.category, amount: amount(escalationUplift), formula: `Σ הקצאה × ((1 + ${escalationRate.toFixed(8)}) ^ (ימים מהמועד הקובע ${valuationDay} עד מועד ההוצאה ÷ 365) − 1)` })
      }
      if (contingencyRate.gt(0)) {
        // רזרבה אינה תלוית זמן. היא נפרסת יחסית להקצאות כדי שהיא תופיע
        // בתזרים באותם חודשים שבהם ההוצאה עצמה מתרחשת.
        const scheduleTotal = schedule.reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0))
        let contingencyUplift = new Decimal(0)
        for (const entry of schedule) {
          const uplift = entry.amount.mul(contingencyRate)
          contingencyUplift = contingencyUplift.plus(uplift)
          addUpliftOutflow(entry.month, uplift)
        }
        escalationLines.push({ id: `${line.id}:contingency`, label: `${line.label} · רזרבה`, category: line.category, amount: amount(contingencyUplift), formula: `הקצאת תזרים לשורה (${amount(scheduleTotal)}) × ${contingencyRate.toFixed(8)}` })
      }
    }
    if (escalationLines.length > 0) {
      costs.push(...escalationLines)
      totalCosts = totalCosts.plus(escalationLines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0)))
      for (const [month, value] of upliftOutflowByPeriod) {
        const period = periods.get(month)
        if (period) period.outflows = period.outflows.plus(value)
      }
    }

    const financingCosts: CalculationLine[] = []
    let outstandingDebt = new Decimal(0)
    let peakDebt = new Decimal(0)
    let accumulatedInterest = new Decimal(0)
    let financingFees = new Decimal(0)
    const configuredDebt = scenario.financing?.debtAmount ? read(scenario.financing.debtAmount) : null
    const arrangementFeeRate = scenario.financing?.arrangementFeeRate ? read(scenario.financing.arrangementFeeRate) : new Decimal(0)
    const guaranteeFeeRate = scenario.financing?.guaranteeFeeRate ? read(scenario.financing.guaranteeFeeRate) : new Decimal(0)
    if ((arrangementFeeRate.gt(0) || guaranteeFeeRate.gt(0)) && !configuredDebt) {
      issues.push({ code: 'FINANCING_FEE_DEBT_AMOUNT_MISSING', severity: 'WARNING', message: 'הוזנו עמלות מימון אך לא הוגדר סכום חוב; העמלות אינן מחושבות.' })
    }
    if (configuredDebt) {
      const arrangementFee = configuredDebt.mul(arrangementFeeRate)
      const guaranteeFee = configuredDebt.mul(guaranteeFeeRate)
      financingFees = arrangementFee.plus(guaranteeFee)
    }
    if (scenario.financing?.annualInterestRate && debtMovementByPeriod.size === 0) issues.push({ code: 'DEBT_DRAWDOWN_MISSING', severity: 'WARNING', message: 'הוזנה ריבית אך אין משיכות/החזרי חוב בתזרים; עלות מימון אינה מחושבת.' })
    // מועד המשיכה הראשונה הוא נקודת האפס של הגרייס ושל תקופת המימון כאחד.
    // בלעדיו אין ממה לספור, ולכן שני השדות אינם מיושמים בשקט על ציר שרירותי.
    const drawdownPeriods = [...debtMovementByPeriod.entries()].filter(([, movement]) => movement.gt(0)).map(([month]) => month).sort()
    const firstDrawdownPeriod = drawdownPeriods[0] ?? null
    const graceMonths = scenario.financing?.graceMonths ?? 0
    const financingMonths = scenario.financing?.financingMonths ?? null
    if (graceMonths > 0 && !firstDrawdownPeriod) issues.push({ code: 'GRACE_WITHOUT_DRAWDOWN', severity: 'WARNING', message: 'הוגדרו חודשי גרייס אך אין משיכת חוב בתזרים; הגרייס אינו מיושם.' })
    if (financingMonths !== null && !firstDrawdownPeriod) issues.push({ code: 'FINANCING_TERM_WITHOUT_DRAWDOWN', severity: 'WARNING', message: 'הוגדרה תקופת מימון אך אין משיכת חוב בתזרים; התקופה אינה נבדקת.' })
    const withinGrace = (periodStart: string) => Boolean(firstDrawdownPeriod) && graceMonths > 0 && monthlyPeriodDistance(firstDrawdownPeriod!, periodStart) < graceMonths
    let lastPeriodWithDebt: string | null = null

    let cumulative = new Decimal(0)
    let peakNegative = new Decimal(0)
    const projectPeriodFlows: Decimal[] = []
    const equityPeriodFlows: Decimal[] = []
    let equityInvested = new Decimal(0)
    let equityDistributed = new Decimal(0)
    // ── ציר חודשי רציף (P0-3) ────────────────────────────────────────────────
    //
    // עד לשינוי הזה הציר נבנה מהחודשים שבהם *היתה* תנועה בלבד. חודש בלי
    // תנועה פשוט לא היה קיים, ולכן חוב שנמשך ביולי ונפרע ביוני שאחריו נשא
    // ריבית של שלושה חודשים במקום שנים־עשר, ו-IRR חושב על ציר מכווץ.
    // חודש שקט הוא חודש שקרה.
    const periodAxis = continuousMonthlyPeriodAxis([...periods.keys()])
    const cashFlow: CashFlowPeriod[] = periodAxis.map((periodStart, index) => {
      const values = periods.get(periodStart) ?? { inflows: new Decimal(0), outflows: new Decimal(0) }
      if (index === 0 && financingFees.gt(0)) {
        values.outflows = values.outflows.plus(financingFees)
        if (arrangementFeeRate.gt(0)) financingCosts.push({ id: 'arrangement-fee', label: 'עמלת סידור מימון', category: 'FINANCING', amount: amount(configuredDebt!.mul(arrangementFeeRate)), formula: 'סך חוב מוגדר × שיעור עמלת סידור' })
        if (guaranteeFeeRate.gt(0)) financingCosts.push({ id: 'guarantee-fee', label: 'עמלת ערבויות', category: 'FINANCING', amount: amount(configuredDebt!.mul(guaranteeFeeRate)), formula: 'סך חוב מוגדר × שיעור עמלת ערבויות' })
      }
      const debtMovement = debtMovementByPeriod.get(periodStart) ?? new Decimal(0)
      const openingDebt = outstandingDebt
      const endingDebt = outstandingDebt.plus(debtMovement)
      // החוב "חי" בחודש גם אם נפרע בתוכו. מדידה לפי יתרת סוף חודש בלבד
      // היתה מקצרת את תקופת המימון בדיוק בחודש הפירעון.
      if (openingDebt.gt(0) || debtMovement.gt(0)) lastPeriodWithDebt = periodStart
      /*
       * The same one-agora tolerance the closing check uses, and for the same
       * reason. `DEBT_NOT_REPAID` below has always allowed a cent of leftover
       * debt; this side allowed nothing, so a repayment schedule built to the
       * cent could overshoot by a fraction of an agora and raise a CRITICAL
       * that blocks report approval — on a balance that prints as -0.00.
       *
       * The asymmetry was arbitrary rather than conservative: a rounding
       * residue is not "repaid more than was owed" in any sense a reader would
       * recognise, and treating it as one made the stricter side the one that
       * fired on correct models.
       */
      if (endingDebt.lt(DEBT_ROUNDING_TOLERANCE.negated())) issues.push({ code: 'DEBT_BALANCE_NEGATIVE', severity: 'CRITICAL', message: `החזר חוב גדול מיתרת החוב בתזרים ב-${amount(endingDebt.abs())}.`, entityId: periodStart })
      let interest = new Decimal(0)
      let capitalisedInterest = new Decimal(0)
      if (scenario.financing?.annualInterestRate && debtMovementByPeriod.size > 0) {
        interest = averageMonthlyDebtInterest(outstandingDebt, debtMovement, read(scenario.financing.annualInterestRate), periodStart)
        // תקופת גרייס: הריבית נצברת ואינה משולמת. היא נזקפת ליתרת החוב,
        // ולכן היא נושאת ריבית בעצמה בחודשים הבאים — וזו בדיוק המשמעות
        // הכלכלית של גרייס, להבדיל מהנחה.
        const inGrace = withinGrace(periodStart)
        if (inGrace) {
          capitalisedInterest = interest
          financingCosts.push({ id: `interest:${periodStart}`, label: `ריבית מימון ${periodStart} · נצברת בגרייס`, category: 'FINANCING', amount: amount(interest), formula: `יתרת חוב ממוצעת × ריבית שנתית × ימים ÷ 365, נזקפת לקרן (גרייס ${graceMonths} חודשים מ-${firstDrawdownPeriod})` })
        } else {
          values.outflows = values.outflows.plus(interest)
          financingCosts.push({ id: `interest:${periodStart}`, label: `ריבית מימון ${periodStart}`, category: 'FINANCING', amount: amount(interest), formula: 'יתרת חוב ממוצעת × ריבית שנתית × ימים ÷ 365' })
        }
        accumulatedInterest = accumulatedInterest.plus(interest)
      }
      outstandingDebt = endingDebt.plus(capitalisedInterest)
      if (outstandingDebt.greaterThan(peakDebt)) peakDebt = outstandingDebt
      const net = values.inflows.minus(values.outflows)
      const debtDrawOrRepayment = debtMovement
      const equityMovement = scenario.cashFlowAllocations
        .filter((allocation) => allocation.periodStart.toISOString().slice(0, 10) === periodStart && allocation.sourceKind === 'EQUITY')
        .reduce((sum, allocation) => sum.plus(allocation.direction === 'INFLOW' ? read(allocation.amount) : read(allocation.amount).negated()), new Decimal(0))
      // Project IRR is unlevered: debt/equity movements and calculated interest
      // are excluded. Equity IRR uses explicit investor contributions/distributions.
      projectPeriodFlows.push(net.minus(debtDrawOrRepayment).minus(equityMovement).plus(interest.minus(capitalisedInterest)))
      equityPeriodFlows.push(equityMovement.negated())
      if (equityMovement.gt(0)) equityInvested = equityInvested.plus(equityMovement)
      if (equityMovement.lt(0)) equityDistributed = equityDistributed.plus(equityMovement.abs())
      cumulative = cumulative.plus(net)
      if (cumulative.lessThan(peakNegative)) peakNegative = cumulative
      return { periodStart, inflows: amount(values.inflows), outflows: amount(values.outflows), net: amount(net), cumulative: amount(cumulative) }
    })
    if (scenario.costLines.some((line) => line.category === 'FINANCING') && financingCosts.length) issues.push({ code: 'FINANCING_DOUBLE_COUNT_RISK', severity: 'WARNING', message: 'קיימות שורות עלות מימון בנוסף לריבית מחושבת; ודאו שאין ספירה כפולה.' })
    const totalCostsBeforeFinancing = totalCosts
    costs.push(...financingCosts)
    totalCosts = totalCosts.plus(accumulatedInterest).plus(financingFees)

    // ── LTC, LTV ותקופת המימון ───────────────────────────────────────────────
    //
    // שלושת אלה אינם מניעים חישוב אלא אמות מידה. כך הם נקראים בגיליון תנאים
    // של גוף מממן, וכך הם נבדקים כאן: החוב בפועל נמדד מולם, וחריגה מסומנת.
    // הם *לא* משמשים לגזירת סכום חוב — גזירה כזו היתה מחייבת גם לוח משיכות
    // מומצא, וזה בדיוק מה שהמפרט אוסר.
    //
    // המדידה היא לפי חוב השיא, לא לפי החוב המוגדר: בליווי בנייה החשיפה
    // המרבית היא המדד שהגוף המממן בוחן.
    const measuredDebt = peakDebt.gt(0) ? peakDebt : (configuredDebt ?? new Decimal(0))
    const measuredDebtBasis = peakDebt.gt(0) ? 'חוב שיא בתזרים' : 'סכום חוב מוגדר'
    const actualLtc = totalCosts.gt(0) && measuredDebt.gt(0) ? measuredDebt.div(totalCosts) : null
    const actualLtv = totalRevenue.gt(0) && measuredDebt.gt(0) ? measuredDebt.div(totalRevenue) : null
    const ltcLimit = scenario.financing?.ltc ? read(scenario.financing.ltc) : null
    const ltvLimit = scenario.financing?.ltv ? read(scenario.financing.ltv) : null
    for (const [key, limit] of [['LTC', ltcLimit], ['LTV', ltvLimit]] as const) {
      if (limit && (limit.lte(0) || limit.gt(1))) issues.push({ code: 'FINANCING_RATIO_LIMIT_INVALID', severity: 'CRITICAL', message: `מגבלת ${key} חייבת להיות שבר גדול מ־0 ולא גדול מ־1.` })
    }
    if (ltcLimit && ltcLimit.gt(0) && ltcLimit.lte(1) && actualLtc && actualLtc.gt(ltcLimit)) {
      issues.push({ code: 'LTC_LIMIT_EXCEEDED', severity: 'CRITICAL', message: `החוב חורג ממגבלת ה־LTC: ${actualLtc.mul(100).toFixed(2)}% מול מגבלה של ${ltcLimit.mul(100).toFixed(2)}%.` })
    }
    if (ltvLimit && ltvLimit.gt(0) && ltvLimit.lte(1) && actualLtv && actualLtv.gt(ltvLimit)) {
      issues.push({ code: 'LTV_LIMIT_EXCEEDED', severity: 'CRITICAL', message: `החוב חורג ממגבלת ה־LTV: ${actualLtv.mul(100).toFixed(2)}% מול מגבלה של ${ltvLimit.mul(100).toFixed(2)}%.` })
    }
    if ((ltcLimit || ltvLimit) && measuredDebt.lte(0)) {
      issues.push({ code: 'FINANCING_RATIO_WITHOUT_DEBT', severity: 'WARNING', message: 'הוגדרו מגבלות LTC/LTV אך אין חוב שניתן למדוד מולן.' })
    }
    let financingTermUsedMonths: number | null = null
    if (financingMonths !== null && firstDrawdownPeriod) {
      if (financingMonths <= 0) {
        issues.push({ code: 'FINANCING_TERM_INVALID', severity: 'CRITICAL', message: 'תקופת המימון חייבת להיות חיובית.' })
      } else {
        // אורך הניצול נמדד עד החודש האחרון שבו נותרה יתרת חוב, ועוד חודש
        // אחד משום שהחודש הראשון עצמו נספר.
        financingTermUsedMonths = lastPeriodWithDebt ? monthlyPeriodDistance(firstDrawdownPeriod, lastPeriodWithDebt) + 1 : 0
        if (financingTermUsedMonths > financingMonths) {
          issues.push({ code: 'FINANCING_TERM_EXCEEDED', severity: 'CRITICAL', message: `החוב נותר פתוח ${financingTermUsedMonths} חודשים מול תקופת מימון של ${financingMonths} חודשים; נדרשת הארכה או שינוי לוח ההחזר.` })
        }
      }
    }
    // ── הון עצמי מוגדר מול הון עצמי בפועל ────────────────────────────────
    //
    // `equityAmount` הוא ההון שהיזם התחייב להעמיד. הוא נבדק באותו היגיון
    // שבו נבדקות מגבלות ה־LTC/LTV שלמעלה: מודדים את המצב בפועל ומשווים
    // מולו. הוא *לא* משמש לגזירת תנועות הון — ההון בפועל מגיע מהקצאות
    // התזרים המתוארכות, וגזירה ממנו היתה ממציאה לוח הזרמות שלא הוזן.
    //
    // ולכן הוא גם אינו אמור להזיז את ה־NPV של הפרויקט: כמה הון היזם מעמיד
    // אינו משנה כמה הפרויקט מרוויח. הוא קובע אם התוכנית ממומנת, ועל כך
    // הבדיקות כאן.
    const committedEquity = scenario.financing?.equityAmount ? read(scenario.financing.equityAmount) : null
    let equityFundingGap: Decimal | null = null
    if (committedEquity) {
      if (committedEquity.lt(0)) {
        issues.push({ code: 'FINANCING_EQUITY_INVALID', severity: 'CRITICAL', message: 'ההון העצמי המוגדר אינו יכול להיות שלילי.' })
      } else {
        // מקורות מול שימושים: חוב נמדד ועוד הון מוגדר חייבים לכסות את סך
        // העלויות. פער כאן אינו אזהרה — זו תוכנית שאינה ממומנת.
        const committedFunding = measuredDebt.plus(committedEquity)
        if (totalCosts.gt(0) && committedFunding.lt(totalCosts)) {
          equityFundingGap = totalCosts.minus(committedFunding)
          issues.push({
            code: 'FUNDING_GAP',
            severity: 'CRITICAL',
            message: `מקורות המימון אינם מכסים את העלויות: חוב ${amount(measuredDebt)} ועוד הון עצמי ${amount(committedEquity)} מול עלויות ${amount(totalCosts)} — חסרים ${amount(equityFundingGap)}.`,
          })
        }
        if (committedEquity.gt(0) && equityInvested.lte(0)) {
          issues.push({ code: 'EQUITY_NOT_DRAWN', severity: 'WARNING', message: 'הוגדר הון עצמי אך אין הקצאות תזרים מסוג EQUITY, ולכן הוא אינו מוזרם בפועל בתזרים.' })
        } else if (equityInvested.gt(committedEquity)) {
          issues.push({
            code: 'EQUITY_COMMITMENT_EXCEEDED',
            severity: 'CRITICAL',
            message: `ההון העצמי שנדרש בתזרים (${amount(equityInvested)}) גדול מההון שהוגדר (${amount(committedEquity)}).`,
          })
        }
      }
    }
    if (outstandingDebt.gt(DEBT_ROUNDING_TOLERANCE)) issues.push({ code: 'DEBT_NOT_REPAID', severity: 'CRITICAL', message: `בתום התזרים נותרה יתרת חוב של ${amount(outstandingDebt)}; הרווח המוצג אינו סופי כל עוד החוב אינו נפרע.` })

    if (totalRevenue.lte(0)) issues.push({ code: 'REVENUE_ZERO', severity: 'CRITICAL', message: 'לא ניתן להציג כדאיות: סך ההכנסות הוא אפס.' })
    if (totalCosts.lte(0)) issues.push({ code: 'COST_ZERO', severity: 'CRITICAL', message: 'לא ניתן להציג כדאיות: סך העלויות הוא אפס.' })
    if (!scenario.financing) issues.push({ code: 'FINANCING_MISSING', severity: 'WARNING', message: 'טרם הוזנו הנחות מימון; ריבית, חוב שיא והון עצמי אינם מחושבים.' })
    if (scenario.kind === 'BASE' && profile.planningRights.some((right) => right.status === 'UNCERTAIN')) issues.push({ code: 'UNCERTAIN_RIGHTS_IN_BASE', severity: 'WARNING', message: 'תרחיש בסיס כולל זכויות תכנון לא ודאיות; נדרש אישור מקצועי לפני הפקת דוח.' })

    const profitBeforeFinancing = totalRevenue.minus(totalCostsBeforeFinancing)
    const projectProfit = totalRevenue.minus(totalCosts)
    const annualDiscountRate = profile.assumptions.find((assumption) => assumption.key === 'annual-discount-rate')?.value
    // ── בסיס התשואה (P0-4) ───────────────────────────────────────────────────
    //
    // IRR תקופתי לגיטימי רק כשהמרווח בין התקופות אחיד. אחרי P0-3 הציר אחיד
    // מעצם בנייתו, אבל זו הנחה שצריכה להיות *נבדקת* ולא מונחת: אם הציר
    // יפסיק להיות אחיד, המנוע יעבור ל-XIRR לפי ימים בפועל במקום להמשיך
    // לחשב כאילו כל פער שווה.
    const axisIsUniform = isUniformMonthlyAxis(periodAxis)
    if (!axisIsUniform && periodAxis.length > 1) {
      issues.push({ code: 'CASH_FLOW_AXIS_NOT_UNIFORM', severity: 'INFO', message: 'ציר התזרים אינו אחיד; התשואה מחושבת לפי XIRR על ימים בפועל.' })
    }
    const datedProjectFlows = projectPeriodFlows.map((flowAmount, index) => ({ date: periodAxis[index]!, amount: flowAmount }))
    const datedEquityFlows = equityPeriodFlows.map((flowAmount, index) => ({ date: periodAxis[index]!, amount: flowAmount }))
    // XIRR נשמר גם כשהציר אחיד: זה המספר שהשמאי יראה בגיליון שלו מול
    // הפונקציה XIRR של Excel, והוא נדרש כדי שהדוח יהיה בר־בדיקה מבחוץ.
    const projectXirrAnnual = xirr(datedProjectFlows)
    const equityXirrAnnual = xirr(datedEquityFlows)
    const projectIrrMonthly = axisIsUniform ? irr(projectPeriodFlows) : null
    const equityIrrMonthly = axisIsUniform ? irr(equityPeriodFlows) : null
    const projectIrrAnnual = projectIrrMonthly ? annualizeMonthlyRate(projectIrrMonthly) : projectXirrAnnual
    const equityIrrAnnual = equityIrrMonthly ? annualizeMonthlyRate(equityIrrMonthly) : equityXirrAnnual
    if (!projectIrrAnnual) issues.push({ code: 'PROJECT_IRR_UNAVAILABLE', severity: 'WARNING', message: 'לא ניתן לחשב IRR לפרויקט: דרושים תזרימים חיוביים ושליליים מלאים.' })
    if (!equityIrrAnnual) issues.push({ code: 'EQUITY_IRR_UNAVAILABLE', severity: 'WARNING', message: 'לא ניתן לחשב IRR להון העצמי: דרושים תזרימים חיוביים ושליליים מלאים.' })
    // A blended equity return is the right answer for one investor and the
    // wrong one for a structure. Saying so is cheap — counting the tranches —
    // whereas running the waterfall here would put an XIRR per tranche inside
    // every Monte Carlo iteration, so the reader is pointed at it instead.
    if ((scenario.equityTranches?.length ?? 0) > 1) {
      issues.push({
        code: 'EQUITY_IRR_BLENDED_ACROSS_TRANCHES', severity: 'INFO',
        message: `התרחיש כולל ${scenario.equityTranches!.length} שכבות הון בעלות עדיפויות שונות. התשואה המוצגת כאן משוקללת על פני כולן ואינה התשואה של אף שכבה בפועל; הפירוט לפי שכבה נמצא במפל ההון.`,
      })
    }
    if (!annualDiscountRate) issues.push({ code: 'DISCOUNT_RATE_MISSING', severity: 'WARNING', message: 'לא ניתן לחשב NPV ללא הנחת annual-discount-rate במרשם ההנחות.' })
    const periodicDiscountRate = annualDiscountRate ? monthlyRateFromAnnual(read(annualDiscountRate)) : null
    const projectNpv = !annualDiscountRate ? null
      : axisIsUniform ? npv(projectPeriodFlows, periodicDiscountRate!) : xnpv(datedProjectFlows, read(annualDiscountRate))
    const equityNpv = !annualDiscountRate ? null
      : axisIsUniform ? npv(equityPeriodFlows, periodicDiscountRate!) : xnpv(datedEquityFlows, read(annualDiscountRate))
    const minimumProfitMargin = profile.assumptions.find((assumption) => assumption.key === 'minimum-profit-margin')?.value
    const minimumProjectIrrAnnual = profile.assumptions.find((assumption) => assumption.key === 'minimum-project-irr-annual')?.value
    /*
     * ── CONSIDERATION IN KIND, AND WHY IT CHANGES ONLY DENOMINATORS ───────
     *
     * A combination deal pays for land partly in finished flats. No cash
     * moves for them, so they are correctly absent from the cash flow, from
     * the cost lines that reconcile against it, and from the revenue the
     * developer actually collects. PROFIT is therefore already right: the
     * value handed over leaves through revenue never earned, which is exactly
     * as much as it would have cost had it been bought for cash.
     *
     *   net   basis: (revenue − inKind) − cashCosts
     *   gross basis: revenue − (cashCosts + inKind)
     *
     * The two are identically equal, which is why nothing about profit, IRR,
     * NPV or the financing schedule moves here.
     *
     * What was wrong was every RATIO built on those figures. Profit-on-cost
     * divided by a cost base that omitted the flats; profit margin divided by
     * a revenue base that omitted them too; and the residual land value —
     * the one number a negotiator acts on — was computed against revenue the
     * project never books. On a live scenario the engine reported 32.63%
     * where the honest figure was 20.00%.
     *
     * So two bases are formed once here and used consistently below. With no
     * consideration in kind both collapse to the cash figures exactly, which
     * is what keeps every existing scenario bit-for-bit unchanged.
     */
    const considerationInKind = scenario.considerationInKind ? read(scenario.considerationInKind) : new Decimal(0)
    if (considerationInKind.lt(0)) {
      issues.push({ code: 'CONSIDERATION_IN_KIND_NEGATIVE', severity: 'CRITICAL', message: 'תמורה שאינה במזומן אינה יכולה להיות שלילית.' })
    }
    /** Everything the project is worth, including what is handed over rather than sold. */
    const totalRevenueBasis = totalRevenue.plus(considerationInKind)
    /** Everything the land and the build cost, cash and in kind alike. This is the ROC denominator. */
    const totalCostBasis = totalCosts.plus(considerationInKind)

    const actualProfitMargin = totalRevenueBasis.gt(0) ? projectProfit.div(totalRevenueBasis) : null
    for (const [key, value] of [['minimum-profit-margin', minimumProfitMargin], ['minimum-project-irr-annual', minimumProjectIrrAnnual]] as const) {
      if (value && (read(value).lt(0) || read(value).gte(1))) issues.push({ code: 'PROFITABILITY_TARGET_INVALID', severity: 'CRITICAL', message: `הנחת ${key} חייבת להיות שבר בין 0 ל־1.` })
    }
    if (minimumProfitMargin && actualProfitMargin && read(minimumProfitMargin).gte(0) && read(minimumProfitMargin).lt(1) && actualProfitMargin.lt(read(minimumProfitMargin))) {
      issues.push({ code: 'PROFIT_MARGIN_BELOW_TARGET', severity: 'WARNING', message: 'מרווח הרווח נמוך מיעד המינימום שהוגדר בתרחיש.' })
    }
    if (minimumProjectIrrAnnual && projectIrrAnnual && read(minimumProjectIrrAnnual).gte(0) && read(minimumProjectIrrAnnual).lt(1) && projectIrrAnnual.lt(read(minimumProjectIrrAnnual))) {
      issues.push({ code: 'PROJECT_IRR_BELOW_TARGET', severity: 'WARNING', message: 'IRR הפרויקט נמוך מיעד המינימום שהוגדר בתרחיש.' })
    }
    const totalSaleableArea = scenario.unitMix.filter((line) => line.disposition === 'DEVELOPER_SALE').reduce((sum, line) => sum.plus(read(line.saleableAreaSqm).mul(line.unitCount)), new Decimal(0))
      .plus(scenario.revenueLines.reduce((sum, line) => sum.plus(read(line.saleableAreaSqm)), new Decimal(0)))
    const constructionLines = scenario.costLines.filter((line) => line.category === 'CONSTRUCTION')
    const constructionQuantity = constructionLines.reduce((sum, line) => sum.plus(read(line.quantity)), new Decimal(0))
    const constructionCosts = constructionLines.reduce((sum, line) => sum.plus(line.fixedAmount ? read(line.fixedAmount) : read(line.quantity).mul(read(line.unitCost))), new Decimal(0))
    const nonConstructionCosts = totalCosts.minus(constructionCosts)
    if (constructionCosts.lte(0)) issues.push({ code: 'CONSTRUCTION_COST_MISSING', severity: 'CRITICAL', message: 'לא הוזנה עלות בנייה חיובית לתרחיש.' })
    /*
     * ── WHICH GROSS AREA THE SALEABLE AREA IS MEASURED AGAINST ────────────
     *
     * The profile's area register describes the property as it STANDS. A
     * scenario that adds area — every redevelopment route there is — sells
     * more than that by construction, so measuring against the profile's gross
     * made this CRITICAL fire on correct models and left no data entry that
     * could clear it: the register sums its GROSS rows, so adding a "planned"
     * row on top of the existing one produces a comparator that is the two
     * added together, which is not a number about anything.
     *
     * So the scenario's OWN gross is used when its unit mix states one. That
     * keeps the check meaningful — you still cannot sell more than the gross
     * you declared — while measuring it against the building the scenario
     * actually describes. The profile register remains the fallback for a mix
     * that does not state gross, which is where this check started.
     */
    const scenarioGrossArea = scenario.unitMix.reduce((sum, line) => sum.plus(read(line.grossAreaSqm).mul(line.unitCount)), new Decimal(0))
    const profileGrossArea = profile.areas.filter((area) => area.areaType === 'GROSS').reduce((sum, area) => sum.plus(read(area.valueSqm)), new Decimal(0))
    const grossArea = scenarioGrossArea.gt(0) ? scenarioGrossArea : profileGrossArea
    const grossAreaBasis = scenarioGrossArea.gt(0) ? 'SCENARIO_UNIT_MIX' : 'PROFILE_AREA_REGISTER'
    if (grossArea.gt(0) && totalSaleableArea.gt(grossArea)) {
      issues.push({
        code: 'SALEABLE_AREA_EXCEEDS_GROSS', severity: 'CRITICAL',
        message: `שטח המכירה הכולל (${totalSaleableArea.toFixed(2)} מ״ר) גדול מהשטח הברוטו (${grossArea.toFixed(2)} מ״ר, ${grossAreaBasis === 'SCENARIO_UNIT_MIX' ? 'לפי תמהיל התרחיש' : 'לפי מרשם השטחים של הפרופיל'}); נדרשת בדיקת תמהיל ושטחים.`,
      })
    }
    const mainAndServiceArea = profile.areas
      .filter((area) => area.areaType === 'MAIN' || area.areaType === 'SERVICE')
      .reduce((sum, area) => sum.plus(read(area.valueSqm)), new Decimal(0))
    const areaTolerance = profile.assumptions.find((assumption) => assumption.key === 'area-reconciliation-tolerance-sqm')?.value
    /*
     * This reconciliation is about the PROFILE's register being internally
     * consistent — does its own main plus service add up to its own gross —
     * so it reads the profile's gross and not the scenario-preferring
     * `grossArea` above. Comparing the existing building's main and service
     * against a scenario's PLANNED gross compares two different buildings,
     * and reports the difference between them as a data error.
     */
    if (profileGrossArea.gt(0) && mainAndServiceArea.gt(0)) {
      if (!areaTolerance) {
        issues.push({ code: 'AREA_RECONCILIATION_TOLERANCE_MISSING', severity: 'WARNING', message: 'קיימים שטח עיקרי ושירות לצד שטח ברוטו, אך לא הוגדרה הנחת area-reconciliation-tolerance-sqm לבדיקת ההתאמה.' })
      } else if (read(areaTolerance).lt(0)) {
        issues.push({ code: 'AREA_RECONCILIATION_TOLERANCE_INVALID', severity: 'CRITICAL', message: 'הנחת area-reconciliation-tolerance-sqm אינה יכולה להיות שלילית.' })
      } else if (mainAndServiceArea.minus(profileGrossArea).abs().gt(read(areaTolerance))) {
        issues.push({ code: 'AREA_RECONCILIATION_MISMATCH', severity: 'WARNING', message: 'סכום השטח העיקרי והשירות חורג מהשטח הברוטו מעבר לסף שהוגדר; בדקו הגדרות שטח ומקור.' })
      }
    }
    const requiredParking = profile.assumptions.find((assumption) => assumption.key === 'required-parking-spaces')?.value
    if (requiredParking) {
      if (read(requiredParking).lt(0)) {
        issues.push({ code: 'REQUIRED_PARKING_INVALID', severity: 'CRITICAL', message: 'הנחת required-parking-spaces אינה יכולה להיות שלילית.' })
      } else {
        const allocatedParking = scenario.unitMix.reduce((sum, line) => sum.plus(line.parkingSpaces), new Decimal(0))
        if (allocatedParking.lt(read(requiredParking))) issues.push({ code: 'PARKING_REQUIREMENT_NOT_MET', severity: 'WARNING', message: 'מספר החניות שהוקצה בתמהיל נמוך מדרישת החניה שהוגדרה.' })
      }
    }
    const rightsUnitCount = profile.planningRights.reduce((sum, right) => sum.plus(right.unitCount ?? 0), new Decimal(0))
    const replacementHoldings = scenario.compensations.filter((line) => read(line.replacementAreaSqm).gt(0) || read(line.replacementValue).gt(0))
    const replacementApartments = new Set(replacementHoldings.map((line) => line.ownerApartment?.apartmentId).filter((id): id is string => Boolean(id)))
    const replacementUnits = scenario.unitMix.filter((line) => line.disposition === 'OWNER_REPLACEMENT').reduce((sum, line) => sum + line.unitCount, 0)
    const allocationReferences = new Set<string>()
    const allocatedHoldings = new Set<string>()
    let allocationsComplete = true
    for (const line of scenario.unitMix) {
      const allocations: ReplacementAllocation[] = line.replacementAllocations
      if (line.disposition !== 'OWNER_REPLACEMENT') {
        if (allocations.length) {
          allocationsComplete = false
          issues.push({ code: 'REPLACEMENT_ALLOCATION_ON_SALE_UNITS', severity: 'CRITICAL', message: 'קיימות הקצאות תמורה על שורת תמהיל שאינה מסווגת כתמורה.', entityId: line.id })
        }
        continue
      }
      const summary = replacementAllocationSummary(allocations)
      if (summary.invalid || summary.incomplete || summary.overallocated || summary.unitCount !== line.unitCount) {
        allocationsComplete = false
        issues.push({ code: 'REPLACEMENT_ALLOCATION_INCOMPLETE', severity: 'CRITICAL', message: `הקצאות התמורה בשורה „${line.label}” אינן מכסות את מלוא הדירות והזכויות.`, entityId: line.id })
      }
      const lineReferences = new Set(allocations.map((allocation) => allocation.unitReference))
      for (const reference of lineReferences) {
        if (allocationReferences.has(reference)) {
          allocationsComplete = false
          issues.push({ code: 'REPLACEMENT_REFERENCE_DUPLICATE', severity: 'CRITICAL', message: `דירת התמורה „${reference}” מופיעה ביותר משורת תמהיל אחת.`, entityId: line.id })
        }
        allocationReferences.add(reference)
      }
      for (const allocation of allocations) allocatedHoldings.add(allocation.ownerApartmentId)
    }
    if (replacementHoldings.some((holding) => !allocatedHoldings.has(holding.ownerApartmentId))) {
      allocationsComplete = false
      issues.push({ code: 'REPLACEMENT_HOLDING_UNALLOCATED', severity: 'CRITICAL', message: 'קיימת תמורה בדירה לבעל זכויות ללא הקצאה פרטנית של דירת תמורה.' })
    }
    if (replacementHoldings.some((line) => !line.ownerApartment?.apartmentId)) {
      issues.push({ code: 'COMPENSATION_OWNERSHIP_LINK_MISSING', severity: 'CRITICAL', message: 'לחלק מדירות התמורה חסר קישור תקין לדירה במרשם הבעלות.' })
    }
    if (replacementUnits < replacementApartments.size) {
      issues.push({ code: 'REPLACEMENT_UNITS_BELOW_COMMITMENTS', severity: replacementUnits === 0 ? 'CRITICAL' : 'WARNING', message: `בתמהיל ${replacementUnits} דירות תמורה מול ${replacementApartments.size} דירות קיימות עם תמורה בדירה. יש לאמת הקצאות פרטניות; אין להניח יחס של דירה אחת לכל נכס. בעלים משותפים נספרים לפי דירה אחת.` })
    } else if (replacementUnits > 0 && replacementApartments.size === 0 && allocatedHoldings.size === 0) {
      issues.push({ code: 'REPLACEMENT_OWNERSHIP_EVIDENCE_MISSING', severity: 'CRITICAL', message: 'הוזנו דירות תמורה בתמהיל אך אין תמורות בדירה המקושרות למרשם הבעלות.' })
    } else if (replacementUnits > replacementApartments.size) {
      issues.push({ code: 'REPLACEMENT_ALLOCATION_REVIEW_REQUIRED', severity: 'WARNING', message: 'מספר דירות התמורה גדול ממספר הדירות הקיימות המקושרות. יש לאמת הקצאות פרטניות, לרבות יותר מדירת תמורה אחת לנכס.' })
    }
    const mixUnitCount = scenario.unitMix.reduce((sum, line) => sum.plus(line.unitCount), new Decimal(0))
    if (rightsUnitCount.gt(0) && mixUnitCount.gt(rightsUnitCount)) {
      issues.push({ code: 'UNIT_MIX_EXCEEDS_RIGHTS', severity: 'CRITICAL', message: 'מספר היחידות בתמהיל גדול ממספר היחידות בזכויות התכנון.' })
    }
    for (const line of [...scenario.unitMix, ...scenario.revenueLines, ...scenario.costLines]) {
      if (!line.sourceId && !line.isVerified) issues.push({ code: 'ECONOMIC_INPUT_SOURCE_MISSING', severity: 'WARNING', message: `לשורת המודל „${line.label}” חסר מקור או אישור מקצועי.`, entityId: line.id })
    }
    const evidenceRows = [...profile.parcels, ...profile.areas, ...profile.planningRights, ...scenario.revenueLines, ...scenario.costLines, ...profile.comparableTransactions.map((comparable) => ({ sourceId: comparable.sourceId, isVerified: false }))]
    const verifiedRows = evidenceRows.filter((row) => row.isVerified || row.sourceId).length
    const dataConfidenceScore = evidenceRows.length ? new Decimal(verifiedRows).div(evidenceRows.length).mul(100).toDecimalPlaces(1).toNumber() : 0
    const requiredProfitMargin = profile.assumptions.find((assumption) => assumption.key === 'required-developer-profit-margin')?.value
    const comparisonSubjectArea = profile.assumptions.find((assumption) => assumption.key === 'comparison-subject-area-sqm')?.value
    const comparableRates: Array<{ id: string; address: string; observedPricePerSqm: string; adjustmentFactor: string; adjustedPricePerSqm: string }> = []
    for (const comparable of profile.comparableTransactions) {
      const observedRate = read(comparable.transactionPrice).div(read(comparable.saleableAreaSqm))
      let factor = new Decimal(1)
      let valid = true
      for (const adjustment of comparable.adjustments) {
        const adjustmentFactor = read(adjustment.factor)
        if (adjustmentFactor.lte(0)) {
          issues.push({ code: 'COMPARABLE_ADJUSTMENT_FACTOR_INVALID', severity: 'CRITICAL', message: `לעסקת ההשוואה „${comparable.address}” יש מקדם התאמה שאינו חיובי.`, entityId: adjustment.id })
          valid = false
          break
        }
        factor = factor.mul(adjustmentFactor)
      }
      if (!comparable.sourceId) issues.push({ code: 'COMPARABLE_SOURCE_MISSING', severity: 'WARNING', message: `לעסקת ההשוואה „${comparable.address}” חסר מקור מקושר.`, entityId: comparable.id })
      if (valid) comparableRates.push({ id: comparable.id, address: comparable.address, observedPricePerSqm: amount(observedRate), adjustmentFactor: factor.toFixed(8), adjustedPricePerSqm: amount(observedRate.mul(factor)) })
    }
    const averageAdjustedComparableRate = comparableRates.length
      ? comparableRates.reduce((sum, comparable) => sum.plus(comparable.adjustedPricePerSqm), new Decimal(0)).div(comparableRates.length)
      : null
    const comparisonValue = averageAdjustedComparableRate && comparisonSubjectArea && read(comparisonSubjectArea).gt(0)
      ? averageAdjustedComparableRate.mul(read(comparisonSubjectArea))
      : null
    if (comparableRates.length > 0 && !comparisonSubjectArea) {
      issues.push({ code: 'COMPARISON_SUBJECT_AREA_MISSING', severity: 'WARNING', message: 'הוזנו עסקאות השוואה אך חסרה הנחת שטח נושא השומה לצורך חישוב שווי בגישת השוואה.' })
    }
    if (comparableRates.length > 0 && comparableRates.length < 3) {
      issues.push({ code: 'COMPARABLE_SAMPLE_THIN', severity: 'WARNING', message: 'מדגם עסקאות ההשוואה כולל פחות משלוש עסקאות; נדרשת בחינה מקצועית של מספקות המדגם.' })
    }
    for (const comparable of profile.comparableTransactions) {
      if (comparable.transactionDate > profile.valuationDate) {
        issues.push({ code: 'COMPARABLE_AFTER_VALUATION_DATE', severity: 'WARNING', message: `עסקת ההשוואה „${comparable.address}” מאוחרת לתאריך הקובע ומחייבת התאמת זמן או החרגה.`, entityId: comparable.id })
      }
    }
    const outlierThreshold = profile.assumptions.find((assumption) => assumption.key === 'comparable-outlier-threshold')?.value
    if (outlierThreshold && (read(outlierThreshold).lt(0) || read(outlierThreshold).gte(1))) {
      issues.push({ code: 'COMPARABLE_OUTLIER_THRESHOLD_INVALID', severity: 'CRITICAL', message: 'הנחת comparable-outlier-threshold חייבת להיות שבר בין 0 ל־1.' })
    } else if (outlierThreshold && averageAdjustedComparableRate) {
      for (const comparable of comparableRates) {
        const deviation = new Decimal(comparable.adjustedPricePerSqm).div(averageAdjustedComparableRate).minus(1).abs()
        if (deviation.gt(read(outlierThreshold))) {
          issues.push({ code: 'COMPARABLE_ADJUSTED_PRICE_OUTLIER', severity: 'WARNING', message: `מחיר העסקה המתואם „${comparable.address}” חורג מסף החריגות שהוגדר.`, entityId: comparable.id })
        }
      }
    }
    const landCosts = scenario.costLines.filter((line) => line.category === 'LAND').reduce((sum, line) => sum.plus(line.fixedAmount ? read(line.fixedAmount) : read(line.quantity).mul(read(line.unitCost))), new Decimal(0))
    let requiredDeveloperProfit: Decimal | null = null
    let residualLandValue: Decimal | null = null
    if (!requiredProfitMargin) {
      issues.push({ code: 'REQUIRED_DEVELOPER_PROFIT_MARGIN_MISSING', severity: 'WARNING', message: 'חסרה הנחת יעד required-developer-profit-margin; שווי שיורי ומסקנת כדאיות אינם סופיים.' })
    } else if (read(requiredProfitMargin).lt(0) || read(requiredProfitMargin).gt(1)) {
      issues.push({ code: 'REQUIRED_DEVELOPER_PROFIT_MARGIN_INVALID', severity: 'CRITICAL', message: 'הנחת יעד רווח יזמי חייבת להיות שבר בין 0 ל־1.' })
    } else {
      requiredDeveloperProfit = totalRevenueBasis.mul(read(requiredProfitMargin))
      // Residual value treats land as the balancing value. Any existing LAND
      // cost is removed first so it is never subtracted twice.
      //
      // Measured on the gross basis, so the answer is the TOTAL consideration
      // the land can carry — cash and flats together — which is the number a
      // negotiator compares against an asking price. On the net basis it
      // silently answered a different question: how much CASH is affordable
      // once the flats have already been given away for nothing.
      residualLandValue = totalRevenueBasis.minus(totalCosts.minus(landCosts)).minus(requiredDeveloperProfit)
    }
    const hasCritical = issues.some((issue) => issue.severity === 'CRITICAL')
    const feasibilityStatus = hasCritical ? 'DATA_INCOMPLETE' : residualLandValue === null || requiredDeveloperProfit === null ? 'CONDITIONAL' : residualLandValue.gte(0) && projectProfit.gte(requiredDeveloperProfit) ? 'FEASIBLE' : 'NOT_FEASIBLE'
    const criticalCount = issues.filter((issue) => issue.severity === 'CRITICAL').length
    const warningCount = issues.filter((issue) => issue.severity === 'WARNING').length
    return {
      engineVersion: '1.1.0', currency: 'ILS', vatBasis: 'VAT_EXCLUDED',
      unitSummary: {
        totalUnits: scenario.unitMix.reduce((sum, line) => sum + line.unitCount, 0),
        developerSaleUnits: scenario.unitMix.filter((line) => line.disposition === 'DEVELOPER_SALE').reduce((sum, line) => sum + line.unitCount, 0),
        ownerReplacementUnits: scenario.unitMix.filter((line) => line.disposition === 'OWNER_REPLACEMENT').reduce((sum, line) => sum + line.unitCount, 0),
        retainedUnits: scenario.unitMix.filter((line) => line.disposition === 'RETAINED').reduce((sum, line) => sum + line.unitCount, 0),
        unclassifiedUnits: scenario.unitMix.filter((line) => !line.disposition || line.disposition === 'UNCLASSIFIED').reduce((sum, line) => sum + line.unitCount, 0),
        replacementHoldingCount: replacementHoldings.length,
        replacementExistingApartmentCount: replacementApartments.size,
        replacementAllocationsComplete: allocationsComplete,
        allocatedReplacementUnits: allocationReferences.size,
      },
      scenario: { id: scenario.id, name: scenario.name, kind: scenario.kind, isBaseline: scenario.isBaseline },
      revenue: {
        lines: revenue,
        /** What the developer sells. Excludes anything handed over as consideration. */
        total: amount(totalRevenue),
        /** Everything built, at market — including units given to the seller. */
        totalWithConsiderationInKind: amount(totalRevenueBasis),
      },
      costs: {
        lines: costs,
        /** Cash and accrual costs — the figure the cash flow reconciles against. */
        total: amount(totalCosts),
        /** Market value of consideration given in kind. Zero unless the deal pays partly in flats. */
        considerationInKind: amount(considerationInKind),
        /** `total` plus consideration in kind: what the project really cost, and the ROC denominator. */
        totalWithConsiderationInKind: amount(totalCostBasis),
      },
      compensation: { lines: compensation, directCashCost: amount(compensation.reduce((sum, line) => sum.plus(line.amount), new Decimal(0))) },
      financing: {
        accumulatedInterest: amount(accumulatedInterest), financingFees: amount(financingFees),
        peakDebt: amount(peakDebt), debtBalance: amount(outstandingDebt),
        measuredDebt: amount(measuredDebt), measuredDebtBasis,
        actualLtc: actualLtc ? actualLtc.toFixed(8) : null, ltcLimit: ltcLimit ? ltcLimit.toFixed(8) : null,
        actualLtv: actualLtv ? actualLtv.toFixed(8) : null, ltvLimit: ltvLimit ? ltvLimit.toFixed(8) : null,
        graceMonths, graceAppliedFrom: graceMonths > 0 ? firstDrawdownPeriod : null,
        financingMonths, financingTermUsedMonths,
        committedEquity: committedEquity ? amount(committedEquity) : null,
        equityInvested: amount(equityInvested),
        equityFundingGap: equityFundingGap ? amount(equityFundingGap) : null,
      },
      profitability: {
        profit: amount(projectProfit),
        profitBeforeFinancing: amount(profitBeforeFinancing),
        profitOnCost: totalCostBasis.gt(0) ? projectProfit.div(totalCostBasis).toFixed(8) : null,
        /** The old cash-only ratio, kept beside it so the gap is visible rather than silent. */
        profitOnCashCost: totalCosts.gt(0) ? projectProfit.div(totalCosts).toFixed(8) : null,
        profitMargin: actualProfitMargin ? actualProfitMargin.toFixed(8) : null,
        isFinal: false,
      },
      returns: {
        basis: axisIsUniform ? 'PERIODIC_MONTHLY' : 'ACTUAL_DAYS_365',
        projectIrrMonthly: projectIrrMonthly?.toFixed(10) ?? null,
        projectIrrAnnual: projectIrrAnnual?.toFixed(10) ?? null,
        projectXirrAnnual: projectXirrAnnual?.toFixed(10) ?? null,
        equityIrrMonthly: equityIrrMonthly?.toFixed(10) ?? null,
        equityIrrAnnual: equityIrrAnnual?.toFixed(10) ?? null,
        equityXirrAnnual: equityXirrAnnual?.toFixed(10) ?? null,
        discountRateAnnual: annualDiscountRate?.toString() ?? null,
        projectNpv: projectNpv ? amount(projectNpv) : null,
        equityNpv: equityNpv ? amount(equityNpv) : null,
        equityInvested: amount(equityInvested),
        equityDistributed: amount(equityDistributed),
        equityMultiple: equityInvested.gt(0) ? equityDistributed.div(equityInvested).toFixed(8) : null,
      },
      breakEven: {
        revenueRequired: amount(totalCosts),
        salePricePerSqm: totalSaleableArea.gt(0) ? amount(totalCosts.div(totalSaleableArea)) : null,
        constructionCostPerUnit: constructionQuantity.gt(0) ? amount(totalRevenue.minus(nonConstructionCosts).div(constructionQuantity)) : null,
        saleableAreaSqm: totalSaleableArea.gt(0) ? totalSaleableArea.toFixed(4) : null,
      },
      valuation: {
        requiredDeveloperProfitMargin: requiredProfitMargin?.toString() ?? null,
        requiredDeveloperProfit: requiredDeveloperProfit ? amount(requiredDeveloperProfit) : null,
        residualLandValue: residualLandValue ? amount(residualLandValue) : null,
        comparison: {
          comparableCount: comparableRates.length,
          averageAdjustedPricePerSqm: averageAdjustedComparableRate ? amount(averageAdjustedComparableRate) : null,
          subjectAreaSqm: comparisonSubjectArea?.toString() ?? null,
          value: comparisonValue ? amount(comparisonValue) : null,
          method: 'ממוצע פשוט של מחירי השוואה מתואמים למ״ר × שטח נושא השומה',
          comparables: comparableRates,
        },
      },
      feasibility: { status: feasibilityStatus, isFinal: false },
      // Presentation receives a bounded, non-sensitive explanation of the
      // server calculation. Snapshots retain this alongside the numbers, so a
      // future report can be reproduced without recalculating historical data.
      traceability: {
        revenue: { formula: 'Σ שורות הכנסה', amount: amount(totalRevenue), inputs: revenue },
        costs: { formula: 'Σ עלויות ישירות + תמורות מזומן + ריבית מחושבת', amount: amount(totalCosts), inputs: costs },
        profit: { formula: 'סך הכנסות − סך עלויות כולל מימון', amount: amount(projectProfit) },
        residualLandValue: residualLandValue === null ? null : {
          formula: 'הכנסות − (עלויות ללא קרקע) − יעד רווח יזמי',
          amount: amount(residualLandValue),
          requiredDeveloperProfit: amount(requiredDeveloperProfit!),
        },
        comparison: comparisonValue === null ? null : {
          formula: 'ממוצע מחירי השוואה מתואמים למ״ר × שטח נושא השומה',
          amount: amount(comparisonValue),
          averageAdjustedPricePerSqm: amount(averageAdjustedComparableRate!),
          subjectAreaSqm: comparisonSubjectArea!.toString(),
        },
      },
      cashFlow: {
        periods: cashFlow,
        peakFundingRequirement: amount(peakNegative.abs()),
        reconciliationComplete: !issues.some((issue) => issue.code === 'CASH_FLOW_ALLOCATION_MISSING' || issue.code === 'CASH_FLOW_RECONCILIATION_MISMATCH'),
      },
      dataQuality: {
        criticalCount, warningCount, confidenceScore: dataConfidenceScore,
        scoreBasis: 'SOURCE_OR_VERIFICATION_COVERAGE',
        evidenceRowCount: evidenceRows.length,
        sourceLinkedRowCount: evidenceRows.filter((row) => Boolean(row.sourceId)).length,
        professionallyVerifiedRowCount: evidenceRows.filter((row) => row.isVerified).length,
      },
      validation: issues,
    }
  }

  /**
   * מחיל מקדמי רגישות על *הקלט* ומחזיר עותק מותאם.
   *
   * זה הלב של P0-2. הגרסה הקודמת הכפילה את הפלט הקפוא של חישוב הבסיס,
   * ולכן פספסה בהגדרה כל דבר שאינו יחס ליניארי: ריבית על יתרה שהשתנתה,
   * עלות אחוזית שבסיסה זז, התייקרות שנגזרת מהוצאה שגדלה, חריגה מ-LTC
   * שנוצרה רק בתרחיש הרגיש, ורווח שנשחק עד כדי שינוי מסקנת הכדאיות.
   *
   * כאן מותאם הקלט והמנוע רץ מחדש במלואו, ולכן כל אלה נכללים מעצמם.
   * הקצאות התזרים מותאמות יחד עם השורות שלהן, כדי שהפיוס יישאר תקף.
   */
  private applySensitivityFactors(profile: LoadedFeasibilityProfile, scenario: LoadedFeasibilityScenario, factors: Map<string, Decimal>) {
    const sale = factors.get('SALE_PRICE') ?? null
    const construction = factors.get('CONSTRUCTION_COST') ?? null
    const land = factors.get('LAND_COST') ?? null
    /*
     * `TOTAL_CONSIDERATION` moves what the seller receives, whatever form it
     * takes: the LAND cost lines AND the consideration in kind, by the same
     * factor and together. Moving one without the other would answer a
     * question nobody asked — "how much cash can I afford if the flats stay
     * fixed" — and in a combination deal the two are negotiated as one number.
     */
    const consideration = factors.get('TOTAL_CONSIDERATION') ?? null
    const interest = factors.get('INTEREST_RATE') ?? null
    const discount = factors.get('DISCOUNT_RATE') ?? null
    const scale = (value: { toString(): string } | null | undefined, factor: Decimal | null) => value === null || value === undefined || !factor ? value : read(value).mul(factor).toString()
    const combine = (a: Decimal | null, b: Decimal | null) => a && b ? a.mul(b) : a ?? b
    const costFactorFor = (category: string) => category === 'CONSTRUCTION' ? construction : category === 'LAND' ? combine(land, consideration) : null
    const costFactorByLineId = new Map(scenario.costLines.map((line) => [line.id, costFactorFor(line.category)]))

    const adjustedProfile = discount
      ? { ...profile, assumptions: profile.assumptions.map((assumption) => assumption.key === 'annual-discount-rate' ? { ...assumption, value: scale(assumption.value, discount) } : assumption) }
      : profile

    const adjustedScenario = {
      ...scenario,
      unitMix: scenario.unitMix.map((line) => ({
        ...line,
        fixedUnitPrice: scale(line.fixedUnitPrice, sale), pricePerSqm: scale(line.pricePerSqm, sale),
        parkingPrice: scale(line.parkingPrice, sale), balconyPricePerSqm: scale(line.balconyPricePerSqm, sale),
        storagePricePerSqm: scale(line.storagePricePerSqm, sale),
      })),
      revenueLines: scenario.revenueLines.map((line) => ({
        ...line,
        // שטחים ושיעורי היוון אינם מחיר ואינם מוזזים; רק המחיר עצמו.
        pricePerSqm: scale(line.pricePerSqm, sale), fixedUnitPrice: scale(line.fixedUnitPrice, sale),
        annualNoi: scale(line.annualNoi, sale),
      })),
      costLines: scenario.costLines.map((line) => {
        const factor = costFactorByLineId.get(line.id) ?? null
        return factor ? { ...line, unitCost: scale(line.unitCost, factor), fixedAmount: scale(line.fixedAmount, factor) } : line
      }),
      cashFlowAllocations: scenario.cashFlowAllocations.map((allocation) => {
        const factor = allocation.sourceKind === 'REVENUE' ? sale
          : allocation.sourceKind === 'COST' && allocation.sourceLineId ? costFactorByLineId.get(allocation.sourceLineId) ?? null
          : null
        return factor ? { ...allocation, amount: scale(allocation.amount, factor) } : allocation
      }),
      financing: scenario.financing && interest
        ? { ...scenario.financing, annualInterestRate: scale(scenario.financing.annualInterestRate, interest) }
        : scenario.financing,
      considerationInKind: consideration ? scale(scenario.considerationInKind, consideration) : scenario.considerationInKind,
    }

    return { profile: adjustedProfile as LoadedFeasibilityProfile, scenario: adjustedScenario as LoadedFeasibilityScenario }
  }

  /**
   * Solve for the input that hits a target — the inverse of the grid above.
   *
   * ── WHY BISECTION AND NOT A FORMULA ────────────────────────────────────
   *
   * There is no closed form. The metric depends on the full engine run:
   * interest capitalises on a balance the change itself moved, percentage
   * costs sit on a base that shifted, an LTC covenant can trip part-way
   * through the range. Inverting any of that analytically would mean a second
   * model of the engine, which would then disagree with it. So the engine is
   * run, repeatedly, and the answer is whichever input it actually produces.
   *
   * ── WHY THE SEARCH IS BOUNDED, AND WHY FAILURE IS REPORTED ─────────────
   *
   * An unbounded search always finds something. A sale price 40x the base
   * clears almost any profit target, and returning it as "the answer" states
   * a falsehood in the language of a solution. The range is capped, and a
   * target outside it comes back `converged: false` with the range searched
   * and the closest value reached — an honest "not within these bounds"
   * rather than a number nobody should act on.
   *
   * Non-monotonic metrics get the same treatment: bracketing looks for a real
   * sign change and refuses to interpolate across one it never found.
   *
   * ── WHY THE ANSWER CARRIES THE ISSUES IT CREATES ───────────────────────
   *
   * Reaching a profit target by moving a price can breach an LTC covenant or
   * leave debt unrepaid. Those are findings ABOUT the solution, and a solver
   * that returned the number without them would be handing over a plan whose
   * cost is recorded somewhere the reader was not looking.
   */
  async goalSeek(projectId: string, scenarioId: string, dto: CreateGoalSeekDto, tenantId: string) {
    const { profile, scenario } = await this.load(projectId, scenarioId, tenantId)
    const base = this.compute(profile, scenario)

    const target = new Decimal(dto.targetValue)
    const maxChange = new Decimal(dto.maxChangePercent ?? '300')
    if (maxChange.lte(0)) {
      throw DomainError.validation('FEASIBILITY_GOAL_SEEK_RANGE_INVALID', 'טווח החיפוש חייב להיות חיובי', 'maxChangePercent')
    }

    const baseValue = readMetric(base, dto.targetMetric)
    if (baseValue === null) {
      // e.g. profit-on-cost with no costs, or IRR on a cash flow that never
      // turns positive. Solving towards a target the base cannot even express
      // would mean inventing the starting point.
      throw DomainError.validation(
        'FEASIBILITY_GOAL_SEEK_METRIC_UNAVAILABLE',
        `המדד המבוקש אינו מוגדר בתרחיש הבסיס, ולכן אי אפשר לחתור אליו`,
        'metric',
      )
    }

    /** The metric after moving the chosen input by `changePercent`. */
    const evaluateAt = (changePercent: Decimal) => {
      const factor = new Decimal(1).plus(changePercent.div(100))
      const adjusted = this.applySensitivityFactors(profile, scenario, new Map([[GOAL_SEEK_LEVER[dto.solveFor], factor]]))
      const result = this.compute(adjusted.profile, adjusted.scenario)
      return { result, value: readMetric(result, dto.targetMetric) }
    }

    /*
     * Bracket first. Step outward from the base in both directions until the
     * difference changes sign; only then is there something to bisect. The
     * steps are coarse on purpose — this is looking for a crossing, not
     * precision, and every step is a full engine run.
     */
    const STEPS = 24
    const step = maxChange.div(STEPS)
    let lo: { change: Decimal; value: Decimal } | null = null
    let hi: { change: Decimal; value: Decimal } | null = null
    let closest: { change: Decimal; value: Decimal } = { change: new Decimal(0), value: baseValue }
    let evaluations = 1

    const consider = (change: Decimal) => {
      const { value } = evaluateAt(change)
      evaluations += 1
      if (value === null) return
      if (value.minus(target).abs().lt(closest.value.minus(target).abs())) closest = { change, value }
      const point = { change, value }
      if (value.minus(target).isZero()) { lo = point; hi = point; return }
      if (baseValue.lt(target) ? value.gte(target) : value.lte(target)) {
        if (!hi || change.abs().lt(hi.change.abs())) hi = point
      } else if (!lo || change.abs().gt(lo.change.abs())) {
        lo = point
      }
    }

    if (baseValue.minus(target).isZero()) {
      return this.goalSeekResult(profile, scenario, dto, base, base, new Decimal(0), baseValue, baseValue, target, true, 'ALREADY_AT_TARGET', maxChange, 1)
    }

    lo = { change: new Decimal(0), value: baseValue }
    for (let i = 1; i <= STEPS && !hi; i += 1) {
      consider(step.mul(i))
      if (!hi) consider(step.mul(-i))
    }

    if (!hi) {
      const { result } = evaluateAt(closest.change)
      return this.goalSeekResult(
        profile, scenario, dto, base, result, closest.change, baseValue, closest.value, target, false,
        'UNREACHABLE_WITHIN_RANGE', maxChange, evaluations,
      )
    }

    /*
     * Bisect between the last point on the base's side and the first point
     * past the target. 40 halvings take a 300% range below 1e-9, far under any
     * tolerance that matters for a price per square metre.
     */
    let low = (lo as { change: Decimal; value: Decimal }).change
    let high = (hi as { change: Decimal; value: Decimal }).change
    let best = hi as { change: Decimal; value: Decimal }
    for (let i = 0; i < 40; i += 1) {
      const mid = low.plus(high).div(2)
      const { value } = evaluateAt(mid)
      evaluations += 1
      if (value === null) break
      best = { change: mid, value }
      if (value.minus(target).isZero()) break
      if (baseValue.lt(target) ? value.lt(target) : value.gt(target)) low = mid
      else high = mid
    }

    const solved = evaluateAt(best.change)
    return this.goalSeekResult(
      profile, scenario, dto, base, solved.result, best.change, baseValue, solved.value ?? best.value, target, true,
      'CONVERGED', maxChange, evaluations,
    )
  }

  /**
   * The solver works in percentage change, because that is the only language
   * every lever shares. But "raise the price 4.17%" is not what a price list
   * says — an appraiser needs ₪/sqm. This turns the converged factor back into
   * the absolute input it stands for, and refuses to invent one when the
   * scenario has no single base to scale.
   *
   * A scenario whose sale units carry two different ₪/sqm has no one price to
   * report; the per-line breakdown is always returned, and `solvedValue` is
   * null with `basis` saying why. Lines priced by `fixedUnitPrice` are counted
   * separately for the same reason — they move with the lever but are not a
   * price per square metre.
   */
  private resolveSolvedInput(
    profile: LoadedFeasibilityProfile,
    scenario: LoadedFeasibilityScenario,
    solveFor: CreateGoalSeekDto['solveFor'],
    factor: Decimal,
  ): { unit: string; basis: string; baseValue: string | null; solvedValue: string | null; perLine: Array<{ lineId: string; label: string; baseValue: string; solvedValue: string }> } {
    const scaled = (value: { toString(): string } | null | undefined) =>
      value === null || value === undefined ? null : read(value).mul(factor)

    if (solveFor === 'pricePerSqm') {
      const saleLines = scenario.unitMix.filter((line) => line.disposition === 'DEVELOPER_SALE')
      const priced = saleLines.filter((line) => line.pricePerSqm !== null && line.pricePerSqm !== undefined)
      const perLine = priced.map((line) => ({
        lineId: line.id,
        label: line.label,
        // 2dp, not more: bisection stops once the METRIC stops moving at the
        // engine's own 8dp, which leaves the price known to ~1e-4. Printing
        // 31249.9999 would claim a precision the search never had — and read
        // as a different number from the 31250 it actually means.
        baseValue: read(line.pricePerSqm!).toFixed(2),
        solvedValue: scaled(line.pricePerSqm)!.toFixed(2),
      }))
      const distinct = new Set(perLine.map((line) => line.baseValue))
      const fixedPriced = saleLines.filter((line) => (line.pricePerSqm === null || line.pricePerSqm === undefined) && line.fixedUnitPrice !== null && line.fixedUnitPrice !== undefined).length
      const basis = perLine.length === 0
        ? 'NO_PRICE_PER_SQM_LINES'
        : distinct.size > 1
          ? 'MULTIPLE_BASE_PRICES'
          : fixedPriced > 0
            ? 'SINGLE_BASE_PRICE_WITH_FIXED_PRICED_LINES'
            : 'SINGLE_BASE_PRICE'
      return {
        unit: '₪/מ״ר',
        basis,
        baseValue: distinct.size === 1 ? perLine[0].baseValue : null,
        solvedValue: distinct.size === 1 ? perLine[0].solvedValue : null,
        perLine,
      }
    }

    if (solveFor === 'interestRate' || solveFor === 'discountRate') {
      const base = solveFor === 'interestRate'
        ? scenario.financing?.annualInterestRate ?? null
        : profile.assumptions.find((assumption) => assumption.key === 'annual-discount-rate')?.value ?? null
      return {
        unit: 'שבר עשרוני שנתי',
        basis: base === null ? 'RATE_NOT_SET' : 'ANNUAL_RATE',
        baseValue: base === null ? null : read(base).toString(),
        solvedValue: base === null ? null : scaled(base)!.toString(),
        perLine: [],
      }
    }

    if (solveFor === 'totalConsideration') {
      // Cash and in kind together, because that is the single number the
      // seller is offered and the only one the two sides negotiate.
      const cash = scenario.costLines
        .filter((line) => line.category === 'LAND')
        .reduce((sum, line) => sum.plus(line.fixedAmount ? read(line.fixedAmount) : read(line.quantity).mul(read(line.unitCost))), new Decimal(0))
      const inKind = scenario.considerationInKind ? read(scenario.considerationInKind) : new Decimal(0)
      const base = cash.plus(inKind)
      if (base.lte(0)) {
        return { unit: '₪', basis: 'NO_CONSIDERATION_RECORDED', baseValue: null, solvedValue: null, perLine: [] }
      }
      return {
        unit: '₪',
        basis: inKind.gt(0) ? 'CASH_PLUS_IN_KIND' : 'CASH_ONLY',
        baseValue: base.toFixed(2),
        solvedValue: base.mul(factor).toFixed(2),
        perLine: [
          { lineId: 'cash', label: 'מזומן', baseValue: cash.toFixed(2), solvedValue: cash.mul(factor).toFixed(2) },
          { lineId: 'in-kind', label: 'תמורה בשווה־כסף', baseValue: inKind.toFixed(2), solvedValue: inKind.mul(factor).toFixed(2) },
        ],
      }
    }

    if (solveFor === 'constructionCost' || solveFor === 'landCost') {
      const category = solveFor === 'constructionCost' ? 'CONSTRUCTION' : 'LAND'
      // Percentage-driven lines are not scaled by the lever, so they are not
      // part of the number the lever moves.
      const lines = scenario.costLines.filter((line) => line.category === category && (line.fixedAmount || line.unitCost))
      if (lines.length === 0) {
        return { unit: '₪', basis: 'NO_SCALABLE_COST_LINES_IN_CATEGORY', baseValue: null, solvedValue: null, perLine: [] }
      }
      const perLine = lines.map((line) => {
        const amount = line.fixedAmount ? read(line.fixedAmount) : read(line.quantity).mul(read(line.unitCost))
        return { lineId: line.id, label: line.label, baseValue: amount.toFixed(2), solvedValue: amount.mul(factor).toFixed(2) }
      })
      const total = perLine.reduce((sum, line) => sum.plus(line.baseValue), new Decimal(0))
      return { unit: '₪', basis: 'CATEGORY_TOTAL', baseValue: total.toFixed(2), solvedValue: total.mul(factor).toFixed(2), perLine }
    }

    // salePrice moves every revenue input at once; there is no single number.
    return { unit: '—', basis: 'FACTOR_ONLY', baseValue: null, solvedValue: null, perLine: [] }
  }

  /**
   * Solve the drawdown and repayment a financing term sheet implies.
   *
   * ── THE CIRCULARITY, STATED ONCE ──────────────────────────────────────
   *
   *   draw -> interest -> capitalised in grace -> peak debt -> LTC numerator
   *                    \-> total costs ----------------------> LTC denominator
   *   draw + capitalised interest -> closing balance -> repayment
   *
   * Neither leg has a closed form, and both were previously closed by hand:
   * run, read the breach, adjust, run again. Two rounds per scenario.
   *
   * ── HOW IT IS SOLVED ──────────────────────────────────────────────────
   *
   * Two nested loops over the SAME `compute()` the rest of the engine uses,
   * for the same reason goal seek bisects instead of inverting: a formula here
   * would be a second model, and a second model eventually disagrees with the
   * first one.
   *
   *   inner — given a draw, the repayment is a fixed point. Guess it, read the
   *           leftover `debtBalance`, add it, repeat. Converges in two or
   *           three passes because each pass only leaves the interest that
   *           accrued on the previous correction.
   *
   *   outer — bisect the draw. LTC rises with the draw (the numerator moves
   *           with it directly, the denominator only through interest), so a
   *           sign change between a zero draw and a draw the size of the cost
   *           base is a real bracket rather than a lucky one.
   *
   * ── WHAT IT DOES NOT DO ───────────────────────────────────────────────
   *
   * It does not write. The solved schedule is returned next to the schedule
   * the scenario currently holds, and replacing one with the other is a
   * decision, not a side effect of asking the question.
   */
  async solveFinancing(projectId: string, scenarioId: string, dto: SolveFinancingDto, tenantId: string) {
    const { profile, scenario } = await this.load(projectId, scenarioId, tenantId)
    const base = this.compute(profile, scenario)

    const targetLtc = dto.targetLtc ? new Decimal(dto.targetLtc) : scenario.financing?.ltc ? read(scenario.financing.ltc) : null
    if (!targetLtc) {
      throw DomainError.validation(
        'FEASIBILITY_FINANCING_SOLVE_TARGET_MISSING',
        'אין מגבלת LTC בתרחיש ולא נמסרה מגבלה לפתרון; אין למה לחתור',
        'targetLtc',
      )
    }
    if (targetLtc.lte(0) || targetLtc.gt(1)) {
      throw DomainError.validation('FEASIBILITY_FINANCING_SOLVE_TARGET_INVALID', 'מגבלת LTC חייבת להיות שבר גדול מ־0 ולא גדול מ־1', 'targetLtc')
    }

    const monthOf = (value: Date | string) => `${new Date(value).toISOString().slice(0, 7)}-01`
    const debtAllocations = scenario.cashFlowAllocations.filter((allocation) => allocation.sourceKind === 'DEBT')
    const existingDraws = debtAllocations.filter((allocation) => allocation.direction === 'INFLOW')
    const existingRepayments = debtAllocations.filter((allocation) => allocation.direction === 'OUTFLOW')
    const drawPeriod = dto.drawPeriod ? monthOf(dto.drawPeriod) : existingDraws.map((a) => monthOf(a.periodStart)).sort()[0] ?? null
    const repaymentPeriod = dto.repaymentPeriod ? monthOf(dto.repaymentPeriod) : existingRepayments.map((a) => monthOf(a.periodStart)).sort().reverse()[0] ?? null
    if (!drawPeriod || !repaymentPeriod) {
      throw DomainError.validation(
        'FEASIBILITY_FINANCING_SOLVE_PERIODS_MISSING',
        'אין בתרחיש משיכת חוב ו/או פירעון חוב, ולא נמסרו מועדים; מתי נמשך הכסף ומתי הוא נפרע אינם נגזרים מהקובננט',
        'drawPeriod',
      )
    }
    if (repaymentPeriod <= drawPeriod) {
      throw DomainError.validation('FEASIBILITY_FINANCING_SOLVE_PERIODS_INVALID', 'מועד הפירעון חייב להיות אחרי מועד המשיכה', 'repaymentPeriod')
    }

    /** The scenario with every DEBT allocation replaced by exactly this one draw and this one repayment. */
    const withSchedule = (draw: Decimal, repayment: Decimal) => ({
      ...scenario,
      cashFlowAllocations: [
        ...scenario.cashFlowAllocations.filter((allocation) => allocation.sourceKind !== 'DEBT'),
        { ...(existingDraws[0] ?? debtAllocations[0] ?? scenario.cashFlowAllocations[0]), id: 'solve:draw', sourceKind: 'DEBT', direction: 'INFLOW', sourceLineId: null, periodStart: new Date(`${drawPeriod}T00:00:00.000Z`), amount: draw.toFixed(2) },
        { ...(existingRepayments[0] ?? debtAllocations[0] ?? scenario.cashFlowAllocations[0]), id: 'solve:repayment', sourceKind: 'DEBT', direction: 'OUTFLOW', sourceLineId: null, periodStart: new Date(`${repaymentPeriod}T00:00:00.000Z`), amount: repayment.toFixed(2) },
      ],
    }) as LoadedFeasibilityScenario

    let computeRuns = 1
    /*
     * Close the balance for a given draw. The repayment starts at the draw
     * itself and absorbs whatever the engine reports as left over, which on
     * the first pass is the grace interest and on the second is the interest
     * that accrued on that interest.
     */
    const closeBalance = (draw: Decimal) => {
      let repayment = draw
      let result = this.compute(profile, withSchedule(draw, repayment))
      computeRuns += 1
      let passes = 1
      for (; passes <= FINANCING_SOLVE_MAX_INNER_PASSES; passes += 1) {
        const balance = read(result.financing.debtBalance)
        if (balance.abs().lte(DEBT_ROUNDING_TOLERANCE)) break
        repayment = repayment.plus(balance)
        result = this.compute(profile, withSchedule(draw, repayment))
        computeRuns += 1
      }
      return { draw, repayment, result, passes, closed: read(result.financing.debtBalance).abs().lte(DEBT_ROUNDING_TOLERANCE) }
    }

    const ltcOf = (result: ReturnType<FeasibilityCalculationService['compute']>) => {
      const costs = read(result.costs.total)
      return costs.gt(0) ? read(result.financing.peakDebt).div(costs) : new Decimal(0)
    }

    /*
     * The upper bracket is the cost base itself. A draw that size produces an
     * LTC of at least 1 — the numerator is that draw plus whatever interest
     * capitalises on it, the denominator is the same cost base plus the same
     * interest — and `targetLtc` is capped at 1. So with a valid target the
     * bracket always exists, and the guard below is defensive rather than a
     * case the caller can reach: it exists so that a future change to how the
     * ratio is measured surfaces as an honest "not reachable" instead of a
     * bisection over a bracket that was never there.
     */
    let high = read(base.costs.total)
    let low = new Decimal(0)
    let best = closeBalance(high)
    let outer = 1
    if (ltcOf(best.result).lt(targetLtc)) {
      return this.financingSolveResult(base, best, targetLtc, ltcOf(best.result), drawPeriod, repaymentPeriod, high, 'UNREACHABLE_WITHIN_COST_BASE', outer, computeRuns)
    }

    for (; outer <= FINANCING_SOLVE_MAX_OUTER_PASSES; outer += 1) {
      const mid = low.plus(high).div(2)
      const attempt = closeBalance(mid)
      best = attempt
      const achieved = ltcOf(attempt.result)
      if (achieved.gt(targetLtc)) high = mid
      else low = mid
      // A bracket narrower than an agora cannot move the schedule any more:
      // both amounts are reported to the agora, and halving past that would
      // only be spending engine runs to print the same two numbers.
      if (high.minus(low).lte(DEBT_ROUNDING_TOLERANCE)) break
    }

    // Land on the low side: it is the one that satisfies the covenant rather
    // than the one that sits a fraction above it. An LTC solver that returns a
    // breach has answered the wrong question.
    const solution = closeBalance(low)
    const achievedLtc = ltcOf(solution.result)
    return this.financingSolveResult(
      base, solution, targetLtc, achievedLtc, drawPeriod, repaymentPeriod, read(base.costs.total),
      solution.closed && achievedLtc.lte(targetLtc) ? 'CONVERGED' : 'NOT_CONVERGED', outer, computeRuns,
    )
  }

  private financingSolveResult(
    base: ReturnType<FeasibilityCalculationService['compute']>,
    solved: { draw: Decimal; repayment: Decimal; result: ReturnType<FeasibilityCalculationService['compute']>; passes: number; closed: boolean },
    targetLtc: Decimal,
    achievedLtc: Decimal,
    drawPeriod: string,
    repaymentPeriod: string,
    searchedUpTo: Decimal,
    status: 'CONVERGED' | 'NOT_CONVERGED' | 'UNREACHABLE_WITHIN_COST_BASE',
    outerPasses: number,
    computeRuns: number,
  ) {
    const converged = status === 'CONVERGED'
    const result = solved.result
    const drawAllocation = result.cashFlow.periods.find((period) => period.periodStart === drawPeriod)
    return {
      status,
      converged,
      targetLtc: targetLtc.toFixed(8),
      drawPeriod,
      repaymentPeriod,
      /*
       * Null rather than a number when the search did not converge, for the
       * same reason goal seek reports NOT_CONVERGED with nulls: a schedule
       * that does not satisfy the covenant is not a schedule, and handing one
       * back in the shape of an answer invites it to be used as one.
       */
      solution: converged ? {
        drawdown: amount(solved.draw),
        repayment: amount(solved.repayment),
        peakDebt: result.financing.peakDebt,
        debtBalance: result.financing.debtBalance,
        accumulatedInterest: result.financing.accumulatedInterest,
        actualLtc: result.financing.actualLtc,
        totalCosts: result.costs.total,
      } : null,
      /** What the scenario holds today, so the two can be read side by side. */
      before: {
        peakDebt: base.financing.peakDebt,
        debtBalance: base.financing.debtBalance,
        accumulatedInterest: base.financing.accumulatedInterest,
        actualLtc: base.financing.actualLtc,
        totalCosts: base.costs.total,
        ltcBreached: base.validation.some((issue) => issue.code === 'LTC_LIMIT_EXCEEDED'),
        debtUnrepaid: base.validation.some((issue) => issue.code === 'DEBT_NOT_REPAID' || issue.code === 'DEBT_BALANCE_NEGATIVE'),
      },
      search: { outerPasses, innerPassesOnSolution: solved.passes, computeRuns, searchedUpTo: amount(searchedUpTo) },
      /*
       * A schedule that satisfies the covenant can still break something else
       * — a cash flow that goes negative before the draw arrives, a financing
       * term shorter than the debt actually lives. Those are findings about
       * the solution, and dropping them would hand over a plan whose cost is
       * recorded where the reader is not looking.
       */
      validation: converged ? result.validation : base.validation,
      cashFlowAtDraw: drawAllocation ?? null,
    }
  }

  private goalSeekResult(
    profile: LoadedFeasibilityProfile,
    scenario: LoadedFeasibilityScenario,
    dto: CreateGoalSeekDto,
    base: ReturnType<FeasibilityCalculationService['compute']>,
    solved: ReturnType<FeasibilityCalculationService['compute']>,
    change: Decimal,
    baseValue: Decimal,
    achieved: Decimal,
    target: Decimal,
    converged: boolean,
    status: 'CONVERGED' | 'ALREADY_AT_TARGET' | 'UNREACHABLE_WITHIN_RANGE',
    maxChange: Decimal,
    evaluations: number,
  ) {
    const factor = new Decimal(1).plus(change.div(100))
    /*
     * A search that did not converge has no solved input. `change` still holds
     * the closest point probed, and dressing that up as a price would turn an
     * honest "not within these bounds" back into a number someone acts on.
     * The metric side still reports what was reached, under `achievedValue`.
     */
    const solvedInput = converged
      ? this.resolveSolvedInput(profile, scenario, dto.solveFor, factor)
      : { unit: '—', basis: 'NOT_CONVERGED', baseValue: null, solvedValue: null, perLine: [] }
    const newIssues = solved.validation.filter((issue) => !base.validation.some((baseIssue) => baseIssue.code === issue.code && baseIssue.entityId === issue.entityId))
    return {
      solveFor: dto.solveFor,
      targetMetric: dto.targetMetric,
      targetValue: target.toString(),
      converged,
      status,
      searchedRangePercent: `±${maxChange.toString()}`,
      evaluations,
      requiredChangePercent: change.toFixed(6),
      /** The multiplier to apply to the input, for a caller that would rather scale than add a percentage. */
      requiredFactor: factor.toFixed(8),
      /**
       * The absolute input the factor stands for — what actually goes on a
       * price list. Null when the scenario has no single base to scale; the
       * `basis` says which case it is and `perLine` is always filled.
       */
      solvedInput,
      baseValue: baseValue.toString(),
      achievedValue: achieved.toString(),
      /** Signed gap that remains. Zero on a converged run, the shortfall otherwise. */
      remainingGap: achieved.minus(target).toString(),
      resulting: {
        revenue: solved.revenue.total,
        costs: solved.costs.total,
        profit: solved.profitability.profit,
        profitOnCost: solved.profitability.profitOnCost,
        profitMargin: solved.profitability.profitMargin,
        projectNpv: solved.returns.projectNpv,
        projectIrrAnnual: solved.returns.projectIrrAnnual,
        peakDebt: solved.financing.peakDebt,
        feasibilityStatus: solved.feasibility.status,
      },
      /** Problems the solution introduces that the base did not have. */
      triggeredIssues: newIssues.map((issue) => ({ code: issue.code, severity: issue.severity, message: issue.message })),
    }
  }

  /**
   * ── MONTE CARLO ───────────────────────────────────────────────────────────
   *
   * The sensitivity grid asks "what if the price is 10% lower". Goal seek asks
   * "what price reaches 25%". Neither asks the question a lender asks: how
   * likely is this to lose money. That needs a distribution, and a distribution
   * needs the engine run many times over sampled inputs — not a formula that
   * approximates the engine, which would quietly stop agreeing with it.
   *
   * So this is a loop over the SAME `compute` used by every other endpoint. A
   * run that trips an LTC covenant trips it here too; escalation compounds here
   * exactly as it does there. There is no second model to keep in sync, and no
   * accuracy traded for speed.
   *
   * ── WHY THE SEED IS RETURNED ──────────────────────────────────────────────
   *
   * A simulation quoted in a report has to be re-derivable, or it is an appeal
   * to a random number nobody else can reproduce. The PRNG is seeded, the seed
   * is echoed, and the same seed with the same inputs gives the same answer.
   */
  async monteCarlo(projectId: string, scenarioId: string, dto: CreateMonteCarloDto, tenantId: string) {
    const { profile, scenario } = await this.load(projectId, scenarioId, tenantId)
    const runs = dto.runs ?? 1000
    const buckets = dto.buckets ?? 20
    const seed = dto.seed ?? Math.floor(Math.random() * 2 ** 31) + 1

    const fields = new Set<string>()
    for (const variable of dto.variables) {
      if (fields.has(variable.field)) throw DomainError.validation('FEASIBILITY_MONTE_CARLO_DUPLICATE_VARIABLE', `המשתנה „${variable.field}” הוגדר יותר מפעם אחת`, 'variables')
      fields.add(variable.field)
      assertSamplerInputs(variable)
    }
    // Sampling a lever the scenario does not have is not a smaller spread —
    // it is a simulation that silently ignores what was asked for.
    if (fields.has('financingMonths') && !scenario.financing) throw DomainError.validation('FEASIBILITY_MONTE_CARLO_VARIABLE_NOT_APPLICABLE', 'לא ניתן לדגום משך מימון בתרחיש ללא מימון', 'variables')
    if (fields.has('interestRate') && !scenario.financing?.annualInterestRate) throw DomainError.validation('FEASIBILITY_MONTE_CARLO_VARIABLE_NOT_APPLICABLE', 'לא ניתן לדגום ריבית בתרחיש ללא שיעור ריבית', 'variables')
    if (fields.has('pricePerSqm') && !scenario.unitMix.some((line) => line.disposition === 'DEVELOPER_SALE' && line.pricePerSqm)) throw DomainError.validation('FEASIBILITY_MONTE_CARLO_VARIABLE_NOT_APPLICABLE', 'לא ניתן לדגום מחיר למ״ר בתרחיש ללא דירות למכירה המתומחרות למ״ר', 'variables')

    /*
     * ── THE BUDGET GUARD, AND WHY IT MEASURES RATHER THAN GUESSES ─────────
     *
     * `compute` is not uniformly priced. A scenario with no dated cash-flow
     * allocations costs about 0.2ms; one with them costs roughly 35ms, because
     * each run solves XIRR — a bracketed root search whose every step
     * discounts every flow by a fractional exponent at 40-digit precision.
     * A hundred and eighty-fold spread is not something a fixed run cap can
     * express: 10,000 runs is two seconds on the first and an hour on the
     * second.
     *
     * So the base run is TIMED, and the total projected from it. Over budget,
     * the caller is told the measured cost per run and how many runs do fit,
     * before the request is left hanging. Nothing is silently truncated and no
     * precision is dropped to fit — the alternative to an honest refusal here
     * would be a slower engine, not a faster answer.
     */
    const baseStartedAt = Date.now()
    const base = this.compute(profile, scenario)
    const baseMs = Math.max(Date.now() - baseStartedAt, 0.05)
    const projectedMs = baseMs * runs
    if (projectedMs > MONTE_CARLO_BUDGET_MS) {
      const affordable = Math.max(100, Math.floor(MONTE_CARLO_BUDGET_MS / baseMs / 100) * 100)
      throw DomainError.validation(
        'FEASIBILITY_MONTE_CARLO_BUDGET_EXCEEDED',
        `הרצה אחת של המנוע בתרחיש הזה אורכת ${baseMs.toFixed(1)} מ״ש, ולכן ${runs} הרצות היו נמשכות כ-${Math.round(projectedMs / 1000)} שניות. אפשר להריץ עד ${affordable} הרצות, או לפשט את לוח התזרים — חישוב ה-IRR לפי תאריכים הוא מה שמייקר את ההרצה.`,
        'runs',
      )
    }

    const random = mulberry32(seed)
    const samplers = dto.variables.map((variable) => ({ field: variable.field, draw: samplerFor(variable, random) }))

    const collected: Record<MonteCarloMetric, number[]> = { profitOnCost: [], profit: [], projectNpv: [], projectIrrAnnual: [], equityIrrAnnual: [] }
    const undefinedRuns: Record<string, number> = { profitOnCost: 0, profit: 0, projectNpv: 0, projectIrrAnnual: 0, equityIrrAnnual: 0 }
    /** A draw pushed below this would invert a price or a cost; counted, never silently kept. */
    const FACTOR_FLOOR = 0.01
    let clampedDraws = 0
    const drawnByField: Record<string, number[]> = Object.fromEntries(samplers.map((sampler) => [sampler.field, [] as number[]]))
    const startedAt = Date.now()

    for (let run = 0; run < runs; run += 1) {
      const sample = new Map<string, number>()
      for (const sampler of samplers) {
        let value = sampler.draw()
        if (sampler.field === 'financingMonths') value = Math.max(0, Math.round(value))
        else if (value < FACTOR_FLOOR) { value = FACTOR_FLOOR; clampedDraws += 1 }
        sample.set(sampler.field, value)
        drawnByField[sampler.field]!.push(value)
      }
      const adjusted = this.applyMonteCarloSample(profile, scenario, sample)
      const result = this.compute(adjusted.profile, adjusted.scenario)
      for (const metric of MONTE_CARLO_METRICS) {
        const raw = monteCarloMetricOf(result, metric)
        if (raw === null) { undefinedRuns[metric] += 1; continue }
        collected[metric].push(Number(raw))
      }
    }
    const elapsedMs = Date.now() - startedAt

    return {
      runs,
      seed,
      elapsedMs,
      msPerRun: Number((elapsedMs / runs).toFixed(4)),
      engineVersion: base.engineVersion,
      /** What the scenario says today, for reading the spread against. */
      baseCase: {
        profitOnCost: base.profitability.profitOnCost,
        profit: base.profitability.profit,
        projectNpv: base.returns.projectNpv,
        projectIrrAnnual: base.returns.projectIrrAnnual,
        equityIrrAnnual: base.returns.equityIrrAnnual,
      },
      variables: dto.variables.map((variable) => ({
        field: variable.field,
        distribution: variable.distribution,
        unit: variable.field === 'financingMonths' ? 'MONTHS' : 'FACTOR_OF_BASE',
        ...summariseDraws(drawnByField[variable.field]!),
      })),
      /** Draws floored to keep a price or a cost from turning negative. Zero on any sane input. */
      clampedDraws,
      metrics: Object.fromEntries(MONTE_CARLO_METRICS.map((metric) => [
        metric,
        summariseMetric(collected[metric], undefinedRuns[metric]!, buckets),
      ])),
    }
  }

  /**
   * One sampled draw applied to the loaded input.
   *
   * The shared levers ride on `applySensitivityFactors`, so a Monte Carlo draw
   * and a sensitivity cell of the same size produce the same scenario — they
   * have to, or the two views of the model would disagree.
   *
   * `pricePerSqm` and `financingMonths` are not sensitivity levers and are
   * applied here: the first narrows `SALE_PRICE` to the residential rate on
   * sale units, the second is an absolute month count rather than a multiplier.
   */
  private applyMonteCarloSample(profile: LoadedFeasibilityProfile, scenario: LoadedFeasibilityScenario, sample: Map<string, number>) {
    const factors = new Map<string, Decimal>()
    for (const [field, lever] of Object.entries(MONTE_CARLO_LEVER)) {
      const drawn = sample.get(field)
      if (drawn !== undefined) factors.set(lever, new Decimal(drawn))
    }
    let { profile: adjustedProfile, scenario: adjustedScenario } = this.applySensitivityFactors(profile, scenario, factors)

    const price = sample.get('pricePerSqm')
    if (price !== undefined) {
      const factor = new Decimal(price)
      adjustedScenario = {
        ...adjustedScenario,
        unitMix: adjustedScenario.unitMix.map((line) => line.disposition === 'DEVELOPER_SALE' && line.pricePerSqm
          ? { ...line, pricePerSqm: read(line.pricePerSqm).mul(factor).toString() }
          : line),
      } as LoadedFeasibilityScenario
    }

    const months = sample.get('financingMonths')
    if (months !== undefined && adjustedScenario.financing) {
      adjustedScenario = {
        ...adjustedScenario,
        financing: { ...adjustedScenario.financing, financingMonths: months },
      } as LoadedFeasibilityScenario
    }

    return { profile: adjustedProfile, scenario: adjustedScenario }
  }

  /**
   * The equity waterfall for a scenario: who is paid, in what order, and what
   * each layer actually earned.
   *
   * Read-only and derived on demand rather than stored. The terms live in
   * `FeasibilityEquityTranche`; the money lives in the scenario's EQUITY
   * cash-flow allocations. Both are already persisted, so a snapshot of the
   * waterfall would be a third copy that can disagree with the two.
   */
  async waterfall(projectId: string, scenarioId: string, tenantId: string) {
    const { profile, scenario } = await this.load(projectId, scenarioId, tenantId)
    const result = computeEquityWaterfall(equityTrancheTerms(scenario), equityFlowsOf(scenario))
    const base = this.compute(profile, scenario)
    return {
      scenarioId: scenario.id,
      engineVersion: base.engineVersion,
      ...result,
      /**
       * The single blended figure the engine has always reported, kept beside
       * the per-tranche ones precisely so the gap is visible. In a layered
       * deal it matches none of them, and that is the point.
       */
      blended: {
        equityInvested: base.returns.equityInvested,
        equityDistributed: base.returns.equityDistributed,
        equityMultiple: base.returns.equityMultiple,
        equityIrrAnnual: base.returns.equityIrrAnnual,
      },
    }
  }

  async sensitivity(projectId: string, scenarioId: string, dto: CreateSensitivityDto, tenantId: string) {
    const { profile, scenario } = await this.load(projectId, scenarioId, tenantId)
    return this.computeSensitivity(profile, scenario, dto)
  }

  private computeSensitivity(profile: LoadedFeasibilityProfile, scenario: LoadedFeasibilityScenario, dto: CreateSensitivityDto) {
    const scenarioId = scenario.id
    if (dto.secondaryVariable && (!dto.secondaryChanges || dto.secondaryVariable === dto.primaryVariable)) throw DomainError.validation('FEASIBILITY_SENSITIVITY_INVALID', 'לרגישות דו־משתנית יש לבחור משתנה שני שונה ורשימת שינויים.')
    if (!dto.secondaryVariable && dto.secondaryChanges) throw DomainError.validation('FEASIBILITY_SENSITIVITY_INVALID', 'נבחרו ערכי שינוי שניים ללא משתנה שני.')
    const base = this.compute(profile, scenario)

    const evaluate = (primary: string, secondary?: string) => {
      const factors = new Map<string, Decimal>([[dto.primaryVariable, new Decimal(1).plus(new Decimal(primary).div(100))]])
      if (dto.secondaryVariable && secondary !== undefined) factors.set(dto.secondaryVariable, new Decimal(1).plus(new Decimal(secondary).div(100)))
      const adjusted = this.applySensitivityFactors(profile, scenario, factors)
      const result = this.compute(adjusted.profile, adjusted.scenario)
      const newIssues = result.validation.filter((issue) => !base.validation.some((baseIssue) => baseIssue.code === issue.code && baseIssue.entityId === issue.entityId))
      return {
        primaryChangePercent: primary,
        ...(secondary !== undefined ? { secondaryChangePercent: secondary } : {}),
        revenue: result.revenue.total, costs: result.costs.total, profit: result.profitability.profit,
        profitMargin: result.profitability.profitMargin,
        projectIrrAnnual: result.returns.projectIrrAnnual,
        projectNpv: result.returns.projectNpv,
        equityRequirement: result.cashFlow.peakFundingRequirement,
        residualLandValue: result.valuation.residualLandValue,
        // מסקנת הכדאיות היא מה שהרגישות באמת נשאלת עליה. הכפלת פלט קפוא
        // מעולם לא יכלה לענות עליה, משום שהיא לא הריצה את הבדיקות.
        feasibilityStatus: result.feasibility.status,
        peakDebt: result.financing.peakDebt,
        accumulatedInterest: result.financing.accumulatedInterest,
        // תקלות שנולדו *בגלל* השינוי, ולא כאלה שהיו כבר בבסיס: חריגה
        // מ-LTC שנפתחה רק כאן היא בדיוק סוג הממצא שהרגישות נועדה לחשוף.
        triggeredIssues: newIssues.map((issue) => ({ code: issue.code, severity: issue.severity, message: issue.message })),
      }
    }

    const rows = dto.primaryChanges.map((change) => dto.secondaryVariable ? { primaryChangePercent: change, values: dto.secondaryChanges!.map((secondary) => evaluate(change, secondary)) } : evaluate(change))
    return {
      scenarioId, primaryVariable: dto.primaryVariable, secondaryVariable: dto.secondaryVariable ?? null, rows,
      engineVersion: base.engineVersion,
      method: 'FULL_RECALCULATION',
      baseline: {
        revenue: base.revenue.total, costs: base.costs.total, profit: base.profitability.profit,
        projectIrrAnnual: base.returns.projectIrrAnnual, projectNpv: base.returns.projectNpv,
        feasibilityStatus: base.feasibility.status,
      },
      notes: base.cashFlow.reconciliationComplete
        ? ['כל שורה בטבלה היא הרצה מלאה של מנוע החישוב על קלט מותאם, ולא הכפלה של תוצאת הבסיס. ריבית, עלויות אחוזיות, התייקרות ובדיקות המימון מחושבות מחדש בכל תא.']
        : ['כל שורה היא הרצה מלאה של המנוע, אך התזרים הבסיסי אינו מפויס במלואו ולכן IRR ו-NPV אינם אמינים. השלימו הקצאות תזרים לכל שורה לפני הסתמכות על מדדי תשואה.'],
    }
  }

  async createSnapshot(projectId: string, scenarioId: string, actor: AuditActor, dto?: CreateFeasibilitySnapshotDto) {
    const profile = await this.feasibility.find(projectId, actor.tenantId)
    if (!profile) throw DomainError.notFound('FEASIBILITY_PROFILE_NOT_FOUND', 'לא קיים עדיין פרופיל דוח אפס לפרויקט')
    const scenario = profile.scenarios.find((scenario) => scenario.id === scenarioId)
    if (!scenario) throw DomainError.notFound('FEASIBILITY_SCENARIO_NOT_FOUND', 'התרחיש לא נמצא בפרויקט')
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId: actor.tenantId },
      select: { id: true, name: true, code: true, address: true, city: true },
    })
    if (!project) throw DomainError.notFound('PROJECT_NOT_FOUND', 'הפרויקט לא נמצא או אינו שייך ל־tenant')
    const output = this.compute(profile, scenario)
    const sensitivity = dto?.sensitivity ? this.computeSensitivity(profile, scenario, dto.sensitivity) : null
    // Freeze appendix metadata with the input snapshot. File bytes stay in the
    // document library; we never copy S3 keys or signed URLs into a report.
    const documentIds = profile.sources.map((source) => source.documentId).filter((id): id is string => Boolean(id))
    const documents = documentIds.length ? await this.prisma.document.findMany({
      where: { id: { in: documentIds }, tenantId: actor.tenantId, OR: [{ projectId }, { projectId: null }] },
      select: { id: true, title: true, category: true, version: true, fileName: true },
    }) : []
    const documentsById = new Map(documents.map((document) => [document.id, document]))
    const snapshotInput = {
      ...profile,
      // Keep the report cover reproducible as well: later project renames or
      // address corrections must not rewrite a locked feasibility report.
      project,
      sources: profile.sources.map((source) => ({
        ...source,
        appendix: source.documentId && documentsById.has(source.documentId)
          ? documentsById.get(source.documentId)
          : null,
      })),
    }
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.feasibilityCalculationSnapshot.create({
        data: { tenantId: actor.tenantId, feasibilityProfileId: profile.id, scenarioId, engineVersion: output.engineVersion, inputSnapshot: JSON.parse(JSON.stringify(snapshotInput)), outputSnapshot: JSON.parse(JSON.stringify(output)), validationSnapshot: JSON.parse(JSON.stringify(output.validation)), sensitivitySnapshot: sensitivity ? JSON.parse(JSON.stringify(sensitivity)) : undefined, createdById: actor.userId },
      })
      await this.audit.record(actor, { action: 'CREATE', entity: 'FeasibilityCalculationSnapshot', entityId: snapshot.id, metadata: { feasibilityProfileId: profile.id, scenarioId, engineVersion: output.engineVersion, sensitivityFrozen: Boolean(sensitivity), appendixCount: documents.length } }, tx)
      return snapshot
    })
  }

  async listSnapshots(projectId: string, scenarioId: string | undefined, tenantId: string) {
    const profile = await this.feasibility.find(projectId, tenantId)
    if (!profile) throw DomainError.notFound('FEASIBILITY_PROFILE_NOT_FOUND', 'לא קיים עדיין פרופיל דוח אפס לפרויקט')
    return this.prisma.feasibilityCalculationSnapshot.findMany({ where: { tenantId, feasibilityProfileId: profile.id, ...(scenarioId ? { scenarioId } : {}) }, select: { id: true, scenarioId: true, engineVersion: true, createdById: true, createdAt: true }, orderBy: { createdAt: 'desc' } })
  }

  private reconcileAllocations(expected: Map<string, Decimal>, allocated: Map<string, Decimal>, kind: 'REVENUE' | 'COST' | 'COMPENSATION', issues: ValidationIssue[]) {
    for (const [sourceLineId, expectedAmount] of expected) {
      const allocatedAmount = allocated.get(sourceLineId) ?? new Decimal(0)
      if (allocatedAmount.eq(0)) {
        issues.push({ code: 'CASH_FLOW_ALLOCATION_MISSING', severity: 'WARNING', message: `${kind === 'REVENUE' ? 'להכנסה' : kind === 'COMPENSATION' ? 'לתמורה' : 'לעלות'} חסרה הקצאת תזרים חודשית.`, entityId: sourceLineId })
      } else if (allocatedAmount.minus(expectedAmount).abs().gt('0.01')) {
        issues.push({ code: 'CASH_FLOW_RECONCILIATION_MISMATCH', severity: 'CRITICAL', message: `${kind === 'REVENUE' ? 'הכנסות' : kind === 'COMPENSATION' ? 'תמורות' : 'עלויות'} התזרים אינן תואמות לסכום שורות המודל.`, entityId: sourceLineId })
      }
    }
  }
}

/**
 * One metric out of a computed result, as a Decimal or null.
 *
 * Null is returned, never zero. A profit-on-cost that does not exist because
 * there are no costs is not a profit-on-cost of zero, and a solver that
 * treated it as one would converge on nonsense.
 */
function readMetric(result: { profitability: { profit: string; profitOnCost: string | null; profitMargin: string | null }; returns: { projectNpv: string | null; projectIrrAnnual: string | null }; valuation: { residualLandValue: string | null } }, metric: CreateGoalSeekDto['targetMetric']): Decimal | null {
  const raw = metric === 'profit' ? result.profitability.profit
    : metric === 'profitOnCost' ? result.profitability.profitOnCost
    : metric === 'profitMargin' ? result.profitability.profitMargin
    : metric === 'projectNpv' ? result.returns.projectNpv
    : metric === 'projectIrrAnnual' ? result.returns.projectIrrAnnual
    : result.valuation.residualLandValue
  return raw === null || raw === undefined ? null : new Decimal(raw)
}

/**
 * The sensitivity lever each `solveFor` rides on.
 *
 * `pricePerSqm` uses the SALE_PRICE lever — scaling every sale price in the
 * mix by one factor — and is then reported back as an absolute ₪/sqm. The
 * lever is shared; only the way the answer is expressed differs.
 */
const GOAL_SEEK_LEVER: Record<CreateGoalSeekDto['solveFor'], string> = {
  totalConsideration: 'TOTAL_CONSIDERATION',
  pricePerSqm: 'SALE_PRICE',
  salePrice: 'SALE_PRICE',
  constructionCost: 'CONSTRUCTION_COST',
  landCost: 'LAND_COST',
  interestRate: 'INTEREST_RATE',
  discountRate: 'DISCOUNT_RATE',
}

/**
 * ── SAMPLING ──────────────────────────────────────────────────────────────
 *
 * Deliberately a seeded PRNG rather than `Math.random`. A simulation quoted in
 * a zero report has to be reproducible by whoever reads the report; an
 * unreproducible number in a professional document is an assertion, not a
 * finding.
 *
 * mulberry32 is not cryptographic and is not meant to be — it is fast, has a
 * long enough period for 10,000 draws by a wide margin, and passes the
 * statistical properties that matter here.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The wall-clock ceiling for one synchronous Monte Carlo request. Past this a
 * simulation belongs in a job, not in an HTTP round trip that a proxy will
 * cut off anyway.
 */
/**
 * One agora. Below this a debt balance is rounding, not an amount.
 *
 * Used on BOTH sides of the repayment check, because an under-repayment of
 * half an agora and an over-repayment of half an agora are the same fact about
 * a model and should not produce different verdicts.
 */
const DEBT_ROUNDING_TOLERANCE = new Decimal('0.01')
/** Inner fixed point: the balance closes in two or three passes; more than this means it is not closing. */
const FINANCING_SOLVE_MAX_INNER_PASSES = 12
/** Outer bisection: 48 halvings take a 10^9 cost base below an agora. */
const FINANCING_SOLVE_MAX_OUTER_PASSES = 48

const MONTE_CARLO_BUDGET_MS = 15000

const MONTE_CARLO_METRICS = ['profitOnCost', 'profit', 'projectNpv', 'projectIrrAnnual', 'equityIrrAnnual'] as const
type MonteCarloMetric = (typeof MONTE_CARLO_METRICS)[number]

/** The fields that are ordinary sensitivity levers; the other two are applied directly. */
const MONTE_CARLO_LEVER: Record<string, string> = {
  salePrice: 'SALE_PRICE',
  constructionCost: 'CONSTRUCTION_COST',
  landCost: 'LAND_COST',
  interestRate: 'INTEREST_RATE',
  discountRate: 'DISCOUNT_RATE',
}

function monteCarloMetricOf(result: ReturnType<FeasibilityCalculationService['compute']>, metric: MonteCarloMetric): string | null {
  switch (metric) {
    case 'profitOnCost': return result.profitability.profitOnCost
    case 'profit': return result.profitability.profit
    case 'projectNpv': return result.returns.projectNpv
    case 'projectIrrAnnual': return result.returns.projectIrrAnnual
    case 'equityIrrAnnual': return result.returns.equityIrrAnnual
  }
}

/**
 * A distribution is only as meaningful as its parameters. A triangular whose
 * mode sits outside its bounds, or a normal with no spread, produces output
 * that looks like a simulation and is not one, so these are refused up front
 * rather than run.
 */
function assertSamplerInputs(variable: MonteCarloVariableDto): void {
  const where = `variables.${variable.field}`
  if (variable.distribution === 'normal') {
    if (variable.stdDevPct === undefined) throw DomainError.validation('FEASIBILITY_MONTE_CARLO_PARAMS_INVALID', `להתפלגות נורמלית של „${variable.field}” דרושה סטיית תקן`, where)
    if (new Decimal(variable.stdDevPct).lte(0)) throw DomainError.validation('FEASIBILITY_MONTE_CARLO_PARAMS_INVALID', `סטיית תקן של „${variable.field}” חייבת להיות חיובית — אחרת אין כאן סימולציה`, where)
    return
  }
  if (variable.min === undefined || variable.max === undefined) throw DomainError.validation('FEASIBILITY_MONTE_CARLO_PARAMS_INVALID', `ל„${variable.field}” דרושים ערכי מינימום ומקסימום`, where)
  const min = new Decimal(variable.min)
  const max = new Decimal(variable.max)
  if (min.gte(max)) throw DomainError.validation('FEASIBILITY_MONTE_CARLO_PARAMS_INVALID', `המינימום של „${variable.field}” חייב להיות קטן מהמקסימום`, where)
  if (variable.distribution === 'triangular') {
    if (variable.mostLikely === undefined) throw DomainError.validation('FEASIBILITY_MONTE_CARLO_PARAMS_INVALID', `להתפלגות משולשת של „${variable.field}” דרוש ערך שכיח`, where)
    const mode = new Decimal(variable.mostLikely)
    if (mode.lt(min) || mode.gt(max)) throw DomainError.validation('FEASIBILITY_MONTE_CARLO_PARAMS_INVALID', `הערך השכיח של „${variable.field}” חייב להיות בין המינימום למקסימום`, where)
  }
}

function samplerFor(variable: MonteCarloVariableDto, random: () => number): () => number {
  if (variable.distribution === 'normal') {
    const sd = Number(variable.stdDevPct)
    // Box–Muller. `1 - random()` keeps the log away from zero.
    return () => 1 + sd * Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
  }
  const min = Number(variable.min)
  const max = Number(variable.max)
  if (variable.distribution === 'uniform') return () => min + (max - min) * random()
  const mode = Number(variable.mostLikely)
  const split = (mode - min) / (max - min)
  // Inverse CDF of the triangular distribution.
  return () => {
    const u = random()
    return u < split
      ? min + Math.sqrt(u * (max - min) * (mode - min))
      : max - Math.sqrt((1 - u) * (max - min) * (max - mode))
  }
}

/**
 * Linear-interpolated percentile (the "type 7" definition, the same one
 * Excel's PERCENTILE and numpy's default use) over an already sorted sample.
 */
function percentileOf(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return NaN
  if (sorted.length === 1) return sorted[0]!
  const position = fraction * (sorted.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]!
  return sorted[lower]! + (position - lower) * (sorted[upper]! - sorted[lower]!)
}

const round6 = (value: number) => Number.isFinite(value) ? Number(value.toFixed(6)) : null

/** What was actually drawn, so an input distribution can be checked rather than trusted. */
function summariseDraws(draws: number[]) {
  const sorted = [...draws].sort((a, b) => a - b)
  const mean = draws.reduce((sum, value) => sum + value, 0) / (draws.length || 1)
  return {
    drawnMin: round6(sorted[0] ?? NaN),
    drawnMean: round6(mean),
    drawnMax: round6(sorted[sorted.length - 1] ?? NaN),
  }
}

function summariseMetric(values: number[], undefinedRuns: number, buckets: number) {
  if (values.length === 0) {
    // The metric is undefined in every run — an IRR on a scenario with no cash
    // flow, say. Reported as absent rather than as a distribution of nothing.
    // The shape stays identical either way, so a reader (or a chart) never has
    // to branch on which variant it received.
    return {
      available: false, samples: 0, undefinedRuns,
      p10: null, p50: null, p90: null, mean: null, stdDev: null, min: null, max: null,
      probabilityOfLoss: null, histogram: [] as Array<{ from: number | null; to: number | null; count: number }>,
    }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  // Sample standard deviation (n-1): these are draws from a distribution, not
  // the distribution itself.
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
    : 0
  const min = sorted[0]!
  const max = sorted[sorted.length - 1]!

  const width = (max - min) / buckets
  const histogram = Array.from({ length: buckets }, (unused, index) => ({
    from: round6(min + width * index),
    to: round6(min + width * (index + 1)),
    count: 0,
  }))
  for (const value of sorted) {
    // The top edge belongs to the last bucket rather than to a bucket past the end.
    const index = width === 0 ? 0 : Math.min(buckets - 1, Math.floor((value - min) / width))
    histogram[index]!.count += 1
  }

  return {
    available: true,
    samples: values.length,
    /** Runs where the engine could not express this metric at all; excluded from the statistics above. */
    undefinedRuns,
    p10: round6(percentileOf(sorted, 0.10)),
    p50: round6(percentileOf(sorted, 0.50)),
    p90: round6(percentileOf(sorted, 0.90)),
    mean: round6(mean),
    stdDev: round6(Math.sqrt(variance)),
    min: round6(min),
    max: round6(max),
    /** Share of runs in which this metric came out negative. */
    probabilityOfLoss: round6(values.filter((value) => value < 0).length / values.length),
    histogram,
  }
}

/**
 * The tranche rows, as terms the waterfall can read.
 *
 * Prisma hands back `Decimal` objects and nullable columns; the waterfall
 * works in strings and explicit nulls so it can be unit-tested without a
 * database anywhere near it.
 */
function equityTrancheTerms(scenario: LoadedFeasibilityScenario): EquityTrancheTerms[] {
  return (scenario.equityTranches ?? []).map((tranche) => ({
    id: tranche.id,
    name: tranche.name,
    kind: tranche.kind,
    priority: tranche.priority,
    commitment: tranche.commitment === null || tranche.commitment === undefined ? null : tranche.commitment.toString(),
    preferredReturnRate: tranche.preferredReturnRate === null || tranche.preferredReturnRate === undefined ? null : tranche.preferredReturnRate.toString(),
    preferredReturnAccrual: tranche.preferredReturnAccrual,
    profitSharePercent: tranche.profitSharePercent.toString(),
  }))
}

/**
 * The equity side of the existing cash flow, in the waterfall's sign
 * convention: a contribution is positive (money reaching the project), a
 * distribution negative (money leaving it for investors).
 *
 * This is the SAME `sourceKind: 'EQUITY'` the engine has always summed into
 * `equityInvested` and `equityDistributed`. Nothing new is stored and nothing
 * is re-entered; the waterfall reads the rows that were already there.
 */
function equityFlowsOf(scenario: LoadedFeasibilityScenario): EquityFlow[] {
  return scenario.cashFlowAllocations
    .filter((allocation) => allocation.sourceKind === 'EQUITY')
    .map((allocation) => ({
      date: allocation.periodStart.toISOString().slice(0, 10),
      amount: allocation.direction === 'INFLOW' ? read(allocation.amount) : read(allocation.amount).negated(),
      trancheId: allocation.sourceLineId ?? null,
    }))
}
