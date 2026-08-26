import {
  IsArray, ArrayNotEmpty, IsBoolean, IsIn, IsInt, IsNumber, IsOptional,
  IsString, MaxLength, Min, Max, ValidateNested, IsObject,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * `main.ts` enables `whitelist` + `forbidNonWhitelisted`, so these DTOs are the
 * write surface. The previous controllers took `@Body() body: any` and spread it
 * into Prisma, which let a caller move a building to another tenant's complex by
 * passing `complexId` on an update.
 */

export const ENTITY_STATUSES = ['active', 'archived'] as const

export class CoordinatesDto {
  @ApiProperty() @IsNumber() @Min(-90) @Max(90)
  lat!: number

  @ApiProperty() @IsNumber() @Min(-180) @Max(180)
  lng!: number
}

export class CreateBuildingDto {
  @ApiProperty() @IsString() @MaxLength(80)
  complexId!: string

  @ApiProperty({ description: 'Street name only — the number goes in streetNumber' })
  @IsString() @MaxLength(200)
  address!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  streetNumber?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  city?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  zipCode?: string

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(200)
  floors?: number

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10000)
  totalApartments?: number

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1800) @Max(2100)
  constructionYear?: number

  @ApiPropertyOptional() @IsOptional() @IsIn(['A', 'B', 'C'])
  buildingClass?: string

  @ApiPropertyOptional({ description: '{ lat, lng }' })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto
}

/** `complexId` is absent on purpose — moving a building between projects is a
 * separate, separately-audited endpoint, not a field on a general update. */
export class UpdateBuildingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  address?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  streetNumber?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  city?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  zipCode?: string

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(200)
  floors?: number

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10000)
  totalApartments?: number

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1800) @Max(2100)
  constructionYear?: number

  @ApiPropertyOptional() @IsOptional() @IsIn(['A', 'B', 'C'])
  buildingClass?: string

  @ApiPropertyOptional() @IsOptional() @IsObject() @ValidateNested() @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto
}

export class MoveBuildingDto {
  @ApiProperty({ description: 'Target complex — must belong to the same tenant' })
  @IsString() @MaxLength(80)
  complexId!: string
}

export class SetEntityStatusDto {
  @ApiProperty({ enum: ENTITY_STATUSES }) @IsIn(ENTITY_STATUSES as unknown as string[])
  status!: string
}

// ── Apartments ──────────────────────────────────────────────────────────────

export class OwnershipAssignmentDto {
  @ApiProperty() @IsString() @MaxLength(80)
  ownerId!: string

  @ApiProperty({ description: 'Exact fraction numerator, e.g. 1 in 1/3' })
  @IsInt() @Min(0)
  shareNumerator!: number

  @ApiProperty({ description: 'Exact fraction denominator, e.g. 3 in 1/3. Never a decimal.' })
  @IsInt() @Min(1)
  shareDenominator!: number

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  viaInheritance?: boolean
}

export class CreateApartmentDto {
  @ApiProperty() @IsString() @MaxLength(80)
  buildingId!: string

  @ApiProperty() @IsString() @MaxLength(20)
  apartmentNumber!: string

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(-5) @Max(200)
  floor?: number

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10000)
  sizeSqm?: number

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(50)
  rooms?: number

  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasParking?: boolean
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(20) parkingSpots?: number
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasStorage?: boolean
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(20) storageCount?: number
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasBalcony?: boolean
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1000) balconySqm?: number

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  notes?: string

  /** Optional initial ownership — validated by the shared OwnershipService. */
  @ApiPropertyOptional({ type: [OwnershipAssignmentDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OwnershipAssignmentDto)
  owners?: OwnershipAssignmentDto[]
}

export class UpdateApartmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  apartmentNumber?: string

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(-5) @Max(200) floor?: number
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10000) sizeSqm?: number
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(50) rooms?: number
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasParking?: boolean
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(20) parkingSpots?: number
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasStorage?: boolean
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(20) storageCount?: number
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasBalcony?: boolean
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1000) balconySqm?: number

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  notes?: string
}

/** Replaces the apartment's ownership wholesale — the shared service checks the
 * exact fraction sum before anything is written. */
export class SetApartmentOwnersDto {
  @ApiProperty({ type: [OwnershipAssignmentDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => OwnershipAssignmentDto)
  owners!: OwnershipAssignmentDto[]

  @ApiPropertyOptional({
    description: 'Reject shares summing to less than 1 instead of warning',
  })
  @IsOptional() @IsBoolean()
  requireCompleteShares?: boolean
}

// ── Bulk ────────────────────────────────────────────────────────────────────

export class BulkBuildingStatusDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  ids!: string[]

  @ApiProperty({ enum: ENTITY_STATUSES }) @IsIn(ENTITY_STATUSES as unknown as string[])
  status!: string
}

export class BulkMoveBuildingsDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  ids!: string[]

  @ApiProperty() @IsString() @MaxLength(80)
  complexId!: string
}
