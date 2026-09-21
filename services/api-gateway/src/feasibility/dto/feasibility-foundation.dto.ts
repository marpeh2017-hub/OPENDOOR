import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty,
  ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested,
  ValidateIf,
} from 'class-validator'
import { OmitType, PartialType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  FeasibilityAreaType, FeasibilityConfidence, FeasibilityDataClassification,
  FeasibilityProjectType, FeasibilityReportType, FeasibilitySourceType,
  FeasibilityScenarioKind, FeasibilityRevenueCategory, FeasibilityCostCategory,
  FeasibilityCashFlowDirection, FeasibilityCashFlowSourceKind,
  FeasibilityCompensationStatus, FeasibilityUnitDisposition,
  FeasibilityEquityTrancheKind, FeasibilityPreferredReturnAccrual,
  FeasibilityTimelinePhaseKind, FeasibilityVatTreatment, PlanningRightStatus,
} from '@prisma/client'

/** Decimal inputs remain strings until Prisma stores them as NUMERIC. */
class ProvenanceDto {
  @IsOptional() @IsEnum(FeasibilityDataClassification)
  classification?: FeasibilityDataClassification

  @IsOptional() @IsEnum(FeasibilityConfidence)
  confidence?: FeasibilityConfidence

  @IsOptional() @IsBoolean()
  isVerified?: boolean

  @IsOptional() @IsString() @MaxLength(128)
  sourceId?: string

  @IsOptional() @IsDateString()
  sourceDate?: string

  @IsOptional() @IsString() @MaxLength(4000)
  notes?: string
}

export class CreateFeasibilityProfileDto {
  @IsEnum(FeasibilityProjectType)
  projectType!: FeasibilityProjectType

  @IsOptional() @IsEnum(FeasibilityReportType)
  reportType?: FeasibilityReportType

  @IsString() @IsNotEmpty() @MaxLength(4000)
  purpose!: string

  @IsDateString()
  valuationDate!: string

  @IsDateString()
  reportDate!: string

  @IsOptional() @IsString() @MaxLength(240)
  clientName?: string

  @IsOptional() @IsString() @MaxLength(240)
  developerName?: string

  @IsOptional() @IsString() @MaxLength(240)
  appraiserName?: string

  @IsOptional() @IsString() @MaxLength(240)
  neighborhood?: string
}

export class UpdateFeasibilityProfileDto extends PartialType(CreateFeasibilityProfileDto) {}

export class CreateGushChelkaDto extends ProvenanceDto {
  @IsString() @IsNotEmpty() @MaxLength(50)
  gush!: string

  @IsString() @IsNotEmpty() @MaxLength(50)
  chelka!: string

  @IsOptional() @IsString() @MaxLength(50)
  subChelka?: string

  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  landAreaSqm?: string

  @IsOptional() @IsString() @MaxLength(500)
  address?: string
}
export class UpdateGushChelkaDto extends PartialType(CreateGushChelkaDto) {}

export class CreateFeasibilitySourceDto {
  @IsEnum(FeasibilitySourceType)
  type!: FeasibilitySourceType

  @IsString() @IsNotEmpty() @MaxLength(500)
  title!: string

  @IsOptional() @IsString() @MaxLength(300)
  issuer?: string

  @IsOptional() @IsDateString()
  sourceDate?: string

  @IsOptional() @IsString() @MaxLength(128)
  documentId?: string

  @IsOptional() @IsString() @MaxLength(2000)
  sourceUrl?: string

  @IsOptional() @IsString() @MaxLength(120)
  pageReference?: string

  @IsOptional() @IsString() @MaxLength(4000)
  extractedValue?: string

  @IsOptional() @IsString() @MaxLength(4000)
  notes?: string

  @IsOptional() @IsEnum(FeasibilityConfidence)
  reliability?: FeasibilityConfidence
}
export class UpdateFeasibilitySourceDto extends PartialType(CreateFeasibilitySourceDto) {}

