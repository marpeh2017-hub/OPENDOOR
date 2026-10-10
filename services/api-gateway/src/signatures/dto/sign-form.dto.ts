import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * The signer's own row on a form package (the representation protocol).
 * Every field is optional here because a package that signs an uploaded
 * document is signed with an empty body; for a form, validateSignerInput
 * (forms/form-data.ts) requires each one and says in Hebrew what is wrong.
 */
export class SignFormDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120)
  fullName?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  idNumber?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  phone?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(254)
  email?: string

  @ApiPropertyOptional({ description: 'The drawn signature, as a PNG data URL' })
  @IsOptional() @IsString() @MaxLength(95_000)
  signatureImage?: string

  @ApiPropertyOptional({ description: 'The signer confirmed reading the full text' })
  @IsOptional() @IsBoolean()
  confirmedRead?: boolean
}
