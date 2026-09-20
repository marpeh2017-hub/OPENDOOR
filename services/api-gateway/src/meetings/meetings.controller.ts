import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Request,
  HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES, MEETING_WRITE_ROLES } from '../auth/roles.constants'
import { MeetingsService } from './meetings.service'
import {
  CreateMeetingDto, UpdateMeetingDto, ListMeetingsQueryDto, CancelMeetingDto,
  CompleteMeetingDto, RsvpDto, SetAttendanceDto, AddAttendeesDto,
} from './dto/meeting.dto'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'

/**
 * Meetings API.
 *
 * RBAC HAS THREE TIERS HERE, and the split is about what each action means:
 *
 *   READ (`STAFF_ROLES`) — every staff role can see the calendar, including the
 *   read-only observers (MUNICIPALITY_USER, EXTERNAL_CONSULTANT). A meeting
 *   they were invited to that they cannot see would be useless.
 *
 *   RSVP (`STAFF_ROLES`) — answering an invitation is first-person, and the
 *   service matches on the caller's own `userId`, so an observer can answer
 *   their own invitation but literally cannot answer anyone else's. Gating this
 *   by write-role would mean invited consultants could not reply.
 *
 *   WRITE (`MEETING_WRITE_ROLES`) — scheduling, editing, cancelling, managing
 *   the roster and recording attendance. Narrower than STAFF_ROLES: observers
 *   attend meetings, they do not convene them.
 *
 * Cross-tenant always answers 404, never 403.
 */
@ApiTags('meetings')
@ApiBearerAuth()
@Controller({ path: 'meetings', version: '1' })
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List meetings in the tenant' })
  findAll(@Request() req: any, @Query() query: ListMeetingsQueryDto) {
    return mapDomainErrors(() => this.meetings.findAll(actorFrom(req), query))
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'One meeting with its attendees (404 across tenants)' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return mapDomainErrors(() => this.meetings.findOne(tenantFrom(req), id))
  }

  @Post()
  @Roles(...MEETING_WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a meeting and invite attendees' })
  create(@Request() req: any, @Body() dto: CreateMeetingDto) {
    return mapDomainErrors(() => this.meetings.create(actorFrom(req), dto))
  }

  @Patch(':id')
  @Roles(...MEETING_WRITE_ROLES)
  @ApiOperation({ summary: 'Edit a meeting (attendees have their own endpoints)' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateMeetingDto) {
    return mapDomainErrors(() => this.meetings.update(actorFrom(req), id, dto))
  }

  @Patch(':id/cancel')
  @Roles(...MEETING_WRITE_ROLES)
  @ApiOperation({ summary: 'Cancel — a state change, not a delete; notifies attendees' })
  cancel(@Request() req: any, @Param('id') id: string, @Body() dto: CancelMeetingDto) {
    return mapDomainErrors(() => this.meetings.cancel(actorFrom(req), id, dto))
  }

  @Patch(':id/complete')
  @Roles(...MEETING_WRITE_ROLES)
  @ApiOperation({ summary: 'Mark as having taken place' })
  complete(@Request() req: any, @Param('id') id: string, @Body() dto: CompleteMeetingDto) {
    return mapDomainErrors(() => this.meetings.complete(actorFrom(req), id, dto))
  }

  @Delete(':id')
  @Roles(...MEETING_WRITE_ROLES)
  @ApiOperation({ summary: 'Delete — refused once anyone has been invited (cancel instead)' })
  remove(@Request() req: any, @Param('id') id: string) {
    return mapDomainErrors(() => this.meetings.remove(actorFrom(req), id))
  }

  // ── Attendees ────────────────────────────────────────────────────────────

  @Post(':id/attendees')
  @Roles(...MEETING_WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite attendees; already-invited entries are skipped' })
  addAttendees(@Request() req: any, @Param('id') id: string, @Body() dto: AddAttendeesDto) {
    return mapDomainErrors(() => this.meetings.addAttendees(actorFrom(req), id, dto.attendees))
  }

  @Delete(':id/attendees/:attendeeId')
  @Roles(...MEETING_WRITE_ROLES)
  @ApiOperation({ summary: 'Uninvite an attendee' })
  removeAttendee(
    @Request() req: any,
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string,
  ) {
    return mapDomainErrors(() => this.meetings.removeAttendee(actorFrom(req), id, attendeeId))
  }

  /**
   * The caller's OWN answer. STAFF_ROLES, not MEETING_WRITE_ROLES — see the
   * class comment: an invited observer must be able to reply to their own
   * invitation, and the service makes it impossible to reply to anyone else's.
   */
  @Patch(':id/rsvp')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: "Answer your OWN invitation (404 if you are not invited)" })
  rsvp(@Request() req: any, @Param('id') id: string, @Body() dto: RsvpDto) {
    return mapDomainErrors(() => this.meetings.rsvp(actorFrom(req), id, dto))
  }

  @Patch(':id/attendees/:attendeeId/attendance')
  @Roles(...MEETING_WRITE_ROLES)
  @ApiOperation({ summary: 'Record who actually turned up (distinct from RSVP)' })
  setAttendance(
    @Request() req: any,
    @Param('id') id: string,
    @Param('attendeeId') attendeeId: string,
    @Body() dto: SetAttendanceDto,
  ) {
    return mapDomainErrors(() =>
      this.meetings.setAttendance(actorFrom(req), id, attendeeId, dto),
    )
  }
}
