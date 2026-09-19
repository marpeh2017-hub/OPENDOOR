import { IsString, IsOptional, IsEnum, IsArray, IsDateString, IsBoolean } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateSignerDto {
  @ApiProperty() @IsString() declare ownerId: string
  @ApiPropertyOptional() @IsOptional() @IsString() ownerApartmentId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() signerRole?: string
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean
  @ApiPropertyOptional() @IsOptional() signingOrder?: number
}

export class CreatePackageDto {
  @ApiProperty() @IsString() declare projectId: string
  @ApiProperty() @IsString() declare title: string
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string
  @ApiPropertyOptional() @IsOptional() @IsString() documentId?: string
  @ApiPropertyOptional() @IsOptional() @IsEnum(['PARALLEL', 'SEQUENTIAL']) signingOrder?: string
  @ApiPropertyOptional() @IsOptional() @IsEnum(['SMS_OTP', 'EMAIL_LINK', 'COMBINED', 'NONE']) verificationMethod?: string
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string
  @ApiPropertyOptional() @IsOptional() @IsArray() signers?: CreateSignerDto[]
}
