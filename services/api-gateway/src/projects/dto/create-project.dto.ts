import { IsString, IsOptional, IsDateString, IsNumber } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateProjectDto {
  @ApiProperty() @IsString()
  name!: string

  @ApiProperty() @IsString()
  city!: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  address?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  neighborhood?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  description?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  stage?: string

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  totalUnits?: number

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  signatureGoal?: number

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  startDate?: string

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  targetEndDate?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  projectManagerId?: string

  @ApiPropertyOptional() @IsOptional() @IsString()
  lawyerId?: string
}
