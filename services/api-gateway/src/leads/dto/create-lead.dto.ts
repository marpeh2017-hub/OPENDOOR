import {
  IsString, IsOptional, IsEmail, IsEnum, IsInt, Min, Max, MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// Object enums, not readonly arrays: class-validator lists the accepted values
// in its error message for the former and produces an empty list for the latter.
// Keep in sync with the LeadSource / LeadStatus / Language enums in schema.prisma.
export const LeadSource = {
  WEBSITE: 'WEBSITE', REFERRAL: 'REFERRAL', WHATSAPP: 'WHATSAPP',
  PHONE: 'PHONE', SOCIAL_MEDIA: 'SOCIAL_MEDIA', CAMPAIGN: 'CAMPAIGN',
  DOOR_TO_DOOR: 'DOOR_TO_DOOR', EVENT: 'EVENT', PARTNER: 'PARTNER',
  OTHER: 'OTHER',
} as const

export const LeadStatus = {
  NEW: 'NEW', CONTACTED: 'CONTACTED', MEETING_SCHEDULED: 'MEETING_SCHEDULED',
  INTERESTED: 'INTERESTED', NEGOTIATION: 'NEGOTIATION', SIGNED: 'SIGNED',
  LOST: 'LOST',
} as const

export const Language = { he: 'he', en: 'en', ru: 'ru', ar: 'ar' } as const

/**
 * The controller previously took an untyped body and spread it into
 * prisma.lead.create, so any caller could set fields the client has no
 * business setting. The global ValidationPipe runs with whitelist and
 * forbidNonWhitelisted, but neither applies without a typed DTO — so this
 * class is what actually strips unknown properties and rejects them.
 */
export class CreateLeadDto {
  @ApiProperty() @IsString() @MaxLength(60)
  firstName!: string

  @ApiProperty() @IsString() @MaxLength(60)
  lastName!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(25)
  phone?: string

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  address?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  city?: string

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional() @IsEnum(LeadSource)
  source?: (typeof LeadSource)[keyof typeof LeadSource]

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional() @IsEnum(LeadStatus)
  status?: (typeof LeadStatus)[keyof typeof LeadStatus]

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100)
  score?: number

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  notes?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  campaignId?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  assignedToId?: string

  @ApiPropertyOptional({ enum: Language })
  @IsOptional() @IsEnum(Language)
  language?: (typeof Language)[keyof typeof Language]
}
