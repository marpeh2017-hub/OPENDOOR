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
  FeasibilityCompensationStatus,
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
}

export class UpdateUnitMixLineDto extends PartialType(CreateUnitMixLineDto) {}

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
