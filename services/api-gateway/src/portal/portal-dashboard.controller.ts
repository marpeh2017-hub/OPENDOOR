import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { PortalDashboardService } from './portal-dashboard.service'
import { PortalDocumentsService } from './portal-documents.service'
import { PortalMessagesService } from './portal-messages.service'
import { PortalMessagesQueryDto } from './dto/portal-messages.dto'
import { PortalProfileService } from './portal-profile.service'
import { ContactUpdateRequestDto, UpdatePortalProfileDto } from './dto/portal-profile.dto'
import { PortalSupportService } from './portal-support.service'
import { CreateSupportTicketDto, CreateTicketReplyDto } from './dto/portal-support.dto'
import { PortalScopeService } from './portal-scope.service'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator'

/**
 * The resident-facing API.
 *
 * ── WHY THERE ARE NO PATH OR QUERY PARAMETERS ───────────────────────────────
 *
 * Not an oversight, and not a simplification to be undone when the next
 * endpoint needs "just one id". A resident-facing route that accepts an id
 * accepts it from the resident, and then has to prove — on every code path,
 * forever — that the id belongs to them. The proof is easy to write and easy
 * to forget, and forgetting it once is an IDOR.
 *
 * These routes take nothing. `PortalScopeService` derives the whole scope from
 * the authenticated session, so there is no parameter to check and none to
 * tamper with. Later portal endpoints that genuinely need to name a resource —
 * one document out of several — should scope the lookup by the session's ids
 * rather than validating the caller's, so an id that is not theirs is a 404
 * rather than a permission decision.
 */
