import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize, IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength, ValidateIf,
} from 'class-validator'

/**
 * The write surface for a task.
 *
 * `main.ts` runs ValidationPipe with `whitelist` and `forbidNonWhitelisted`,
 * so only the fields declared here can reach Prisma — and a field that is not
 * declared is REJECTED rather than dropped, which is the difference between a
 * guard that reports and a guard that goes quiet.
 *
 * `tenantId`, `createdById`, `createdAt` and `updatedAt` are deliberately
 * absent and can never be supplied by a client. Before this DTO existed the
 * controller passed `@Body() body: any` straight into `prisma.task.update`,
 * which let a caller move a task into another tenant by sending a `tenantId`.
 * The read was scoped to the tenant; the write was not.
 */
export const TASK_TYPES = ['CALL', 'MEETING', 'SITE_VISIT', 'SIGNATURE_FOLLOWUP', 'LEGAL_REVIEW', 'DOCUMENT_COLLECTION', 'APPROVAL', 'GENERAL'] as const
export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE'] as const
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

/** `null` clears an association; omitting the field leaves it alone. */
const nullableId = () => ValidateIf((object: Record<string, unknown>, value: unknown) => value !== null)

export class CreateTaskDto {
  @ApiProperty() @IsString() @MaxLength(300)
  title!: string

  @ApiPropertyOptional({ enum: TASK_TYPES }) @IsOptional() @IsIn(TASK_TYPES)
  type?: (typeof TASK_TYPES)[number]

  @ApiPropertyOptional({ enum: TASK_STATUSES }) @IsOptional() @IsIn(TASK_STATUSES)
  status?: (typeof TASK_STATUSES)[number]

  @ApiPropertyOptional({ enum: TASK_PRIORITIES }) @IsOptional() @IsIn(TASK_PRIORITIES)
  priority?: (typeof TASK_PRIORITIES)[number]

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000)
  description?: string | null

  @ApiPropertyOptional() @IsOptional() @nullableId() @IsString() @MaxLength(60)
  assigneeId?: string | null

  @ApiPropertyOptional() @IsOptional() @nullableId() @IsString() @MaxLength(60)
  projectId?: string | null

  @ApiPropertyOptional() @IsOptional() @nullableId() @IsString() @MaxLength(60)
  leadId?: string | null

  @ApiPropertyOptional() @IsOptional() @nullableId() @IsString() @MaxLength(60)
  residentId?: string | null

  @ApiPropertyOptional() @IsOptional() @nullableId() @IsString() @MaxLength(60)
  meetingId?: string | null

  @ApiPropertyOptional() @IsOptional() @nullableId() @IsString() @MaxLength(60)
  blockedById?: string | null

  @ApiPropertyOptional() @IsOptional() @nullableId() @IsDateString()
  dueDate?: string | null

  @ApiPropertyOptional() @IsOptional() @nullableId() @IsDateString()
  completedAt?: string | null

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true })
  tags?: string[]

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000)
  notes?: string | null
}

/** Every field optional: a partial correction must not have to resend the task. */
export class UpdateTaskDto extends CreateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
  declare title: string
}
