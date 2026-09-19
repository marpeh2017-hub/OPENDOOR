import { Injectable } from '@nestjs/common'
import Decimal from 'decimal.js'
import { DomainError } from '../common/errors/domain-error'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { PrismaService } from '../prisma.service'
import { annualizeMonthlyRate, averageMonthlyDebtInterest, continuousMonthlyPeriodAxis, daysBetween, irr, isUniformMonthlyAxis, monthlyPeriodDistance, monthlyRateFromAnnual, npv, xirr, xnpv } from './financial-math'
import type { CreateFeasibilitySnapshotDto, CreateSensitivityDto } from './dto/feasibility-foundation.dto'
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
      if (endingDebt.isNegative()) issues.push({ code: 'DEBT_BALANCE_NEGATIVE', severity: 'CRITICAL', message: 'החזר חוב גדול מיתרת החוב בתזרים.', entityId: periodStart })
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
    if (outstandingDebt.gt('0.01')) issues.push({ code: 'DEBT_NOT_REPAID', severity: 'CRITICAL', message: `בתום התזרים נותרה יתרת חוב של ${amount(outstandingDebt)}; הרווח המוצג אינו סופי כל עוד החוב אינו נפרע.` })

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
    if (!annualDiscountRate) issues.push({ code: 'DISCOUNT_RATE_MISSING', severity: 'WARNING', message: 'לא ניתן לחשב NPV ללא הנחת annual-discount-rate במרשם ההנחות.' })
    const periodicDiscountRate = annualDiscountRate ? monthlyRateFromAnnual(read(annualDiscountRate)) : null
    const projectNpv = !annualDiscountRate ? null
      : axisIsUniform ? npv(projectPeriodFlows, periodicDiscountRate!) : xnpv(datedProjectFlows, read(annualDiscountRate))
    const equityNpv = !annualDiscountRate ? null
      : axisIsUniform ? npv(equityPeriodFlows, periodicDiscountRate!) : xnpv(datedEquityFlows, read(annualDiscountRate))
    const minimumProfitMargin = profile.assumptions.find((assumption) => assumption.key === 'minimum-profit-margin')?.value
    const minimumProjectIrrAnnual = profile.assumptions.find((assumption) => assumption.key === 'minimum-project-irr-annual')?.value
    const actualProfitMargin = totalRevenue.gt(0) ? projectProfit.div(totalRevenue) : null
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
    const grossArea = profile.areas.filter((area) => area.areaType === 'GROSS').reduce((sum, area) => sum.plus(read(area.valueSqm)), new Decimal(0))
    if (grossArea.gt(0) && totalSaleableArea.gt(grossArea)) {
      issues.push({ code: 'SALEABLE_AREA_EXCEEDS_GROSS', severity: 'CRITICAL', message: 'שטח המכירה הכולל גדול מהשטח הברוטו; נדרשת בדיקת תמהיל ושטחים.' })
    }
    const mainAndServiceArea = profile.areas
      .filter((area) => area.areaType === 'MAIN' || area.areaType === 'SERVICE')
      .reduce((sum, area) => sum.plus(read(area.valueSqm)), new Decimal(0))
    const areaTolerance = profile.assumptions.find((assumption) => assumption.key === 'area-reconciliation-tolerance-sqm')?.value
    if (grossArea.gt(0) && mainAndServiceArea.gt(0)) {
      if (!areaTolerance) {
        issues.push({ code: 'AREA_RECONCILIATION_TOLERANCE_MISSING', severity: 'WARNING', message: 'קיימים שטח עיקרי ושירות לצד שטח ברוטו, אך לא הוגדרה הנחת area-reconciliation-tolerance-sqm לבדיקת ההתאמה.' })
      } else if (read(areaTolerance).lt(0)) {
        issues.push({ code: 'AREA_RECONCILIATION_TOLERANCE_INVALID', severity: 'CRITICAL', message: 'הנחת area-reconciliation-tolerance-sqm אינה יכולה להיות שלילית.' })
      } else if (mainAndServiceArea.minus(grossArea).abs().gt(read(areaTolerance))) {
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
      requiredDeveloperProfit = totalRevenue.mul(read(requiredProfitMargin))
      // Residual value treats land as the balancing value. Any existing LAND
      // cost is removed first so it is never subtracted twice.
      residualLandValue = totalRevenue.minus(totalCosts.minus(landCosts)).minus(requiredDeveloperProfit)
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
      revenue: { lines: revenue, total: amount(totalRevenue) },
      costs: { lines: costs, total: amount(totalCosts) },
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
        profitOnCost: totalCosts.gt(0) ? projectProfit.div(totalCosts).toFixed(8) : null,
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
    const interest = factors.get('INTEREST_RATE') ?? null
    const discount = factors.get('DISCOUNT_RATE') ?? null
    const scale = (value: { toString(): string } | null | undefined, factor: Decimal | null) => value === null || value === undefined || !factor ? value : read(value).mul(factor).toString()
    const costFactorFor = (category: string) => category === 'CONSTRUCTION' ? construction : category === 'LAND' ? land : null
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
    }

    return { profile: adjustedProfile as LoadedFeasibilityProfile, scenario: adjustedScenario as LoadedFeasibilityScenario }
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