export class CreateFeasibilityAssumptionDto extends ProvenanceDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  key!: string

  @IsString() @IsNotEmpty() @MaxLength(300)
  label!: string

  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  value?: string

  @IsOptional() @IsString() @MaxLength(4000)
  textValue?: string

  @IsOptional() @IsString() @MaxLength(50)
  unit?: string

  @IsOptional() @IsDateString()
  validFrom?: string

  @IsOptional() @IsDateString()
  validUntil?: string

  @IsOptional() @IsString() @MaxLength(100)
  impact?: string
}
export class UpdateFeasibilityAssumptionDto extends PartialType(CreateFeasibilityAssumptionDto) {}

export class CreateFeasibilityAreaDto extends ProvenanceDto {
  @IsEnum(FeasibilityAreaType)
  areaType!: FeasibilityAreaType

  @IsOptional() @IsString() @MaxLength(300)
  label?: string

  @Matches(/^\d+(\.\d+)?$/)
  valueSqm!: string
}
export class UpdateFeasibilityAreaDto extends PartialType(CreateFeasibilityAreaDto) {}

export class CreatePlanningRightDto extends ProvenanceDto {
  @IsString() @IsNotEmpty() @MaxLength(160)
  category!: string

  @IsEnum(PlanningRightStatus)
  status!: PlanningRightStatus

  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  areaSqm?: string

  @IsOptional() @IsInt() @Min(0)
  unitCount?: number

  @IsOptional() @IsInt() @Min(0)
  floorLimit?: number

  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  heightMeters?: string

  @IsOptional() @IsString() @MaxLength(100)
  planNumber?: string

  @IsOptional() @IsString() @MaxLength(200)
  landUse?: string
}
export class UpdatePlanningRightDto extends PartialType(CreatePlanningRightDto) {}

export class CreateFeasibilityScenarioDto {
  @IsString() @IsNotEmpty() @MaxLength(160)
  name!: string

  @IsOptional() @IsEnum(FeasibilityScenarioKind)
  kind?: FeasibilityScenarioKind

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string

  /** Probability is a Decimal fraction from 0 to 1, never a percentage float. */
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  probability?: string

  @IsOptional() @IsBoolean()
  isBaseline?: boolean

  /**
   * Market value of non-cash consideration for the land — finished flats
   * handed to the seller in a combination deal.
   *
   * It is NOT a cash-flow entry and must not be entered as one: no money
   * moves, so nothing is financed or repaid against it. It exists so the
   * ratios divide by what the land actually cost. Omitted or `'0'`, every
   * derived figure is the cash-only figure exactly.
   */
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  considerationInKind?: string
}

export class UpdateFeasibilityScenarioDto extends PartialType(CreateFeasibilityScenarioDto) {}

export class CreateUnitMixLineDto extends ProvenanceDto {
  @IsString() @IsNotEmpty() @MaxLength(160)
  label!: string

  @IsInt() @Min(1)
  unitCount!: number

  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  rooms?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  netAreaSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  grossAreaSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  saleableAreaSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  balconyAreaSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  storageAreaSqm?: string
  @IsOptional() @IsInt() @Min(0)
  parkingSpaces?: number
  @IsOptional() @IsInt() @Min(0)
  floorFrom?: number
  @IsOptional() @IsInt() @Min(0)
  floorTo?: number
  @IsOptional() @IsString() @MaxLength(80)
  orientation?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  pricePerSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  fixedUnitPrice?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  balconyPricePerSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  parkingPrice?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  storagePricePerSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  adjustmentFactor?: string

  /**
   * Who ends up holding the unit — and therefore whether it earns anything.
   *
   * The engine books sale revenue for `DEVELOPER_SALE` lines ONLY, and raises a
   * critical `UNIT_DISPOSITION_MISSING` for anything left `UNCLASSIFIED`. That
   * column and that gate shipped in 0cbdefb with no way to set the value: every
   * line stayed `UNCLASSIFIED` forever, so no unit mix could earn revenue and no
   * scenario could clear its critical issue. This field is the missing half.
   *
   * It stays OPTIONAL and the database default stays `UNCLASSIFIED`. Defaulting
   * to `DEVELOPER_SALE` would silently credit every owner-replacement flat as
   * income, which is the exact error the gate exists to prevent — an unset
   * disposition has to fail loudly rather than earn quietly.
   */
  @IsOptional() @IsEnum(FeasibilityUnitDisposition)
  disposition?: FeasibilityUnitDisposition
}

export class UpdateUnitMixLineDto extends PartialType(CreateUnitMixLineDto) {}

