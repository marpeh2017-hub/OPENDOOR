import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import { mapDomainErrors } from '../common/errors/domain-error'
import { MeetingAccessService } from './meeting-access.service'
import { ResidentAttendanceDto, ResidentRsvpDto } from './dto/meeting-invite.dto'

/**
 * The resident-facing meeting invitation surface.
 *
 * `@Public()` — there is no JWT here, by design. A resident is not a `User` and
 * never will be; the bearer credential is the invitation token in the path, and
 * `MeetingAccessService` derives the tenant from it rather than trusting
 * anything the caller sends.
 *
 * Kept in its own controller rather than added to `MeetingsController` so the
 * unauthenticated routes are impossible to miss when reading the file, and so
 * the class-level `@Roles`/`@ApiBearerAuth` posture of the staff controller
 * never accidentally applies to them.
 *
 * THROTTLED HARDER THAN THE DEFAULT. These endpoints are reachable by anyone on
 * the internet with a URL-shaped guess. The token is 48 random bytes so guessing
 * is not a real threat, but rate limiting turns "not a real threat" into "not a
 * measurable one", and it caps the damage a leaked link can do per minute.
 */
@ApiTags('meeting-invitations')
@Controller({ path: 'meeting-invitations', version: '1' })
export class MeetingInviteController {
  constructor(private readonly access: MeetingAccessService) {}

  @Public()
  @Throttle({ short: { limit: 6, ttl: 60_000 } })
  @Get(':token')
  @ApiOperation({ summary: 'View a meeting invitation (resident, tokenised)' })
  view(@Param('token') token: string) {
    return mapDomainErrors(() => this.access.view(token))
  }

  @Public()
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @Post(':token/rsvp')
  @ApiOperation({ summary: 'Resident answers the invitation' })
  rsvp(@Param('token') token: string, @Body() dto: ResidentRsvpDto, @Req() req: any) {
    return mapDomainErrors(() =>
      this.access.rsvp(token, dto.rsvpStatus, { ip: req.ip ?? null }),
    )
  }

  @Public()
  @Throttle({ short: { limit: 10, ttl: 60_000 } })
  @Post(':token/attendance')
  @ApiOperation({ summary: 'Resident confirms whether they attended' })
  attendance(@Param('token') token: string, @Body() dto: ResidentAttendanceDto) {
    return mapDomainErrors(() => this.access.confirmAttendance(token, dto.attended))
  }
}
