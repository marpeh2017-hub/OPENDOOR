import { IsBoolean, IsIn, IsNotEmpty, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { RSVP_STATUSES, type RsvpStatus } from '../meeting-constants'

/**
 * A resident's answer, submitted through their invitation link.
 *
 * `pending` is accepted by `RSVP_STATUSES` but excluded here: a resident
 * pressing a button is answering, and "un-answering" back to pending would
 * erase the fact that they replied. Staff can still see the original
 * `respondedAt`.
 */
export const RESIDENT_RSVP_ANSWERS = RSVP_STATUSES.filter((s) => s !== 'pending')

export class ResidentRsvpDto {
  @ApiProperty({ enum: RESIDENT_RSVP_ANSWERS })
  @IsIn(RESIDENT_RSVP_ANSWERS, {
    message: `rsvpStatus must be one of: ${RESIDENT_RSVP_ANSWERS.join(', ')}`,
  })
  rsvpStatus!: Exclude<RsvpStatus, 'pending'>
}

export class ResidentAttendanceDto {
  @ApiProperty({ description: 'Did the resident actually attend?' })
  @IsBoolean()
  attended!: boolean
}

/** Token in the path is validated for shape before it reaches the database. */
export class InviteTokenParamDto {
  @IsString() @IsNotEmpty()
  token!: string
}
