import {
  IsArray, ArrayNotEmpty, IsString, IsOptional, IsBoolean, IsIn, MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export const RESIDENT_SIGNATURE_STATUSES = [
  'NOT_CONTACTED', 'CONTACTED', 'INTERESTED', 'SIGNED',
  'OBJECTING', 'UNDECIDED', 'UNREACHABLE',
] as const

/**
 * Replaces `@Body('status')` on the signature-status endpoint.
 *
 * Per-property `@Body('x')` extraction bypasses the global ValidationPipe
 * entirely — that is exactly how an unvalidated status string reached the leads
 * service. Any value could previously be written straight into the enum column.
 */
export class UpdateSignatureStatusDto {
  @ApiProperty({ enum: RESIDENT_SIGNATURE_STATUSES })
  @IsIn(RESIDENT_SIGNATURE_STATUSES as unknown as string[])
  status!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  note?: string
}

export class AddResidentActivityDto {
  @ApiProperty() @IsString() @MaxLength(60)
  type!: string

  @ApiProperty() @IsString() @MaxLength(200)
  title!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  note?: string
}

export class SetResidentActiveDto {
  @ApiProperty() @IsBoolean()
  isActive!: boolean
}

export class MoveResidentDto {
  @ApiProperty({ description: 'Target apartment — must be in the same tenant' })
  @IsString() @MaxLength(80)
  apartmentId!: string
}

export class BulkResidentStatusDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  ids!: string[]

  @ApiProperty({ enum: RESIDENT_SIGNATURE_STATUSES })
  @IsIn(RESIDENT_SIGNATURE_STATUSES as unknown as string[])
  status!: string
}

/**
 * Turning a resident's portal inbox on or off.
 *
 * Only the flag. The resident comes from the path and the tenant from the
 * authenticated session, so there is no field here through which a caller could
 * point the grant at somebody else.
 */
export class SetPortalAccessDto {
  @ApiProperty({ description: 'Whether the PORTAL channel may be used for this resident' })
  @IsBoolean()
  enabled!: boolean
}