/**
 * One replacement flat (or a share of one) allocated to one existing holding.
 *
 * The share is an integer fraction rather than a decimal for the reason
 * `OwnerApartment` uses one: three equal heirs hold a third each, and
 * 0.333 x 3 is not a whole flat. The engine sums these in BigInt.
 */
export class CreateReplacementAllocationDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  unitReference!: string

  @IsString() @IsNotEmpty() @MaxLength(128)
  ownerApartmentId!: string

  @IsOptional() @IsInt() @Min(1)
  shareNumerator?: number

  @IsOptional() @IsInt() @Min(1)
  shareDenominator?: number

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string
}

export class UpdateReplacementAllocationDto extends PartialType(CreateReplacementAllocationDto) {}

export class CreateFeasibilityRevenueLineDto extends ProvenanceDto {
  @IsEnum(FeasibilityRevenueCategory)
  category!: FeasibilityRevenueCategory

  @IsString() @IsNotEmpty() @MaxLength(240)
  label!: string

  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  quantity?: string
  @IsOptional() @IsString() @MaxLength(30)
  unit?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  saleableAreaSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  pricePerSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  fixedUnitPrice?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  annualNoi?: string
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  capitalizationRate?: string
  @IsOptional() @IsEnum(FeasibilityVatTreatment)
  vatTreatment?: FeasibilityVatTreatment
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  vatRate?: string
}
export class UpdateFeasibilityRevenueLineDto extends PartialType(CreateFeasibilityRevenueLineDto) {}

export class CreateFeasibilityCostLineDto extends ProvenanceDto {
  @IsEnum(FeasibilityCostCategory)
  category!: FeasibilityCostCategory

  @IsString() @IsNotEmpty() @MaxLength(240)
  label!: string

  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  quantity?: string
  @IsOptional() @IsString() @MaxLength(30)
  unit?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  unitCost?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  fixedAmount?: string
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  percentage?: string
  @IsOptional() @IsString() @MaxLength(120)
  percentageBase?: string
  @IsOptional() @IsEnum(FeasibilityVatTreatment)
  vatTreatment?: FeasibilityVatTreatment
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  vatRate?: string
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  escalationRate?: string
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  contingencyRate?: string
}
export class UpdateFeasibilityCostLineDto extends PartialType(CreateFeasibilityCostLineDto) {}

export class UpsertFeasibilityFinancingDto extends ProvenanceDto {
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  debtAmount?: string
  /**
   * ההון שהיזם התחייב להעמיד. `null` מנקה את ההתחייבות — ולא מצהיר על אפס.
   * שתי האמירות שונות, והמנוע בודק אותן אחרת, ולכן חייבת להיות דרך למסור
   * את הראשונה.
   */
  @IsOptional() @ValidateIf((object: UpsertFeasibilityFinancingDto) => object.equityAmount !== null) @Matches(/^\d+(\.\d+)?$/)
  equityAmount?: string | null
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  ltc?: string
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  ltv?: string
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  annualInterestRate?: string
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  arrangementFeeRate?: string
  @IsOptional() @Matches(/^(0(\.\d+)?|1(\.0+)?)$/)
  guaranteeFeeRate?: string
  @IsOptional() @IsInt() @Min(0)
  graceMonths?: number
  @IsOptional() @IsInt() @Min(1)
  financingMonths?: number

  /**
   * Where the equity in the cash flow comes from.
   *
   * `DERIVED` (the default) computes it: equity tops the running balance up
   * to `equityBalanceFloor` in the month it falls below, so the equity
   * schedule answers to the debt schedule. `EXPLICIT_ALLOCATIONS` keeps
   * hand-entered EQUITY cash-flow allocations instead, and is an override
   * rather than a default — a residual typed beside the debt is what produced
   * an equity IRR that responded to nothing.
   */
  @IsOptional() @IsIn(['DERIVED', 'EXPLICIT_ALLOCATIONS'])
  equitySource?: 'DERIVED' | 'EXPLICIT_ALLOCATIONS'

  /**
   * The cumulative balance derived equity holds the project at. Zero when not
   * given. A plan that lands exactly on nothing leaves no room for a late
   * collection, so this is a parameter rather than a hard zero.
   */
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  equityBalanceFloor?: string
}

