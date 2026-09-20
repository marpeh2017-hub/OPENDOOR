import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, MaxLength,
} from 'class-validator'

/**
 * Mirrors `FeasibilityRuleAuthority` in the schema. Duplicated as a plain union
 * rather than imported from `@prisma/client` because `class-validator`'s
 * `IsEnum` needs a runtime object, and the generated enum is a type-only export
 * under `isolatedModules`.
 */
export const RULE_AUTHORITIES = {
  STATUTE: 'STATUTE',
  REGULATION: 'REGULATION',
  MUNICIPAL_PLAN: 'MUNICIPAL_PLAN',
  BANK_GUIDANCE: 'BANK_GUIDANCE',
  COMPANY_STANDARD: 'COMPANY_STANDARD',
  MARKET_CONVENTION: 'MARKET_CONVENTION',
} as const

export class CreateFeasibilityRuleDto {
  @ApiProperty({ example: 'vat-rate', description: 'Shares the vocabulary of FeasibilityAssumption.key' })
  @IsString() @IsNotEmpty() @MaxLength(120)
  code!: string

  @ApiProperty({ example: 'שיעור מע״מ' })
  @IsString() @IsNotEmpty() @MaxLength(300)
  name!: string

  @ApiProperty({ enum: RULE_AUTHORITIES })
  @IsEnum(RULE_AUTHORITIES)
  authority!: keyof typeof RULE_AUTHORITIES

  @ApiPropertyOptional({ description: 'Null applies nationwide; a city name limits the rule to it' })
  @IsOptional() @IsString() @MaxLength(200)
  jurisdiction?: string | null

  @ApiPropertyOptional({ example: 0.18 })
  @IsOptional() @IsNumber() @Type(() => Number)
  numericValue?: number | null

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  textValue?: string | null

  @ApiPropertyOptional({ example: 'ratio' })
  @IsOptional() @IsString() @MaxLength(60)
  unit?: string | null

  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  effectiveFrom!: string

  @ApiPropertyOptional({ description: 'Exclusive. Null means still in force.' })
  @IsOptional() @IsDateString()
  effectiveUntil?: string | null

  @ApiProperty({ example: 'חוק מס ערך מוסף, תיקון 2025', description: 'Required — a rule with no citation is a rumour' })
  @IsString() @IsNotEmpty() @MaxLength(500)
  sourceReference!: string

  @ApiPropertyOptional()
  @IsOptional() @IsUrl() @MaxLength(1000)
  sourceUrl?: string | null

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string | null

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean
}

export class UpdateFeasibilityRuleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) name?: string
  @ApiPropertyOptional({ enum: RULE_AUTHORITIES }) @IsOptional() @IsEnum(RULE_AUTHORITIES)
  authority?: keyof typeof RULE_AUTHORITIES
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) jurisdiction?: string | null
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) numericValue?: number | null
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) textValue?: string | null
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) unit?: string | null
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveFrom?: string
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveUntil?: string | null
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) sourceReference?: string
  @ApiPropertyOptional() @IsOptional() @IsUrl() @MaxLength(1000) sourceUrl?: string | null
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string | null
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean
}

export class RetireFeasibilityRuleDto {
  @ApiProperty({ description: 'The rule stops applying at this date (exclusive)' })
  @IsDateString()
  effectiveUntil!: string
}
