import {
  IsString, IsOptional, IsIn, IsBoolean, IsObject, IsArray, IsInt,
  ValidateNested, MaxLength, MinLength, Min, Max, ArrayMaxSize,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  AUTOMATION_TRIGGERS, AUTOMATION_ACTION_TYPES,
  type AutomationTriggerName, type AutomationActionTypeName,
} from '../automation-catalog'

/**
 * Explicit DTOs. Note what a caller CANNOT set: `tenantId` (from the JWT),
 * `runCount` and `lastRunAt` (owned by the runner — a client that could write
 * them could fake an automation's execution history).
 */

export class AutomationActionInputDto {
  @ApiProperty({ description: 'Execution order within the automation, ascending' })
  @IsInt()
  @Min(0)
  @Max(100)
  order!: number

  @ApiProperty({ enum: AUTOMATION_ACTION_TYPES })
  @IsIn(AUTOMATION_ACTION_TYPES as unknown as string[])
  type!: AutomationActionTypeName

  @ApiProperty({ description: 'Action-specific configuration', type: Object })
  @IsObject()
  config!: Record<string, unknown>

  @ApiPropertyOptional({ description: 'Delay before this action runs', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60 * 24 * 30)
  delayMinutes?: number
}

export class CreateAutomationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @ApiProperty({ enum: AUTOMATION_TRIGGERS })
  @IsIn(AUTOMATION_TRIGGERS as unknown as string[])
  trigger!: AutomationTriggerName

  @ApiPropertyOptional({ description: 'Scope to one project. Omit for tenant-wide.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectId?: string

  @ApiPropertyOptional({ description: 'Trigger filter conditions', type: Object })
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>

  /**
   * Created INACTIVE unless the caller opts in. An automation is a standing
   * instruction that fires without anyone watching, so the safe default is that
   * saving one does not arm it.
   */
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean


  @ApiPropertyOptional({
    description: 'Max outbound sends per rolling hour. Null means no hourly cap.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  sendCapPerHour?: number

  @ApiPropertyOptional({
    description: 'Max outbound sends per rolling day. Null means no daily cap.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  sendCapPerDay?: number

  @ApiProperty({ type: [AutomationActionInputDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AutomationActionInputDto)
  actions!: AutomationActionInputDto[]
}

export class UpdateAutomationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean


  @ApiPropertyOptional({
    description: 'Max outbound sends per rolling hour. Null means no hourly cap.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  sendCapPerHour?: number

  @ApiPropertyOptional({
    description: 'Max outbound sends per rolling day. Null means no daily cap.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  sendCapPerDay?: number

  /** Replaces the whole action list when present. Partial edits of one action
   *  are not supported: ordering is a property of the SET, not of a row. */
  @ApiPropertyOptional({ type: [AutomationActionInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AutomationActionInputDto)
  actions?: AutomationActionInputDto[]
}

export class SetDryRunDto {
  @ApiProperty({
    description:
      'False takes the automation LIVE — real residents receive real messages. ' +
      'True returns it to dry run.',
  })
  @IsBoolean()
  dryRun!: boolean
}
