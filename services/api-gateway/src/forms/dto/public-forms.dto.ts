import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsBoolean, IsIn, IsISO8601, IsObject, IsOptional, IsString,
  IsUUID, Matches, MaxLength, MinLength, ValidateNested,
} from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

/** A row of the owners' table as a signer types it on the website. */
export class PublicRowDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(10)
  apartmentNumber!: string

  @ApiProperty() @Transform(trim) @IsString() @MaxLength(120)
  fullName!: string

  @ApiProperty() @IsString() @MaxLength(20)
  idNumber!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  phone?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(254)
  email?: string

  @ApiProperty({ description: 'The drawn signature, as a PNG data URL' })
  @IsString() @MaxLength(95_000)
  signatureImage!: string

  @ApiProperty() @IsBoolean()
  confirmedRead!: boolean
}

export class PublicBuildingDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(200)
  address!: string

  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  city!: string

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  compoundName?: string
}

export class PublicMeetingDto {
  @ApiProperty({ example: '2026-10-20' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  meetingDate!: string

  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(160)
  meetingPlace!: string
}

export class PublicMemberDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  fullName!: string

  @ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(10)
  apartmentNumber!: string
}

/** Starting a protocol on the website: the building, the meeting, the members, the initiator's row. */
export class StartPublicFormDto {
  @ApiProperty({ description: 'One UUID per rendered form; reused for retries.' }) @IsUUID('4')
  submissionId!: string

  @ApiProperty() @IsISO8601()
  renderedAt!: string

  @ApiPropertyOptional({ description: 'Anti-spam honeypot; must be empty.' })
  @IsOptional() @IsString() @MaxLength(200)
  company?: string

  @ApiProperty({ enum: ['he', 'en'] }) @IsIn(['he', 'en'])
  locale!: 'he' | 'en'

  @ApiProperty({ example: '2026-09-08' }) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  privacyPolicyVersion!: string

  @ApiProperty({ example: true }) @Equals(true, { message: 'נדרשת הסכמה ליצירת קשר' })
  consentContact!: true

  @ApiProperty({ example: true }) @Equals(true, { message: 'נדרשת הסכמה למדיניות הפרטיות' })
  consentPrivacy!: true

  @ApiProperty({ example: 'representation-protocol' }) @IsIn(['representation-protocol'])
  templateId!: string

  @ApiProperty({ type: Object, description: 'The approved wording, from @urban-renewal/api-contracts' })
  @IsObject()
  text!: Record<string, unknown>

  @ApiProperty({ type: PublicBuildingDto }) @ValidateNested() @Type(() => PublicBuildingDto)
  building!: PublicBuildingDto

  @ApiProperty({ type: PublicMeetingDto }) @ValidateNested() @Type(() => PublicMeetingDto)
  meeting!: PublicMeetingDto

  @ApiProperty({ type: [PublicMemberDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(15) @ValidateNested({ each: true }) @Type(() => PublicMemberDto)
  members!: PublicMemberDto[]

  @ApiProperty({ type: PublicRowDto }) @ValidateNested() @Type(() => PublicRowDto)
  initiator!: PublicRowDto
}

/** A neighbour signing through the shared link. */
export class SignPublicFormDto extends PublicRowDto {
  @ApiProperty() @IsISO8601()
  renderedAt!: string

  @ApiPropertyOptional({ description: 'Anti-spam honeypot; must be empty.' })
  @IsOptional() @IsString() @MaxLength(200)
  company?: string

  @ApiProperty({ example: true }) @Equals(true, { message: 'נדרשת הסכמה למדיניות הפרטיות' })
  consentPrivacy!: true
}

export class PublicFormStatusDto {
  @ApiProperty({ enum: ['OPEN', 'CLOSED'] }) @IsIn(['OPEN', 'CLOSED'])
  status!: 'OPEN' | 'CLOSED'
}
