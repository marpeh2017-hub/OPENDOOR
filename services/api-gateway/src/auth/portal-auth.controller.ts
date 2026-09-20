import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { PortalAuthService } from './portal-auth.service'
import { ResidentIdentityService } from './resident-identity.service'
import { Public } from './decorators/public.decorator'
import { Roles } from './decorators/roles.decorator'
import { CurrentUser, type CurrentUserPayload } from './decorators/current-user.decorator'
import { RESIDENT_INVITE_ROLES } from './roles.constants'
import {
  IssueResidentInvitationDto,
  PortalSelectResidentDto,
  RevokeResidentInvitationDto,
} from './dto/portal-login.dto'

/**
 * Resident portal sign-in, and the staff side that issues the links.
 *
 * ── WHY THE OTP ROUTES ARE NOT HERE ─────────────────────────────────────────
 *
 * `POST /auth/otp/send` and `/auth/otp/verify` stay on `AuthController` at the
 * paths they have always had, now backed by `PortalAuthService`. Publishing a
 * second, "real" pair of login routes would have left the older pair live and
 * weaker — and an unused login endpoint is not harmless, it is the one nobody
 * remembers to re-check. There is one resident login; this controller adds the
 * steps around it.
 *
 * ── RATE LIMITS ─────────────────────────────────────────────────────────────
 *
 * Per-IP, layered over the per-phone budgets the service already enforces.
 * The two answer different attacks: the per-phone cap stops one number being
 * hammered, and these stop one source working through many numbers or many
 * invitation tokens.
 */
@ApiTags('auth')
@Controller({ path: 'auth/portal', version: '1' })
export class PortalAuthController {
  constructor(
    private readonly portal: PortalAuthService,
    private readonly identity: ResidentIdentityService,
  ) {}

  /**
   * What an invitation link points at, before anyone types a code.
   *
   * The tightest limit on this controller. The token is the secret, the
   * response distinguishes a real one from an invalid one, and unlike a phone
   * number an attacker can generate candidates without limit — so this is the
   * one route where guessing is the whole attack.
   */
  @Public()
  @Get('invitation/:token')
  @Throttle({
    short: { limit: 3, ttl: 10_000 },
    medium: { limit: 10, ttl: 60_000 },
    long: { limit: 30, ttl: 600_000 },
  })
  @ApiOperation({ summary: 'Preview a resident invitation link' })
  @ApiResponse({
    status: 401,
    description:
      'One message for every rejection — expired, revoked, already used and ' +
      'never-existed are indistinguishable to the caller by design.',
  })
  preview(@Param('token') token: string) {
    return this.portal.previewInvitation(token)
  }

  /**
   * Step 3 of sign-in: the caller picks which of THEIR OWN resident files to
   * open, when one phone number matched more than one.
   */
  @Public()
  @Post('select')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 3, ttl: 10_000 },
    medium: { limit: 10, ttl: 60_000 },
  })
  @ApiOperation({ summary: 'Complete a login that matched several resident records' })
  select(@Body() dto: PortalSelectResidentDto) {
    return this.portal.completeSelection(dto.selectionToken, dto.residentId)
  }

  // ── Staff side ────────────────────────────────────────────────────────────

  /**
   * Issues a portal login link for one resident and returns it ONCE.
   *
   * The response body is the only time the raw token exists outside the
   * recipient's SMS: the row stores a hash. Re-reading it later is impossible
   * on purpose, and the answer to a lost link is a new one, which revokes its
   * predecessor.
   */
  @Post('invitations')
  @Roles(...RESIDENT_INVITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue a portal login link for a resident' })
  @ApiResponse({ status: 403, description: 'The resident belongs to another tenant.' })
  async issue(@CurrentUser() user: CurrentUserPayload, @Body() dto: IssueResidentInvitationDto) {
    const issued = await this.identity.issueInvitation({
      residentId: dto.residentId,
      actorTenantId: user.tenantId,
      actorUserId: user.userId,
      ttlHours: dto.ttlHours,
    })
    return {
      invitationId: issued.invitationId,
      token: issued.token,
      expiresAt: issued.expiresAt,
      phone: issued.phone,
      resident: {
        id: issued.context.residentId,
        name: issued.context.residentName,
        projectName: issued.context.projectName,
        buildingAddress: issued.context.buildingAddress,
        apartmentNumber: issued.context.apartmentNumber,
      },
    }
  }

  /** Withdraws an outstanding link — a wrong number, or a resident who left. */
  @Delete('invitations/:id')
  @Roles(...RESIDENT_INVITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke an outstanding portal login link' })
  async revoke(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: RevokeResidentInvitationDto,
  ) {
    await this.identity.revokeInvitation(id, user.tenantId, dto.reason ?? 'REVOKED_BY_STAFF')
  }
}