/**
 * תשובות אשף ההפניה.
 *
 * כל שדה אופציונלי, ו-`UNKNOWN` הוא ערך תקף ולא היעדר: "נשאלתי ואיני יודע"
 * ו"לא נשאלתי" הן שתי עובדות שונות, ורק הראשונה אומרת שהשאלה הוצגה. שתיהן
 * עוצרות את ההכרעה, אבל רק הראשונה נרשמת כתשובה.
 */
export class RouteDecisionDto {
  @IsOptional() @IsIn(['SELLER_EXITS', 'LANDOWNER_PARTNER', 'EXISTING_OWNERS', 'UNKNOWN'])
  landHolder?: 'SELLER_EXITS' | 'LANDOWNER_PARTNER' | 'EXISTING_OWNERS' | 'UNKNOWN'

  @IsOptional() @IsIn(['BUILD', 'RESELL', 'UNKNOWN'])
  buildIntent?: 'BUILD' | 'RESELL' | 'UNKNOWN'

  @IsOptional() @IsIn(['YES', 'NO', 'UNKNOWN'])
  demolition?: 'YES' | 'NO' | 'UNKNOWN'

  @IsOptional() @IsIn(['SINGLE', 'MULTIPLE', 'UNKNOWN'])
  buildingCount?: 'SINGLE' | 'MULTIPLE' | 'UNKNOWN'

  @IsOptional() @IsIn(['DECLARED_OR_IN_PROGRESS', 'NOT_DECLARED', 'UNKNOWN'])
  declaration?: 'DECLARED_OR_IN_PROGRESS' | 'NOT_DECLARED' | 'UNKNOWN'

  /**
   * האם לקבוע את המסלול בפרופיל, או רק לראות לאן התשובות מובילות.
   *
   * ברירת המחדל היא חקירה. בחינת מסלולים היא השימוש הרגיל, והיא לא אמורה
   * לשנות דבר עד שמחליטים — ואי אפשר להחיל מסלול שלא הוכרע.
   */
  @IsOptional() @IsBoolean()
  apply?: boolean
}

export class CreateFeasibilityTimelinePhaseDto extends ProvenanceDto {
  @IsEnum(FeasibilityTimelinePhaseKind)
  kind!: FeasibilityTimelinePhaseKind

  @IsString() @IsNotEmpty() @MaxLength(160)
  label!: string

  @IsOptional() @IsDateString()
  startDate?: string
  @IsOptional() @IsDateString()
  endDate?: string
  @IsOptional() @IsInt() @Min(1)
  durationMonths?: number
  @IsOptional() @IsString() @MaxLength(128)
  dependencyPhaseId?: string
}
export class UpdateFeasibilityTimelinePhaseDto extends PartialType(CreateFeasibilityTimelinePhaseDto) {}

export class CreateFeasibilityCashFlowAllocationDto extends ProvenanceDto {
  @IsDateString()
  periodStart!: string

  @IsEnum(FeasibilityCashFlowDirection)
  direction!: FeasibilityCashFlowDirection

  @IsEnum(FeasibilityCashFlowSourceKind)
  sourceKind!: FeasibilityCashFlowSourceKind

  @IsOptional() @IsString() @MaxLength(128)
  sourceLineId?: string

  @IsString() @IsNotEmpty() @MaxLength(240)
  label!: string

  @Matches(/^\d+(\.\d+)?$/)
  amount!: string
}
/** The economic source of a cash-flow allocation is immutable. Reclassifying
 * it can silently break reconciliation, so callers must delete and recreate
 * the allocation when that relationship genuinely changes. */
export class UpdateFeasibilityCashFlowAllocationDto extends PartialType(OmitType(CreateFeasibilityCashFlowAllocationDto, ['direction', 'sourceKind', 'sourceLineId'] as const)) {}

export class CreateFeasibilityCompensationLineDto extends ProvenanceDto {
  @IsString() @IsNotEmpty() @MaxLength(128)
  ownerApartmentId!: string

