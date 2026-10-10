import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator'

export class CreateFormDto {
  @ApiProperty({ example: 'representation-protocol' })
  @IsString() @IsIn(['representation-protocol'])
  templateId!: string

  @ApiProperty() @IsString() @MaxLength(40)
  projectId!: string

  @ApiProperty({ description: 'The complex (מתחם) whose owners sign' })
  @IsString() @MaxLength(40)
  complexId!: string

  /**
   * The wording, from @urban-renewal/api-contracts. Its shape is checked in
   * forms/form-data.ts (validateSnapshot); the words are the CRM's.
   */
  @ApiProperty({ type: Object })
  @IsObject()
  text!: Record<string, unknown>
}

export class FormMeetingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  compoundName?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  address?: string

  @ApiPropertyOptional({ example: '2026-10-20' }) @IsOptional() @IsString() @MaxLength(10)
  meetingDate?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  meetingPlace?: string
}

export class FormRepresentativeDto {
  @ApiProperty() @IsString() @MaxLength(40)
  ownerId!: string

  @ApiProperty() @IsString() @MaxLength(40)
  apartmentId!: string
}

export class UpdateFormDto {
  @ApiPropertyOptional({ type: FormMeetingDto })
  @IsOptional() @ValidateNested() @Type(() => FormMeetingDto)
  meeting?: FormMeetingDto

  @ApiPropertyOptional({ type: [FormRepresentativeDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(15) @ValidateNested({ each: true }) @Type(() => FormRepresentativeDto)
  representatives?: FormRepresentativeDto[]
}

export class ShareLinkDto {
  @ApiProperty({ enum: ['WHATSAPP', 'COPY'] })
  @IsIn(['WHATSAPP', 'COPY'])
  via!: 'WHATSAPP' | 'COPY'
}

export class PaperSignatureDto {
  @ApiProperty({ description: 'The name as written on the paper form' })
  @IsString() @MaxLength(120)
  fullName!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  idNumber?: string

  @ApiProperty({ example: '2026-10-20' }) @IsString() @MaxLength(10)
  signedDate!: string

  @ApiProperty({ description: 'The scanned signed form, uploaded through /documents' })
  @IsString() @MaxLength(40)
  documentId!: string
}