@ApiTags('portal')
@ApiBearerAuth()
@Controller({ path: 'portal', version: '1' })
@Roles('RESIDENT')
export class PortalDashboardController {
  constructor(
    private readonly dashboard: PortalDashboardService,
    private readonly documents: PortalDocumentsService,
    private readonly messages: PortalMessagesService,
    private readonly profile: PortalProfileService,
    private readonly support: PortalSupportService,
    private readonly scopes: PortalScopeService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: "The signed-in resident's dashboard" })
  @ApiResponse({
    status: 401,
    description:
      'The session no longer matches the database — the resident was archived ' +
      'or moved since it was issued. The answer is a new session, not a new scope.',
  })
  @ApiResponse({ status: 403, description: 'A staff token. This is not a staff route.' })
  async get(@CurrentUser() user: CurrentUserPayload) {
    const scope = await this.scopes.resolve(user)
    return this.dashboard.build(scope)
  }

  @Get('documents')
  @ApiOperation({ summary: "Documents shared with the signed-in resident" })
  async listDocuments(@CurrentUser() user: CurrentUserPayload) {
    const scope = await this.scopes.resolve(user)
    return this.documents.list(scope)
  }

  /**
   * The resident's message history.
   *
   * `limit` and `cursor` are the first query parameters on a portal route. They
   * are allowed because they choose how much of the CALLER'S OWN list to
   * return, never whose list it is — and `forbidNonWhitelisted` means an
   * attempt to add `?residentId=…` beside them is a 400 rather than a silently
   * dropped field.
   */
  @Get('messages')
  @ApiOperation({ summary: 'Messages the project actually sent this resident' })
  async listMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PortalMessagesQueryDto,
  ) {
    const scope = await this.scopes.resolve(user)
    return this.messages.list(scope, { limit: query.limit, cursor: query.cursor })
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  @Get('profile')
  @ApiOperation({ summary: "The resident's own record" })
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    const scope = await this.scopes.resolve(user)
    return this.profile.get(scope)
  }

  /**
   * The five fields a resident may change about themselves.
   *
   * The DTO is an allow-list and `forbidNonWhitelisted` is on, so a body
   * carrying `phone`, `ownershipPercentage` or `notes` is a 400 rather than a
   * field that is silently dropped today and silently honoured after some
   * later refactor. That is the enforcement; the DTO comment is the reasoning.
   */
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update language, preferred channel and consent' })
  @ApiResponse({ status: 400, description: 'A field a resident may not set was present.' })
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdatePortalProfileDto,
    @Req() req: any,
  ) {
    const scope = await this.scopes.resolve(user)
    return this.profile.update(scope, dto, contextFrom(req))
  }

  /**
   * Ask staff to change contact details the resident may not change themselves.
   *
   * The phone number is the login credential; changing it without verifying the
   * new one turns a stolen session into permanent ownership of the account.
   * Until an OTP-verified change flow exists, a human reading the request and
   * satisfying themselves about who is asking IS the control.
   */
  @Post('profile/contact-update-request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ask staff to update phone or email' })
  @ApiResponse({ status: 400, description: 'A request is already open for this resident.' })
  async requestContactUpdate(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ContactUpdateRequestDto,
    @Req() req: any,
  ) {
    const scope = await this.scopes.resolve(user)
    return this.profile.requestContactUpdate(scope, dto, contextFrom(req))
  }

  // ── Support ───────────────────────────────────────────────────────────────

  /**
   * The resident's own tickets, and the questions this project's record can
   * answer.
   *
   * "Their own" is literal: a ticket belongs to one resident, not to an
   * apartment. Co-residents of a jointly-owned apartment are routinely heirs
   * contesting an estate or a couple separating, and there is no flag on
   * `SupportTicket` to opt into sharing one.
   */
  @Get('support')
  @ApiOperation({ summary: "The resident's support tickets" })
  async listTickets(@CurrentUser() user: CurrentUserPayload) {
    const scope = await this.scopes.resolve(user)
    return this.support.list(scope)
  }

  @Get('support/:id')
  @ApiOperation({ summary: 'One ticket and its conversation' })
  @ApiResponse({ status: 404, description: 'No such ticket, or not one of theirs.' })
  async getTicket(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const scope = await this.scopes.resolve(user)
    return this.support.get(scope, id)
  }

  @Post('support')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open a support ticket' })
  async createTicket(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSupportTicketDto,
    @Req() req: any,
  ) {
    const scope = await this.scopes.resolve(user)
    return this.support.create(scope, dto, contextFrom(req))
  }

  /**
   * Reply to one of their own tickets.
   *
   * `isInternal` is not on the DTO and is server-assigned `false`: it is the
   * flag that hides staff's private notes from the resident, and a resident who
   * could set it would be writing into a channel they cannot read.
   */
  @Post('support/:id/replies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reply to one of their tickets' })
  async replyToTicket(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateTicketReplyDto,
    @Req() req: any,
  ) {
    const scope = await this.scopes.resolve(user)
    return this.support.reply(scope, id, dto, contextFrom(req))
  }

  /**
   * The first portal route that names a resource.
   *
   * The id goes INTO a query already scoped to the session rather than being
   * checked against it afterwards, so a document belonging to someone else does
   * not match and the answer is 404. A 403 would confirm the id exists
   * somewhere, which is a fact a resident should not be able to establish by
   * trying ids.
   */
  @Get('documents/:id/download')
  @ApiOperation({ summary: 'A short-lived download URL for one of their documents' })
  @ApiResponse({ status: 404, description: 'No such document, or not one of theirs.' })
  async downloadDocument(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const scope = await this.scopes.resolve(user)
    return this.documents.downloadUrl(scope, id)
  }
}

/**
 * IP and user agent for a resident-initiated audit row.
 *
 * Deliberately NOT `actorFrom(req)`: on a portal token `req.user.userId` is the
 * RESIDENT id, `AuditLog.userId` is a `User` foreign key, and the insert would
 * fail silently. `actorFrom` throws on a resident session for that reason;
 * resident actions audit through `recordAnonymous`, which needs only this.
 */
function contextFrom(req: any): { ip?: string | null; userAgent?: string | null } {
  return {
    ip: req?.ip ?? req?.headers?.['x-forwarded-for'] ?? null,
    userAgent: req?.headers?.['user-agent'] ?? null,
  }
}