  @IsOptional() @IsEnum(FeasibilityCompensationStatus)
  status?: FeasibilityCompensationStatus

  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  replacementAreaSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  additionalAreaSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  balconyAreaSqm?: string
  @IsOptional() @IsInt() @Min(0)
  parkingSpaces?: number
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  storageAreaSqm?: string
  @IsOptional() @IsInt() @Min(0)
  newFloor?: number
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  replacementValue?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  parkingValue?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  storageValue?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  balconyValue?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  cashCompensation?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  monthlyRelocationRent?: string
  @IsOptional() @IsInt() @Min(0)
  relocationMonths?: number
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  movingCost?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  temporaryHousingCost?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  legalCost?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  inspectionCost?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  otherCost?: string
}
/** A compensation line remains tied to its original ownership record.
 * Moving an owner between apartments is an ownership-domain operation, never a
 * silent edit of a financial line. */
export class UpdateFeasibilityCompensationLineDto extends PartialType(OmitType(CreateFeasibilityCompensationLineDto, ['ownerApartmentId'] as const)) {}

export class CreateSensitivityDto {
  @IsIn(['SALE_PRICE', 'CONSTRUCTION_COST', 'LAND_COST', 'INTEREST_RATE', 'DISCOUNT_RATE'])
  primaryVariable!: 'SALE_PRICE' | 'CONSTRUCTION_COST' | 'LAND_COST' | 'INTEREST_RATE' | 'DISCOUNT_RATE'

  @IsArray() @ArrayMinSize(2)
  @Matches(/^-?\d+(\.\d+)?$/, { each: true })
  primaryChanges!: string[]

  @IsOptional() @IsIn(['SALE_PRICE', 'CONSTRUCTION_COST', 'LAND_COST', 'INTEREST_RATE', 'DISCOUNT_RATE'])
  secondaryVariable?: 'SALE_PRICE' | 'CONSTRUCTION_COST' | 'LAND_COST' | 'INTEREST_RATE' | 'DISCOUNT_RATE'

  @IsOptional() @IsArray() @ArrayMinSize(2)
  @Matches(/^-?\d+(\.\d+)?$/, { each: true })
  secondaryChanges?: string[]
}

/**
 * Solve for the input that hits a target, rather than sweeping inputs to see
 * where they land. The inverse of the sensitivity grid, over the same levers.
 */
export class CreateGoalSeekDto {
  /**
   * What to solve for.
   *
   * `pricePerSqm` is the headline case and the one an appraiser actually
   * works in: the answer comes back as an absolute ₪/sqm that can be typed
   * straight back into the unit mix. The rest are the sensitivity levers, and
   * their answer is a percentage change, because "the construction cost" is
   * not a single number that could be reported as one.
   */
  @IsIn(['pricePerSqm', 'salePrice', 'constructionCost', 'landCost', 'totalConsideration', 'interestRate', 'discountRate'])
  solveFor!: 'pricePerSqm' | 'salePrice' | 'constructionCost' | 'landCost' | 'totalConsideration' | 'interestRate' | 'discountRate'

  /**
   * What is being aimed at. Ratios (profitOnCost, profitMargin,
   * projectIrrAnnual) are decimal fractions, not percentages: 0.2, never 20.
   * The engine stores them that way, and accepting both would make 20 mean
   * either a fifth or twenty times depending on the metric.
   */
  @IsIn(['profit', 'profitOnCost', 'profitMargin', 'projectNpv', 'projectIrrAnnual', 'residualLandValue'])
  targetMetric!: 'profit' | 'profitOnCost' | 'profitMargin' | 'projectNpv' | 'projectIrrAnnual' | 'residualLandValue'

  @Matches(/^-?\d+(\.\d+)?$/)
  targetValue!: string

  /**
   * How far the solver may move the input, as a percentage either way.
   * Bounded because an unbounded search will always find SOMETHING, and a
   * "solution" at +4000% on the sale price is not an answer — it is a way of
   * saying the target is unreachable while looking like it is not.
   */
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  maxChangePercent?: string
}

/**
 * Solve the drawdown and the repayment that a financing term sheet implies.
 *
 * ── WHY THIS CANNOT BE TYPED IN BY HAND ───────────────────────────────────
 *
 * LTC is measured against PEAK debt, and peak debt includes the interest
 * capitalised during grace. The denominator — total costs — includes that same
 * interest. So the draw sets the interest, the interest sets both the peak and
 * the cost base, and those two set the LTC that was supposed to govern the
 * draw. The repayment has the same shape: it has to clear the balance, and the
 * balance is the drawn principal PLUS capitalised interest, which is not known
 * until the draw is fixed.
 *
 * In practice this was resolved by running the model, reading the breach,
 * adjusting, and running again — two rounds per scenario, every time. This
 * endpoint does that search against the same engine, so the answer is the one
 * the engine actually produces rather than a second model of it.
 *
 * It returns a schedule. It does NOT write one: what the solver found and what
 * the scenario stores stay separate until somebody decides to store it.
 */
