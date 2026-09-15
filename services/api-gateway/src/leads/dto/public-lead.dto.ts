import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  Equals,
  IsEmail,
  IsISO8601,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value

const optionalTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const IL_PHONE = /^(?:\+?972[-\s]?|0)(?:[23489]|5[0-9]|7[0-9])[-\s]?\d{3}[-\s]?\d{4}$/

export const PUBLIC_LEAD_KINDS = ['CONTACT', 'ELIGIBILITY'] as const
export const PUBLIC_LEAD_TYPES = [
  'OWNER', 'REPRESENTATIVE', 'LAWYER', 'DEVELOPER', 'GENERAL',
] as const
export const PUBLIC_PROJECT_TYPES = [
  'UNKNOWN', 'TAMA_38', 'PINUY_BINUY', 'RIGHTS_CHECK', 'OWNER_ORGANIZING',
] as const
export const PUBLIC_ORGANIZING_STATUSES = [
  'NOT_STARTED', 'EARLY_CONVERSATION', 'REPRESENTATION_FORMED', 'PROCESS_ACTIVE',
] as const

/** Strict allow-list for the unauthenticated marketing-site write. */
export class PublicLeadDto {
  @ApiProperty({ enum: PUBLIC_LEAD_KINDS })
  @IsIn(PUBLIC_LEAD_KINDS)
  kind!: (typeof PUBLIC_LEAD_KINDS)[number]

  @ApiProperty({ description: 'One UUID per rendered form; reused for retries.' })
  @IsUUID('4')
  submissionId!: string

  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'שם מלא הוא שדה חובה' })
  @MinLength(2)
  @MaxLength(120)
  fullName!: string

  @ApiProperty({ maxLength: 20, example: '050-1234567' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'טלפון הוא שדה חובה' })
  @MaxLength(20)
  @Matches(IL_PHONE, { message: 'מספר טלפון אינו תקין' })
  phone!: string

  @ApiPropertyOptional({ maxLength: 160 })
  @Transform(optionalTrim)
  @IsOptional()
  @IsEmail({}, { message: 'כתובת אימייל אינה תקינה' })
  @MaxLength(160)
  email?: string

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(optionalTrim)
  @ValidateIf((dto: PublicLeadDto) => dto.kind === 'ELIGIBILITY' || dto.address !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'כתובת בניין היא שדה חובה' })
  @MaxLength(200)
  address?: string

  @ApiPropertyOptional({ maxLength: 80 })
  @Transform(optionalTrim)
  @ValidateIf((dto: PublicLeadDto) => dto.kind === 'ELIGIBILITY' || dto.city !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'עיר היא שדה חובה' })
  @MaxLength(80)
  city?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 2000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  estimatedUnits?: number

  @ApiPropertyOptional({ enum: PUBLIC_LEAD_TYPES })
  @ValidateIf((dto: PublicLeadDto) => dto.kind === 'ELIGIBILITY' || dto.leadType !== undefined)
  @IsIn(PUBLIC_LEAD_TYPES)
  leadType?: (typeof PUBLIC_LEAD_TYPES)[number]

  @ApiPropertyOptional({ enum: PUBLIC_PROJECT_TYPES })
  @ValidateIf((dto: PublicLeadDto) => dto.kind === 'ELIGIBILITY' || dto.projectType !== undefined)
  @IsIn(PUBLIC_PROJECT_TYPES)
  projectType?: (typeof PUBLIC_PROJECT_TYPES)[number]

  @ApiPropertyOptional({ enum: PUBLIC_ORGANIZING_STATUSES })
  @IsOptional()
  @IsIn(PUBLIC_ORGANIZING_STATUSES)
  organizingStatus?: (typeof PUBLIC_ORGANIZING_STATUSES)[number]

  @ApiPropertyOptional({ maxLength: 1000 })
  @Transform(optionalTrim)
  @ValidateIf((dto: PublicLeadDto) => dto.kind === 'CONTACT' || dto.message !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'הודעה היא שדה חובה' })
  @MaxLength(1000)
  message?: string

  @ApiProperty({ example: true })
  @Equals(true, { message: 'נדרשת הסכמה ליצירת קשר' })
  consentContact!: true

  @ApiProperty({ example: true })
  @Equals(true, { message: 'נדרשת הסכמה למדיניות הפרטיות' })
  consentPrivacy!: true

  @ApiProperty({ example: '2026-09-08', maxLength: 40 })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @MaxLength(40)
  privacyPolicyVersion!: string

  @ApiProperty({ maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  sourcePage!: string

  @ApiProperty({ enum: ['he', 'en'] })
  @IsIn(['he', 'en'])
  locale!: 'he' | 'en'

  @ApiProperty()
  @IsISO8601()
  submittedAt!: string

  @ApiProperty()
  @IsISO8601({}, { message: 'renderedAt must be an ISO-8601 timestamp' })
  renderedAt!: string

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmSource?: string

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmMedium?: string

  @ApiPropertyOptional({ maxLength: 160 })
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  utmCampaign?: string

  @ApiPropertyOptional({ description: 'Anti-spam honeypot; must be empty.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string
}
