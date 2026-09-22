import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator'

/**
 * The write surface for a saved report configuration.
 *
 * The controller previously spread `@Body() body: any` into Prisma. `tenantId`
 * and `createdById` were appended after the spread and so could not be
 * overridden — but every other column could be set from a request, including
 * `lastGeneratedAt` and `lastOutputUrl`, which only the generator should write.
 */
const nullable = () => ValidateIf((_object: unknown, value: unknown) => value !== null)

export class CreateSavedReportDto {
  @ApiProperty() @IsString() @MaxLength(200) name!: string
  @ApiProperty() @IsString() @MaxLength(60) type!: string
  @ApiProperty() @IsObject() config!: Record<string, unknown>
  @ApiPropertyOptional() @IsOptional() @nullable() @IsObject() schedule?: Record<string, unknown> | null
  @ApiPropertyOptional() @IsOptional() @nullable() @IsString() @MaxLength(60) projectId?: string | null
}