export class SolveFinancingDto {
  /**
   * The LTC the schedule must satisfy, as a decimal fraction (0.65, never 65).
   * Defaults to the scenario's own `ltc` limit — solving to a covenant the
   * scenario does not state would mean inventing the term sheet.
   */
  @IsOptional() @Matches(/^0?\.\d+$|^1(\.0+)?$/)
  targetLtc?: string

  /**
   * Month of the single drawdown, and month of the single repayment.
   * Both default to the scenario's existing DEBT allocations: the first
   * drawdown month and the last repayment month. They are inputs to the
   * schedule, not things to be solved — when the money is needed and when the
   * project can repay are facts about the build, not about the covenant.
   */
  @IsOptional() @IsDateString()
  drawPeriod?: string

  @IsOptional() @IsDateString()
  repaymentPeriod?: string
}

export class CreateFeasibilitySnapshotDto {
  @IsOptional() @ValidateNested() @Type(() => CreateSensitivityDto)
  sensitivity?: CreateSensitivityDto
}

/**
 * Monte Carlo — the distribution behind the single number.
 *
 * A zero report states one profit-on-cost. That number is the result of every
 * assumption landing exactly where it was typed, which is the one outcome that
 * will not happen. This samples the assumptions instead and runs the SAME
 * engine over each draw, so the answer is a spread with a probability of loss
 * attached rather than a point estimate that looks certain.
 *
 * ── UNITS ─────────────────────────────────────────────────────────────────
 *
 * Every field except `financingMonths` is sampled as a MULTIPLIER of whatever
 * the scenario already holds: `stdDevPct: '0.10'` means a normal draw with a
 * standard deviation of 10% of the base value, and a triangular `min/mostLikely/
 * max` of `0.9/1/1.3` means 90%–130% of base. `financingMonths` is sampled in
 * MONTHS, absolutely, because a loan term has no meaningful base-relative
 * reading — `min: '18', mostLikely: '24', max: '36'` is the whole statement.
 *
 * The response repeats each variable's unit so a reader never has to infer it.
 */
export class MonteCarloVariableDto {
  /**
   * `pricePerSqm` moves ONLY the ₪/sqm on sale units — not parking, storage,
   * balconies or standalone revenue lines. `salePrice` moves all of them
   * together. They are separate because an appraiser's uncertainty about the
   * residential rate is not the same as uncertainty about the whole revenue
   * side, and conflating them overstates the spread.
   */
  @IsIn(['pricePerSqm', 'salePrice', 'constructionCost', 'landCost', 'interestRate', 'discountRate', 'financingMonths'])
  field!: 'pricePerSqm' | 'salePrice' | 'constructionCost' | 'landCost' | 'interestRate' | 'discountRate' | 'financingMonths'

  @IsIn(['normal', 'triangular', 'uniform'])
  distribution!: 'normal' | 'triangular' | 'uniform'

  /** `normal` only: standard deviation as a fraction of the base value. */
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  stdDevPct?: string

  /** `triangular` and `uniform`. Multipliers of base, or months for `financingMonths`. */
  @IsOptional() @Matches(/^-?\d+(\.\d+)?$/)
  min?: string

  /** `triangular` only — the mode, not the mean. */
  @IsOptional() @Matches(/^-?\d+(\.\d+)?$/)
  mostLikely?: string

  @IsOptional() @Matches(/^-?\d+(\.\d+)?$/)
  max?: string
}

export class CreateMonteCarloDto {
  /**
   * Capped at 10,000. The cap is not arithmetic shyness — it is the point past
   * which a synchronous HTTP request stops being the right shape for the work.
   * The response reports its own wall time so the caller can see the cost.
   */
  @IsOptional() @IsInt() @Min(100) @Max(10000)
  runs?: number

