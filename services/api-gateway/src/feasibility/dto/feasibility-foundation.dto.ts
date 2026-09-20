import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty,
  ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested,
} from 'class-validator'
import { OmitType, PartialType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  FeasibilityAreaType, FeasibilityConfidence, FeasibilityDataClassification,
  FeasibilityProjectType, FeasibilityReportType, FeasibilitySourceType,
  FeasibilityScenarioKind, FeasibilityRevenueCategory, FeasibilityCostCategory,
  FeasibilityCashFlowDirection, FeasibilityCashFlowSourceKind,
  FeasibilityCompensationStatus, FeasibilityUnitDisposition,
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
}

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
  @IsOptional() @Matches(/^\d+(\.\d+)?$/)
  equityAmount?: string
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
  @IsIn(['pricePerSqm', 'salePrice', 'constructionCost', 'landCost', 'interestRate', 'discountRate'])
  solveFor!: 'pricePerSqm' | 'salePrice' | 'constructionCost' | 'landCost' | 'interestRate' | 'discountRate'

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

export class CreateFeasibilitySnapshotDto {
  @IsOptional() @ValidateNested() @Type(() => CreateSensitivityDto)
  sensitivity?: CreateSensitivityDto
}

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
