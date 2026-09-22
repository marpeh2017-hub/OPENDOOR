import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator'

/**
 * The staff write surface for a lead.
 *
 * Public website intake has its own DTO (`PublicLeadDto`); this is the
 * authenticated one, which previously took `@Body() body: any` and spread it
 * into Prisma. `tenantId` was appended after the spread and so could not be
 * overridden, but everything else on the lead could — including
 * `convertedToResidentId`, `score` and the consent audit fields
 * (`consentRecordedAt`, `privacyPolicyVersion`), which record what a person
 * actually agreed to and must never come from a caller's request body.
 */
export const LEAD_SOURCES = ['WEBSITE', 'REFERRAL', 'WHATSAPP', 'PHONE', 'SOCIAL_MEDIA', 'CAMPAIGN', 'DOOR_TO_DOOR', 'EVENT', 'PARTNER', 'OTHER'] as const
export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'MEETING_SCHEDULED', 'INTERESTED', 'NEGOTIATION', 'SIGNED', 'LOST'] as const
const nullable = () => ValidateIf((_object: unknown, value: unknown) => value !== null)

export class CreateLeadDto {
  @ApiProperty() @IsString() @MaxLength(100) firstName!: string
  @ApiProperty() @IsString() @MaxLength(100) lastName!: string

  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(40) phone?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsEmail() @MaxLength(255) email?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(300) address?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(120) city?: string | null

  @ApiPropertyOptional({ enum: LEAD_SOURCES }) @IsOptional() @IsIn(LEAD_SOURCES) source?: (typeof LEAD_SOURCES)[number]
  @ApiPropertyOptional({ enum: LEAD_STATUSES }) @IsOptional() @IsIn(LEAD_STATUSES) status?: (typeof LEAD_STATUSES)[number]

  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(60) campaignId?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(60) assignedToId?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(60) matchedBuildingId?: string | null

  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(60) leadType?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(60) projectType?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(60) organizingStatus?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsInt() @Min(0) @Max(10000) estimatedUnits?: number | null

  /*
   * Consent as a staff-entered fact is allowed — somebody was told and said
   * yes on a call. What is NOT allowed is writing the audit fields that record
   * WHEN and against WHICH policy version, because those are the evidence and
   * the server stamps them.
   */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() consentContact?: boolean
  @ApiPropertyOptional() @IsOptional() @IsBoolean() consentPrivacy?: boolean

  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(5000) notes?: string | null
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) tags?: string[]
}
