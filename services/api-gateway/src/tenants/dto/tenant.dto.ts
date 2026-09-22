import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator'

/**
 * The write surface for a tenant.
 *
 * `main.ts` runs ValidationPipe with `whitelist` and `forbidNonWhitelisted`,
 * so an undeclared field is rejected rather than silently dropped. The
 * controller previously took `@Body() body: any` and handed it to Prisma,
 * which made every column on the tenant — including ones nothing in the
 * product is supposed to set from a request — client-writable.
 *
 * `id`, `createdAt` and `updatedAt` are deliberately absent.
 */
export const TENANT_PLANS = ['starter', 'growth', 'enterprise'] as const
const nullable = () => ValidateIf((_object: unknown, value: unknown) => value !== null)

export class CreateTenantDto {
  @ApiProperty() @IsString() @MaxLength(200) name!: string

  /** Lowercase, url-safe: the slug addresses the tenant in public URLs. */
  @ApiProperty() @IsString() @MaxLength(80) @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
  slug!: string

  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(255) domain?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsUrl() @MaxLength(1000) logoUrl?: string | null
  @ApiPropertyOptional() @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) primaryColor?: string
  @ApiPropertyOptional() @IsOptional() @nullable() @IsUrl() @MaxLength(1000) website?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsEmail() @MaxLength(255) email?: string | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(40) phone?: string | null
  @ApiPropertyOptional() @IsOptional() @IsObject() settings?: Record<string, unknown>
  @ApiPropertyOptional() @IsOptional() @IsObject() features?: Record<string, unknown>
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean
  @ApiPropertyOptional() @IsOptional() @nullable() @IsDateString() trialEndsAt?: string | null
  @ApiPropertyOptional({ enum: TENANT_PLANS }) @IsOptional() @IsIn(TENANT_PLANS) plan?: (typeof TENANT_PLANS)[number]

  /**
   * Retention drives DELETEs, so the bound is part of the contract rather than
   * a convention somebody remembers: null means the platform default.
   */
  @ApiPropertyOptional() @IsOptional() @nullable() @IsInt() @Min(1) @Max(3650)
  notificationRetentionDays?: number | null
}

export class UpdateTenantDto extends CreateTenantDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) declare name: string
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/) declare slug: string
}
