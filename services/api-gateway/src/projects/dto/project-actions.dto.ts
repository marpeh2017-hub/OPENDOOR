import { IsIn, IsOptional, IsString, MaxLength, IsArray, ArrayNotEmpty } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export const PROJECT_STAGES = [
  'DISCOVERY', 'FEASIBILITY', 'RESIDENT_ORGANIZATION', 'SIGNATURES',
  'DEVELOPER_SELECTION', 'PLANNING', 'MUNICIPAL_APPROVAL', 'PERMIT',
  'EVACUATION', 'CONSTRUCTION', 'DELIVERY', 'POST_DELIVERY',
] as const

export const PROJECT_STATUSES = [
  'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED',
] as const

export const PROJECT_TEAM_ROLES = ['projectManagerId', 'lawyerId', 'architectId'] as const

/**
 * Replaces `@Body('stage')` / `@Body('notes')` extraction on the stage endpoint.
 * Per-property `@Body('x')` skips the global ValidationPipe entirely, which is
 * how an unvalidated `status` reached the leads service — never reintroduce it.
 */
export class AdvanceStageDto {
  @ApiProperty({ enum: PROJECT_STAGES }) @IsIn(PROJECT_STAGES as unknown as string[])
  stage!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  notes?: string
}

export class ChangeProjectStatusDto {
  @ApiProperty({ enum: PROJECT_STATUSES }) @IsIn(PROJECT_STATUSES as unknown as string[])
  status!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  reason?: string
}

/**
 * Statuses a project may be RESTORED to. `ARCHIVED` is deliberately absent —
 * restoring to archived is a no-op dressed up as an action, and would let a
 * caller "restore" a project straight back out of every default list.
 */
export const PROJECT_RESTORE_STATUSES = [
  'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED',
] as const

export class ArchiveProjectDto {
  @ApiPropertyOptional({ description: 'Why the project is being archived (audited)' })
  @IsOptional() @IsString() @MaxLength(1000)
  reason?: string
}

export class RestoreProjectDto {
  @ApiPropertyOptional({
    enum: PROJECT_RESTORE_STATUSES,
    description:
      'Status to restore to. Omit to fall back to the status the project held ' +
      'immediately before it was archived (read from the audit trail), or ACTIVE.',
  })
  @IsOptional() @IsIn(PROJECT_RESTORE_STATUSES as unknown as string[])
  status?: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  reason?: string
}

export class AssignProjectTeamDto {
  @ApiPropertyOptional({ description: 'User id, or null to clear' })
  @IsOptional() @IsString()
  projectManagerId?: string | null

  @ApiPropertyOptional() @IsOptional() @IsString()
  lawyerId?: string | null

  @ApiPropertyOptional() @IsOptional() @IsString()
  architectId?: string | null
}

export class AddProjectMemberDto {
  @ApiProperty() @IsString()
  userId!: string

  @ApiPropertyOptional({ description: 'Defaults to the user\u2019s own role' })
  @IsOptional() @IsString()
  role?: string
}

/** Bulk status / archive across several projects. */
export class BulkProjectStatusDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  ids!: string[]

  @ApiProperty({ enum: PROJECT_STATUSES }) @IsIn(PROJECT_STATUSES as unknown as string[])
  status!: string

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  reason?: string
}
