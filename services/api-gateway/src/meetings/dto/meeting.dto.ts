import {
  IsString, IsOptional, IsIn, IsBoolean, IsInt, IsArray, ValidateNested,
  IsDateString, MaxLength, Min, Max, IsUrl,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  MEETING_STATUSES, RSVP_STATUSES, ATTENDEE_ROLES,
  type MeetingStatus, type RsvpStatus, type AttendeeRole,
} from '../meeting-constants'

/**
 * Explicit DTOs. No `@Body()` spreads, no `@Body('field')` extraction — both
 * have been real bugs here. Notice what a caller CANNOT set: `tenantId`
 * (from the JWT), `createdById` (from the JWT), `cancelledAt` (only the cancel
 * endpoint), and on an attendee `rsvpStatus`/`respondedAt` (only the RSVP
 * endpoint, and only by the invitee themselves).
 */

/** One invitee. Exactly one of `userId` / `residentId` must be present. */
export class MeetingAttendeeInputDto {
  @ApiPropertyOptional({ description: 'Internal staff user (same tenant)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string

  @ApiPropertyOptional({ description: 'Resident (must belong to the same tenant)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  residentId?: string

  @ApiPropertyOptional({ enum: ATTENDEE_ROLES })
  @IsOptional()
  @IsIn(ATTENDEE_ROLES as unknown as string[])
  role?: AttendeeRole
}

export class CreateMeetingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean

  /**
   * Validated as a URL rather than a free string: it is rendered as a click
   * target in the CRM and in notification bodies, so `javascript:` and friends
   * must not survive. Only http/https are accepted.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  meetingUrl?: string

  @ApiProperty({ description: 'ISO 8601' })
  @IsDateString()
  startTime!: string

  @ApiPropertyOptional({ description: 'ISO 8601; must be after startTime' })
  @IsOptional()
  @IsDateString()
  endTime?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string

  /**
   * Invitees, set at creation. Each one gets a MEETING notification.
   * Omitted means a meeting with no attendees, which is legitimate — a
   * placeholder in the calendar that gets invitees added later.
   */
  @ApiPropertyOptional({ type: [MeetingAttendeeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeetingAttendeeInputDto)
  attendees?: MeetingAttendeeInputDto[]
}

/**
 * Edit. `attendees` is deliberately ABSENT — attendee management has its own
 * endpoints, because adding one person should not require resubmitting the
 * whole roster (and a race between two editors would silently drop invitees).
 * `status` is absent too: completing and cancelling are their own transitions.
 */
export class UpdateMeetingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  meetingUrl?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startTime?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endTime?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string
}

export class CancelMeetingDto {
  /** Included verbatim in the cancellation notification, so it is length-capped. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}

/** Marks the meeting as having taken place. */
export class CompleteMeetingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string
}

/** The invitee's own answer. Only the invitee may send this. */
export class RsvpDto {
  @ApiProperty({ enum: RSVP_STATUSES })
  @IsIn(RSVP_STATUSES as unknown as string[])
  rsvpStatus!: RsvpStatus
}

/** Attendance, recorded by an organiser after the meeting. */
export class SetAttendanceDto {
  @ApiProperty({ description: 'null clears a previously recorded value' })
  @IsOptional()
  @IsBoolean()
  attended!: boolean | null
}

export class ListMeetingsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectId?: string

  @ApiPropertyOptional({ enum: MEETING_STATUSES })
  @IsOptional()
  @IsIn(MEETING_STATUSES as unknown as string[])
  status?: MeetingStatus

  /** Inclusive lower bound on startTime. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string

  /** Exclusive upper bound on startTime. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string

  /**
   * Only meetings the caller is invited to.
   *
   * Parsed from the RAW source object for the same reason as
   * `ListNotificationsQueryDto.unreadOnly`: the global ValidationPipe runs with
   * `enableImplicitConversion`, which turns the string `'false'` into `true`
   * before any `@Transform` sees it.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ obj }) => {
    const raw = (obj as Record<string, unknown>)?.mineOnly
    if (raw === 'true' || raw === true) return true
    if (raw === 'false' || raw === false) return false
    return raw
  })
  @IsBoolean()
  mineOnly?: boolean

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}

/**
 * Wrapper for POST /meetings/:id/attendees.
 *
 * A wrapper object rather than a bare array because `forbidNonWhitelisted`
 * validation only applies to a class instance — a top-level array body would
 * skip the whitelist entirely, which is precisely the mass-assignment gap that
 * `@Body()` spreads used to open here.
 */
export class AddAttendeesDto {
  @ApiProperty({ type: [MeetingAttendeeInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeetingAttendeeInputDto)
  attendees!: MeetingAttendeeInputDto[]
}
