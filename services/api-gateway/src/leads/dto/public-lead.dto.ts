import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEmail, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength,
} from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * Payload for the PUBLIC marketing lead form.
 *
 * This is the system's first unauthenticated write, so the DTO is a strict
 * allow-list and nothing else. `ValidationPipe` runs with `whitelist` and
 * `forbidNonWhitelisted`, which means:
 *
 *   - Any property not declared here is a 400, not a silently-dropped field.
 *   - **`tenantId` is deliberately absent.** A client-supplied tenant on a
 *     public endpoint would let anyone on the internet write into any tenant.
 *     The destination tenant is resolved from server configuration only.
 *   - `status`, `score`, `assignedToId`, `source` and every other Lead column
 *     are likewise absent. They are decisions the server makes.
 *
 * Two anti-spam fields are declared, and both are named and shaped so a naive
 * bot fills them in wrongly. See `PublicLeadsService` for how they are used —
 * a failed check is discarded silently, never reported back.
 */

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value

/**
 * Israeli phone numbers, permissive about separators and the +972 form.
 * Rejects anything that is not plausibly a phone number, without pretending to
 * validate that the line exists.
 */
const IL_PHONE = /^(?:\+?972[-\s]?|0)(?:[23489]|5[0-9]|7[0-9])[-\s]?\d{3}[-\s]?\d{4}$/

export const PUBLIC_LEAD_INTERESTS = ['DEMO', 'INFO', 'PARTNERSHIP', 'OTHER'] as const
export type PublicLeadInterest = (typeof PUBLIC_LEAD_INTERESTS)[number]

export class PublicLeadDto {
  @ApiProperty({ maxLength: 60, example: 'ישראל' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'שם פרטי הוא שדה חובה' })
  @MinLength(2, { message: 'שם פרטי קצר מדי' })
  @MaxLength(60)
  firstName!: string

  @ApiProperty({ maxLength: 60, example: 'ישראלי' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'שם משפחה הוא שדה חובה' })
  @MinLength(2, { message: 'שם משפחה קצר מדי' })
  @MaxLength(60)
  lastName!: string

  @ApiProperty({ maxLength: 160, example: 'israel@example.com' })
  @Transform(trim)
  @IsEmail({}, { message: 'כתובת אימייל אינה תקינה' })
  @MaxLength(160)
  email!: string

  @ApiPropertyOptional({ maxLength: 20, example: '050-1234567' })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(IL_PHONE, { message: 'מספר טלפון אינו תקין' })
  phone?: string

  @ApiPropertyOptional({ maxLength: 80 })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string

  @ApiPropertyOptional({ enum: PUBLIC_LEAD_INTERESTS })
  @IsOptional()
  @IsIn(PUBLIC_LEAD_INTERESTS)
  interest?: PublicLeadInterest

  @ApiPropertyOptional({
    maxLength: 1000,
    description: 'Free-text message. Stored on the lead as notes.',
  })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string

  /**
   * HONEYPOT. Rendered off-screen and hidden from assistive technology, so a
   * human never sees it and never fills it. Any value at all means a bot.
   *
   * Named `company` rather than something obviously decoy-like, because
   * autofill-driven bots target plausible field names.
   */
  @ApiPropertyOptional({ description: 'Anti-spam honeypot — must be empty.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string

  /**
   * When the form was rendered, set by the client on mount. Used for the
   * minimum-time-on-form check.
   *
   * Client-supplied and therefore spoofable by a determined attacker — it
   * raises the cost for commodity bots, it is not an authentication mechanism.
   * The rate limiter is the real ceiling.
   */
  @ApiPropertyOptional({ description: 'ISO timestamp of when the form was rendered.' })
  @IsOptional()
  @IsISO8601({}, { message: 'renderedAt must be an ISO-8601 timestamp' })
  renderedAt?: string
}
