import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Payload accepted from the public marketing site.
 *
 * Deliberately narrower than CreateLeadDto: it carries only the fields a
 * visitor fills in. status, score, assignedToId, campaignId, source and
 * language are absent, so an anonymous caller cannot set them — the service
 * fixes source and status itself. Adding a field here widens what the open
 * internet can write to the leads table, so add nothing without meaning to.
 */
export class CreatePublicLeadDto {
  @ApiProperty() @IsString() @MaxLength(60)
  firstName!: string

  @ApiProperty() @IsString() @MaxLength(60)
  lastName!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(25)
  phone?: string

  @ApiPropertyOptional() @IsOptional() @IsEmail()
  email?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  address?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  city?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  notes?: string
}
