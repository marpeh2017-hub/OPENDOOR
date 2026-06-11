import {
  IsString, IsOptional, IsEmail, IsNumber, IsBoolean, IsEnum, Min, Max,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateResidentDto {
  @ApiProperty()
  @IsString()
  apartmentId!: string

  @ApiProperty()
  @IsString()
  firstName!: string

  @ApiProperty()
  @IsString()
  lastName!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationalId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercentage?: number

  @ApiPropertyOptional({ enum: ['he', 'en', 'ru', 'ar'], default: 'he' })
  @IsOptional()
  @IsEnum(['he', 'en', 'ru', 'ar'])
  language?: string

  @ApiPropertyOptional({ enum: ['WHATSAPP', 'SMS', 'EMAIL', 'PUSH'] })
  @IsOptional()
  @IsEnum(['WHATSAPP', 'SMS', 'EMAIL', 'PUSH'])
  preferredChannel?: string

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean
}
