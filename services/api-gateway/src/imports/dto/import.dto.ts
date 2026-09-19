import {
  IsArray, ArrayNotEmpty, ArrayMaxSize, IsEnum, IsInt, IsOptional, IsString,
  MaxLength, Min, Max, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ImportEntityType, ImportMode, ImportJobStatus, ImportIssueSeverity,
  ImportDecisionAction,
} from '@prisma/client'

/**
 * Explicit DTOs, every field declared.
 *
 * No `@Body()` spread reaches a Prisma `data` object anywhere in this module,
 * and no handler uses `@Body('field')` — that form bypasses the global
 * `ValidationPipe` entirely, so `forbidNonWhitelisted` would not run and an
 * unexpected property would sail through. Both of those have been real bugs in
 * this codebase; neither is repeated here.
 */

/**
 * Multipart bodies arrive as strings — `transform: true` alone will not turn
 * `"OWNER"` into an enum member or `"3"` into a number, so anything numeric
 * here carries an explicit `@Type`.
 */
export class UploadImportDto {
  @ApiProperty({ description: 'Project the rows belong to. Tenancy is inherited from it.' })
  @IsString() @MaxLength(80)
  projectId!: string

  @ApiProperty({ enum: ImportEntityType, default: ImportEntityType.OWNER })
  @IsEnum(ImportEntityType)
  entityType!: ImportEntityType

  @ApiPropertyOptional({ enum: ImportMode, default: ImportMode.ADD_AND_UPDATE })
  @IsOptional() @IsEnum(ImportMode)
  mode?: ImportMode
}

/** One confirmed field → column assignment. */
export class ColumnMappingEntryDto {
  @ApiProperty({ description: 'Import field key, e.g. `fullName`' })
  @IsString() @MaxLength(40)
  field!: string

  @ApiProperty({ description: '0-based sheet column index' })
  @Type(() => Number) @IsInt() @Min(0) @Max(1000)
  index!: number
}

export class ConfirmMappingDto {
  @ApiProperty({ type: [ColumnMappingEntryDto] })
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => ColumnMappingEntryDto)
  mapping!: ColumnMappingEntryDto[]

  @ApiPropertyOptional({ enum: ImportMode })
  @IsOptional() @IsEnum(ImportMode)
  mode?: ImportMode
}

export class CommitImportDto {
  /**
   * Allows the user to change their mind about the mode on the confirm screen
   * without re-doing the mapping. Omitted means "as chosen at mapping time".
   */
  @ApiPropertyOptional({ enum: ImportMode })
  @IsOptional() @IsEnum(ImportMode)
  mode?: ImportMode
}

export class PreviewQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number

  @ApiPropertyOptional({ default: 100, maximum: 500 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500)
  pageSize?: number
}

export class ListImportsQueryDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(80)
  projectId?: string

  @ApiPropertyOptional({ enum: ImportJobStatus })
  @IsOptional() @IsEnum(ImportJobStatus)
  status?: ImportJobStatus
}

/**
 * One ruling on one ambiguous row.
 *
 * `targetEntityId` is only meaningful for UPDATE_EXISTING; the service refuses
 * it on the other actions rather than ignoring it, so a client that sends a
 * target with SKIP learns it was not applied instead of assuming it was.
 * There is deliberately no MERGE action — see the ImportRowDecision model.
 */
export class RowDecisionDto {
  @ApiProperty({ description: '1-based row number as seen in Excel' })
  @Type(() => Number) @IsInt() @Min(1)
  rowNumber!: number

  @ApiProperty({ enum: ImportDecisionAction })
  @IsEnum(ImportDecisionAction)
  action!: ImportDecisionAction

  @ApiPropertyOptional({ description: 'Existing record id; required for UPDATE_EXISTING' })
  @IsOptional() @IsString() @MaxLength(80)
  targetEntityId?: string

  @ApiPropertyOptional({ description: 'Optional justification. Never echo sheet values here.' })
  @IsOptional() @IsString() @MaxLength(500)
  note?: string
}

export class ResolveReviewDto {
  @ApiProperty({ type: [RowDecisionDto] })
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(1000)
  @ValidateNested({ each: true }) @Type(() => RowDecisionDto)
  decisions!: RowDecisionDto[]
}

export class ListIssuesQueryDto {
  @ApiPropertyOptional({ enum: ImportIssueSeverity })
  @IsOptional() @IsEnum(ImportIssueSeverity)
  severity?: ImportIssueSeverity
}
