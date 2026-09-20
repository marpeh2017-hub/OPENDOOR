import {
  IsString, IsOptional, IsIn, IsBoolean, IsInt, Min, Max, MaxLength, IsObject,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  NOTIFICATION_KINDS, NOTIFICATION_ENTITY_TYPES,
  type NotificationKind, type NotificationEntityType,
} from '../notification-kinds'

/**
 * Explicit DTOs only — no `@Body()` spreads and no `@Body('field')` extraction.
 * Both have been real bugs in this codebase (mass assignment into
 * `prisma.*.create`, and silently-undefined values), so every field a caller may
 * set is declared here and the global ValidationPipe runs with
 * `forbidNonWhitelisted`.
 *
 * Note what is ABSENT and cannot be set by a caller: `tenantId` (taken from the
 * JWT), `isRead`/`readAt` (only the mark-read endpoints move those), and
 * `createdAt`.
 */
export class CreateNotificationDto {
  /**
   * The RECIPIENT. Note this is not the actor — an admin creating a
   * notification is addressing someone else. The service verifies the target
   * user is in the caller's tenant and 404s if not, so this field cannot be
   * used to probe for user ids in other tenants.
   */
  @ApiProperty({ description: 'Recipient user id (must be in the caller tenant)' })
  @IsString()
  @MaxLength(64)
  userId!: string

  @ApiProperty({ enum: NOTIFICATION_KINDS })
  @IsIn(NOTIFICATION_KINDS as unknown as string[])
  type!: NotificationKind

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  body!: string

  /** Relative in-app path, e.g. `/meetings/abc123`. Absolute URLs are refused. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  link?: string

  @ApiPropertyOptional({ enum: NOTIFICATION_ENTITY_TYPES })
  @IsOptional()
  @IsIn(NOTIFICATION_ENTITY_TYPES as unknown as string[])
  entityType?: NotificationEntityType

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}

export class ListNotificationsQueryDto {
  /**
   * `true` returns only unread, `false` only read, omitted returns both.
   *
   * Parsed from the RAW source object, not from `value`.
   *
   * Two traps here, and the test suite pins both. First, a query string arrives
   * as text and `Boolean('false')` is `true`, so `@Type(() => Boolean)` would
   * make `?unreadOnly=false` mean the opposite of what it says. Second — and
   * this is the one that actually bit — the global ValidationPipe runs with
   * `enableImplicitConversion: true`, which coerces the string to a boolean by
   * that same broken rule BEFORE any `@Transform` receives it. By then `value`
   * is already `true` and the damage is unrecoverable.
   *
   * Reading `obj[...]` gets the untouched original, so the literal is parsed
   * exactly once and correctly. Anything that is not a recognised literal is
   * passed through unchanged so `@IsBoolean` answers 400 rather than guessing.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ obj }) => {
    const raw = (obj as Record<string, unknown>)?.unreadOnly
    if (raw === 'true' || raw === true) return true
    if (raw === 'false' || raw === false) return false
    return raw
  })
  @IsBoolean()
  unreadOnly?: boolean

  @ApiPropertyOptional({ enum: NOTIFICATION_KINDS })
  @IsOptional()
  @IsIn(NOTIFICATION_KINDS as unknown as string[])
  type?: NotificationKind

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}

/** Body for PATCH /notifications/:id/read — present so the route is not bodyless. */
export class MarkReadDto {
  /** Defaults to true; `false` marks a notification unread again. */
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean
}
