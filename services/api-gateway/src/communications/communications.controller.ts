import {
  Controller, Get, Post,
  Param, Body, Request, Query, UnauthorizedException, NotFoundException,
  BadRequestException, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { MessageChannel } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../prisma.service'
import { STAFF_ROLES } from '../auth/roles.constants'
import { SendCommunicationDto } from './dto/send-communication.dto'
import { OutboundMessageService } from '../messaging/outbound-message.service'
import { ResidentContactService, isRoutable } from '../messaging/resident-contact.service'
import { mapDomainErrors } from '../common/errors/domain-error'

const COMMS_SEND_ROLES = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER','RESIDENT_RELATIONS_MANAGER','FIELD_AGENT'] as const

@ApiTags('communications')
@ApiBearerAuth()
@Controller({ path: 'communications', version: '1' })
export class CommunicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundMessageService,
    private readonly contacts: ResidentContactService,
  ) {}

  private tenantId(req: any): string {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return req.user.tenantId
  }

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List communications' })
  // NOTE: there is no `projectId` filter — the Message model has no projectId
  // column. The parameter used to be accepted and silently ignored, which made
  // callers believe they were filtering when they were not.
  @ApiQuery({ name: 'residentId', required: false })
  @ApiQuery({ name: 'channel', required: false })
  findAll(
    @Request() req: any,
    @Query('residentId') residentId?: string,
    @Query('channel') channel?: string,
  ) {
    const tenantId = this.tenantId(req)
    return this.prisma.message.findMany({
      where: {
        tenantId,
        ...(residentId ? { residentId } : {}),
        ...(channel ? { channel: channel as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get a communication record' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const comm = await this.prisma.message.findFirst({ where: { id, tenantId } })
    if (!comm) throw new NotFoundException('Communication not found')
    return comm
  }

  /**
   * Queues an outbound message for real delivery.
   *
   * WHAT CHANGED (Phase 1). This used to write a row with `status: QUEUED` that
   * nothing ever consumed — the endpoint reported success for a message that
   * was never going anywhere. It now enqueues through `OutboundMessageService`,
   * and the dispatcher claims the row, calls a provider, and moves it to SENT
   * only if that call actually succeeded.
   *
   * IN DEVELOPMENT NOTHING IS TRANSMITTED. The dev/no-op provider records what
   * would have been sent and the row is stamped `isSimulated: true`, which the
   * CRM renders as an explicit badge. A simulated send is never mistakable for
   * a real one.
   *
   * The DTO remains an explicit allow-list — it replaced a `{ ...body }` spread
   * that let a client forge `status`, `direction`, `sentAt`, `externalId`,
   * `campaignId` and `metadata`. Every dispatch column added since
   * (`attemptCount`, `providerName`, `isSimulated`, `idempotencyKey`) is
   * likewise server-assigned and rejected on input by `forbidNonWhitelisted`.
   *
   * ADDRESS RESOLUTION. When only a `residentId` is given, the recipient
   * address and channel come from `ResidentContactService`, which honours the
   * resident's `doNotContact` flag and per-channel opt-ins. A staff member
   * cannot bypass an opt-out by picking the channel by hand: an explicit
   * `toPhone`/`toEmail` for a resident who has opted out of contact entirely is
   * still refused.
   */
  @Post()
  @Roles(...COMMS_SEND_ROLES)
  @ApiOperation({ summary: 'Queue an outbound communication (WhatsApp/SMS/Email)' })
  async send(@Body() dto: SendCommunicationDto, @Request() req: any) {
    const tenantId = this.tenantId(req)

    let channel: MessageChannel = dto.channel as MessageChannel
    let toPhone = dto.toPhone ?? null
    let toEmail = dto.toEmail ?? null

    // Two-step tenant scoping — a resident from another tenant is a 404, not a
    // cross-tenant write.
    if (dto.residentId) {
      const resident = await this.prisma.resident.findFirst({
        where: { id: dto.residentId, tenantId },
        select: { id: true },
      })
      if (!resident) throw new NotFoundException('Resident not found')

      const route = await this.contacts.route(tenantId, dto.residentId)
      if (!isRoutable(route)) {
        // 400 with the machine reason: this is a fixable data/consent problem
        // the staff member needs to see, not a server error and not a silent
        // no-op that looks like a successful send.
        throw new BadRequestException({
          message: 'לא ניתן ליצור קשר עם הדייר בערוץ כלשהו',
          code: `RESIDENT_${route.reason}`,
          detail: route.detail,
        })
      }
      // An explicitly requested channel is honoured ONLY if the resident
      // consented to it; otherwise their routed channel wins.
      const requestedIsConsented = route.channel === channel
      if (!requestedIsConsented) channel = route.channel
      toPhone = toPhone ?? route.toPhone
      toEmail = toEmail ?? route.toEmail
      if (channel === 'EMAIL') toPhone = null
      else toEmail = null
    }

    if (!dto.residentId && !toPhone && !toEmail) {
      throw new BadRequestException('A recipient is required: residentId, toPhone or toEmail')
    }
    if (channel === 'EMAIL' && !toEmail) {
      throw new BadRequestException('EMAIL requires toEmail or a residentId')
    }
    if (channel !== 'EMAIL' && channel !== 'PORTAL' && !toPhone) {
      throw new BadRequestException(`${channel} requires toPhone or a residentId`)
    }

    const queued = await mapDomainErrors(() => this.outbound.enqueue({
      tenantId,
      channel,
      body:    dto.body,
      subject: dto.subject ?? null,
      residentId: dto.residentId ?? null,
      toPhone,
      toEmail,
      metadata: { origin: 'crm-compose', composedBy: req.user.userId },
    }))

    // Return the full row so the caller sees the dispatch state it will be
    // polling, not a bare id.
    return this.prisma.message.findUniqueOrThrow({ where: { id: queued.id } })
  }

  /**
   * Withdraws a message that has not been claimed by a worker yet.
   *
   * 409 once it has left QUEUED — at that point a provider call may already be
   * in flight, and answering "cancelled" would be a lie.
   */
  @Post(':id/cancel')
  @Roles(...COMMS_SEND_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a message that has not been sent yet' })
  cancel(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    return mapDomainErrors(() => this.outbound.cancel(tenantId, id, 'cancelled by staff'))
  }
}
