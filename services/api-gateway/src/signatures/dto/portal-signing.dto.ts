import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, Length, Matches } from 'class-validator'

/**
 * The OTP a signer types into the signing portal.
 *
 * Until this class existed the handler took `@Body('code')`, which extracts the
 * property WITHOUT running the global ValidationPipe: a caller could send a
 * number, an object or an array where a string is declared, and it reached
 * `otpMatches()` untyped. The shape below is the same one the portal login DTO
 * already enforces for the same six digits.
 */
export class VerifySigningOtpDto {
  @ApiProperty({ example: '123456', description: 'Six-digit code sent by SMS' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  code!: string
}

/**
 * The reason a signer gives when declining.
 *
 * Optional because declining without giving a reason is a legitimate choice —
 * the column is nullable. Bounded because the value is persisted verbatim on
 * `SignatureRecord.declineReason` and replayed into the evidence event.
 */
export class DeclineSigningDto {
  @ApiPropertyOptional({ example: 'אני לא מסכים לתנאי התמורה', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  reason?: string
}
