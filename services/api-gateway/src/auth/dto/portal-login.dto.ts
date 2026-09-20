import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Resident portal login DTOs.
 *
 * ── WHY THERE IS NO tenantId FIELD ANYWHERE IN THIS FILE ────────────────────
 *
 * A caller may supply an invitation token or a tenant SLUG, both of which only
 * NARROW the set of resident files already reachable from their own phone
 * number. Neither can widen it, and neither is trusted as an answer to "which
 * tenant am I". The tenant is always derived server-side from the resident row
 * the flow lands on.
 *
 * The global ValidationPipe runs with `forbidNonWhitelisted: true`, so a body
 * carrying a `tenantId` is rejected at the door rather than quietly ignored —
 * which is what makes the absence of the field load-bearing rather than
 * decorative.
 */

/** Israeli mobile format, shared by every phone field below. */
const ISRAELI_MOBILE = /^05\d{8}$/

export class PortalSendOtpDto {
  @ApiProperty({ example: '0501234567', description: 'Israeli mobile number' })
  @IsString()
  @Matches(ISRAELI_MOBILE, { message: 'Invalid Israeli mobile number' })
  phone!: string

  @ApiPropertyOptional({ description: 'Invitation token from the link the resident was sent' })
  @IsOptional()
  @IsString()
  @Length(20, 200)
  invitationToken?: string
}

export class PortalVerifyOtpDto {
  @ApiProperty({ example: '0501234567' })
  @IsString()
  @Matches(ISRAELI_MOBILE)
  phone!: string

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  code!: string

  @ApiPropertyOptional({ description: 'Invitation token — resolves the login to exactly one resident file' })
  @IsOptional()
  @IsString()
  @Length(20, 200)
  invitationToken?: string

  @ApiPropertyOptional({
    description:
      'Tenant slug, from the subdomain the portal was opened on. Narrows the ' +
      'candidate residents; never widens them, and never becomes the session tenant on its own.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9-]+$/, { message: 'Invalid tenant slug' })
  tenantSlug?: string
}

export class PortalSelectResidentDto {
  @ApiProperty({ description: 'Selection token returned by the verify step' })
  @IsString()
  @Length(20, 200)
  selectionToken!: string

  @ApiProperty({ description: 'One of the resident ids the selection challenge offered' })
  @IsString()
  @Length(1, 64)
  residentId!: string
}

export class IssueResidentInvitationDto {
  @ApiProperty({ description: 'The resident to issue a portal login link for' })
  @IsString()
  @Length(1, 64)
  residentId!: string

  @ApiPropertyOptional({ description: 'Lifetime in hours (default 168 = 7 days)', minimum: 1, maximum: 720 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  ttlHours?: number
}

export class RevokeResidentInvitationDto {
  @ApiPropertyOptional({ description: 'Why the link was withdrawn — kept on the row for support' })
  @IsOptional()
  @IsString()
  @Length(1, 300)
  reason?: string
}
