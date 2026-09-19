import {
  IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * `main.ts` runs ValidationPipe with `whitelist` + `forbidNonWhitelisted`, so
 * ONLY the fields declared here can reach the service. That is the enforcement
 * against mass assignment: the previous controller spread `@Body() body: any`
 * straight into `prisma.user.create`, which let a caller set `tenantId`,
 * `passwordHash`, `isVerified` or `mfaSecret` directly.
 *
 * `tenantId`, `passwordHash` and `mfaSecret` are deliberately absent from every
 * DTO below and can never be supplied by a client.
 */

export const ASSIGNABLE_ROLES = [
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'CEO', 'PROJECT_MANAGER',
  'RESIDENT_RELATIONS_MANAGER', 'FIELD_AGENT', 'LAWYER', 'ARCHITECT',
  'ENGINEER', 'DEVELOPER_REP', 'MUNICIPALITY_USER', 'EXTERNAL_CONSULTANT',
  'RESIDENT',
] as const

export class CreateUserDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string

  @ApiProperty({ enum: ASSIGNABLE_ROLES }) @IsIn(ASSIGNABLE_ROLES as unknown as string[])
  role!: string

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(160)
  email?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  phone?: string

  /** Hashed with the existing scrypt `hashPassword` — never stored or logged raw. */
  @ApiPropertyOptional({ minLength: 8 }) @IsOptional() @IsString() @MinLength(8) @MaxLength(200)
  password?: string

  @ApiPropertyOptional() @IsOptional() @IsIn(['he', 'en', 'ar', 'ru'])
  language?: string

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  firstName?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  lastName?: string

  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(160)
  email?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  phone?: string

  @ApiPropertyOptional() @IsOptional() @IsIn(['he', 'en', 'ar', 'ru'])
  language?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  avatarUrl?: string
}

/** Role changes are a separate, separately-audited endpoint. */
export class ChangeUserRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES }) @IsIn(ASSIGNABLE_ROLES as unknown as string[])
  role!: string
}

export class SetUserActiveDto {
  @ApiProperty() @IsBoolean()
  isActive!: boolean
}

export class ResetUserPasswordDto {
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(200)
  password!: string
}
