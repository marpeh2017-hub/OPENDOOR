import {
  IsArray, ArrayNotEmpty, IsBoolean, IsEmail, IsInt, IsOptional,
  IsString, MaxLength, Min, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * `Owner` is NOT `Resident`.
 *
 *   Owner    — whoever holds registered title (tabu). May live abroad, may be
 *              an estate with unsettled inheritance, may hold shares in several
 *              apartments. Signature weight for the pinuy-binuy threshold is
 *              computed from OWNERS' shares.
 *   Resident — whoever physically lives in the apartment. May be a tenant with
 *              no title at all. Carries the communication history, documents
 *              and portal access.
 *
 * They are linked, optionally, by `Owner.residentId` — one owner may be the
 * same person as one resident. The two are never merged.
 */

export class OwnerShareDto {
  @ApiProperty() @IsString() @MaxLength(80)
  apartmentId!: string

  @ApiProperty({ description: 'Exact fraction numerator' }) @IsInt() @Min(0)
  shareNumerator!: number

  @ApiProperty({ description: 'Exact fraction denominator — never a decimal' }) @IsInt() @Min(1)
  shareDenominator!: number

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  viaInheritance?: boolean
}

export class CreateOwnerDto {
  @ApiProperty({ description: 'Owner.fullName — a single field, not first/last' })
  @IsString() @MaxLength(200)
  fullName!: string

  /**
   * Israeli ID. Validated and AES-256-GCM encrypted before persist by
   * `NationalIdService`; never returned, logged or audited in the clear.
   */
  @ApiPropertyOptional({ description: 'Encrypted at rest; responses return a mask only' })
  @IsOptional() @IsString() @MaxLength(20)
  nationalId?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  phone?: string

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(160)
  email?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
  addressAbroad?: string

  @ApiPropertyOptional({ description: 'עיזבון — inheritance not yet settled' })
  @IsOptional() @IsBoolean()
  isEstate?: boolean

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
  guardianContact?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  notes?: string

  @ApiPropertyOptional({ description: 'Link this owner to an existing Resident record' })
  @IsOptional() @IsString() @MaxLength(80)
  residentId?: string

  /** Optional initial holdings — each validated by the shared OwnershipService. */
  @ApiPropertyOptional({ type: [OwnerShareDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OwnerShareDto)
  holdings?: OwnerShareDto[]
}

export class UpdateOwnerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) fullName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) nationalId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(160) email?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) addressAbroad?: string
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isEstate?: boolean
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) guardianContact?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) residentId?: string | null
}

export class SetOwnerActiveDto {
  @ApiProperty() @IsBoolean()
  isActive!: boolean
}

/** Change one owner's share of one apartment. */
export class SetOwnerShareDto {
  @ApiProperty() @IsString() @MaxLength(80)
  apartmentId!: string

  @ApiProperty() @IsInt() @Min(0)
  shareNumerator!: number

  @ApiProperty() @IsInt() @Min(1)
  shareDenominator!: number

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  viaInheritance?: boolean
}

/** Bulk-attach one owner to several apartments at a uniform share. */
export class BulkAssignOwnerDto {
  @ApiProperty() @IsString() @MaxLength(80)
  ownerId!: string

  @ApiProperty({ type: [String] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  apartmentIds!: string[]

  @ApiProperty() @IsInt() @Min(0)
  shareNumerator!: number

  @ApiProperty() @IsInt() @Min(1)
  shareDenominator!: number
}
