import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  Equals, IsBoolean, IsEmail, IsIn, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, MinLength,
} from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
/** People type dashes and spaces; the sign-in matches 05XXXXXXXX. */
const phoneDigits = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value
  const digits = value.replace(/\D/g, '')
  return digits.startsWith('972') ? `0${digits.slice(3)}` : digits
}
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value

const ISRAELI_MOBILE = /^05\d{8}$/

export const REGISTRATION_RELATIONS = ['OWNER', 'FAMILY', 'TENANT'] as const

/** Step 1: where to send the code. */
export class RegistrationCodeDto {
  @ApiProperty({ example: '0501234567' })
  @Transform(phoneDigits) @IsString() @Matches(ISRAELI_MOBILE, { message: 'מספר הנייד אינו תקין' })
  phone!: string

  @ApiPropertyOptional({ description: 'Where the code goes when there is no SMS provider' })
  @IsOptional() @Transform(emptyToUndefined) @IsEmail({}, { message: 'כתובת האימייל אינה תקינה' }) @MaxLength(254)
  email?: string

  @ApiProperty({ description: 'When the form was rendered, for the spam check' })
  @IsISO8601()
  renderedAt!: string

  @ApiPropertyOptional({ description: 'Honeypot: stays empty for a person' })
  @IsOptional() @IsString() @MaxLength(200)
  company?: string
}

/** Step 2: the request itself, with the code. */
export class SubmitRegistrationDto {
  @ApiProperty() @IsUUID()
  submissionId!: string

  @ApiProperty() @IsISO8601()
  renderedAt!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  company?: string

  @ApiProperty({ enum: ['he', 'en'] }) @IsIn(['he', 'en'])
  locale!: 'he' | 'en'

  @ApiProperty() @IsString() @MaxLength(40)
  privacyPolicyVersion!: string

  @ApiProperty() @Equals(true)
  consentContact!: true

  @ApiProperty() @Equals(true)
  consentPrivacy!: true

  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(120)
  fullName!: string

  @ApiProperty({ example: '0501234567' })
  @Transform(phoneDigits) @IsString() @Matches(ISRAELI_MOBILE, { message: 'מספר הנייד אינו תקין' })
  phone!: string

  @ApiPropertyOptional()
  @IsOptional() @Transform(emptyToUndefined) @IsEmail({}, { message: 'כתובת האימייל אינה תקינה' }) @MaxLength(254)
  email?: string

  @ApiPropertyOptional({ description: 'Optional; checked and encrypted' })
  @IsOptional() @Transform(emptyToUndefined) @IsString() @MaxLength(20)
  idNumber?: string

  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(200)
  address!: string

  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  city!: string

  @ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(10)
  apartmentNumber!: string

  @ApiProperty({ enum: REGISTRATION_RELATIONS }) @IsIn(REGISTRATION_RELATIONS)
  relation!: (typeof REGISTRATION_RELATIONS)[number]

  @ApiProperty({ example: '123456' })
  @IsString() @Length(6, 6) @Matches(/^\d{6}$/, { message: 'הקוד הוא 6 ספרות' })
  code!: string
}

/** Staff: put the person on an existing resident file, or on an apartment as a new one. */
export class ApproveRegistrationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  residentId?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  apartmentId?: string

  @ApiPropertyOptional({ description: 'Replace a different phone already on the resident file' })
  @IsOptional() @IsBoolean()
  replacePhone?: boolean
}

export class RejectRegistrationDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  note?: string
}

export class ListRegistrationsDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
}