  /**
   * Fixing the seed makes a run reproducible, which is what turns a simulation
   * into something that can be cited in a report and re-derived by whoever
   * reads it. Omitted, a seed is drawn and RETURNED, so any run can be repeated.
   */
  @IsOptional() @IsInt() @Min(1)
  seed?: number

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => MonteCarloVariableDto)
  variables!: MonteCarloVariableDto[]

  /** Histogram resolution for the chart. */
  @IsOptional() @IsInt() @Min(5) @Max(100)
  buckets?: number
}

/**
 * A layer of equity, expressed as TERMS only.
 *
 * The money is not here and must not be: a tranche's contributions are the
 * scenario's existing EQUITY INFLOW cash-flow allocations, pointed at this row
 * through their `sourceLineId`. Storing amounts here as well would create a
 * second cash-flow model that can disagree with the first.
 */
export class CreateEquityTrancheDto extends ProvenanceDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string

  @IsOptional() @IsEnum(FeasibilityEquityTrancheKind)
  kind?: FeasibilityEquityTrancheKind

  /** Lower is paid first. Ties are allowed — pari passu is a real structure — and reported. */
  @IsInt() @Min(0)
  priority!: number

  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  commitment?: string

  /**
   * Annual hurdle as a decimal fraction: `'0.08'` for 8%.
   *
   * Omitted entirely means this tranche has NO preferred return, which is the
   * ordinary shape of sponsor equity. That is a different statement from
   * `'0'`, a 0% hurdle, so the two are kept distinguishable.
   */
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  preferredReturnRate?: string

  @IsOptional() @IsEnum(FeasibilityPreferredReturnAccrual)
  preferredReturnAccrual?: FeasibilityPreferredReturnAccrual

  /** Share of the residual after capital and preference, as a decimal fraction. */
  @Matches(/^\d+(\.\d+)?$/)
  profitSharePercent!: string
}

export class UpdateEquityTrancheDto extends PartialType(CreateEquityTrancheDto) {}

export class CreateComparableTransactionDto {
  @IsString() @IsNotEmpty() @MaxLength(300)
  address!: string
  @IsDateString()
  transactionDate!: string
  @Matches(/^\d+(\.\d+)?$/)
  transactionPrice!: string
  @Matches(/^\d+(\.\d+)?$/)
  saleableAreaSqm!: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  rooms?: string
  @IsOptional() @IsInt() @Min(-10)
  floor?: number
  @IsOptional() @IsInt() @Min(0)
  buildingAgeYears?: number
  @IsOptional() @IsString() @MaxLength(160)
  condition?: string
  @IsOptional() @IsBoolean()
  hasParking?: boolean
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  balconyAreaSqm?: string
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  storageAreaSqm?: string
  @IsOptional() @IsString() @MaxLength(128)
  sourceId?: string
  @IsOptional() @IsString() @MaxLength(1000)
  sourceUrl?: string
  @IsOptional() @IsEnum(FeasibilityConfidence)
  reliability?: FeasibilityConfidence
  @IsOptional() @IsString() @MaxLength(4000)
  notes?: string
}

export class CreateComparableAdjustmentDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  category!: string
  @Matches(/^\d+(\.\d+)?$/)
  factor!: string
  @IsOptional() @IsString() @MaxLength(1000)
  description?: string
  @IsOptional() @IsEnum(FeasibilityDataClassification)
  classification?: FeasibilityDataClassification
  @IsOptional() @IsEnum(FeasibilityConfidence)
  confidence?: FeasibilityConfidence
  @IsOptional() @IsString() @MaxLength(128)
  sourceId?: string
  @IsOptional() @IsDateString()
  sourceDate?: string
}

export class UpdateComparableTransactionDto extends PartialType(CreateComparableTransactionDto) {}
export class UpdateComparableAdjustmentDto extends PartialType(CreateComparableAdjustmentDto) {}

export class CreateFeasibilityReportVersionDto {
  @IsString() @IsNotEmpty() @MaxLength(128)
  snapshotId!: string

  @IsString() @IsNotEmpty() @MaxLength(240)
  title!: string
}

export class TransitionFeasibilityReportVersionDto {
  @IsIn(['REVIEW', 'APPROVED', 'LOCKED'])
  status!: 'REVIEW' | 'APPROVED' | 'LOCKED'
}
