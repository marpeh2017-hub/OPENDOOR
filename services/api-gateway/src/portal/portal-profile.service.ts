import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AuditService } from '../common/audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import type { PortalScope } from './portal-scope.service'
import type { ContactUpdateRequestDto, UpdatePortalProfileDto } from './dto/portal-profile.dto'

/**
 * The resident's own record, as they may see and change it.
 *
 * ── WHY AUDITING HERE IS NOT `actorFrom(req)` ───────────────────────────────
 *
 * `AuditLog.userId` is a foreign key to `User`, and a resident has no user row.
 * On a portal token `req.user.userId` is the RESIDENT id, so the ordinary
 * helper would build an actor whose insert fails — and `AuditService.record`
 * logs that failure rather than rethrowing, which means the action happens with
 * no audit row at all. `actorFrom` now refuses a resident session outright for
 * exactly that reason.
 *
 * `recordAnonymous` is the correct path: `userId: null`, the resident id in
 * metadata, and the IP and user agent that came with the request. "The resident
 * changed their own consent, from this address, at this time" is precisely the
 * record worth having when somebody later disputes whether they agreed to be
 * contacted.
 */

/** Contact details a resident may not change themselves — see the DTO. */
const CONTACT_UPDATE_CATEGORY = 'CONTACT_UPDATE'

interface RequestContext {
  ip?: string | null
  userAgent?: string | null
}

@Injectable()
export class PortalProfileService {
  private readonly logger = new Logger(PortalProfileService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Read ──────────────────────────────────────────────────────────────────

  async get(scope: PortalScope) {
    const resident = await this.prisma.resident.findFirstOrThrow({
      where: { id: scope.residentId },
      select: {
        id: true, firstName: true, lastName: true,
        phone: true, phone2: true, email: true,
        ownershipPercentage: true, isPrimaryContact: true,
        signatureStatus: true, isObjecting: true,
        language: true, preferredChannel: true,
        whatsappOptIn: true, smsOptIn: true, emailOptIn: true,
        doNotContact: true, portalEnabled: true,
        // `nationalId` and `notes` are deliberately not selected. The first is
        // PII that no API response carries; the second is staff's internal
        // commentary ABOUT this person, which they should not read about
        // themselves from their own profile page.
      },
    })

    const pending = await this.prisma.supportTicket.findFirst({
      where: {
        residentId: scope.residentId, tenantId: scope.tenantId,
        category: CONTACT_UPDATE_CATEGORY, status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      select: { id: true, createdAt: true, status: true },
      orderBy: { createdAt: 'desc' },
    })

    return {
      resident: {
        id: resident.id,
        name: `${resident.firstName} ${resident.lastName}`.trim(),
        firstName: resident.firstName,
        lastName: resident.lastName,
        phone: resident.phone,
        phone2: resident.phone2,
        email: resident.email,
      },
      home: {
        projectName: scope.projectName,
        buildingAddress: scope.buildingAddress,
        apartmentNumber: scope.apartmentNumber,
        /** Their own share. Material to them, and their own fact to know. */
        ownershipPercentage: resident.ownershipPercentage,
        isPrimaryContact: resident.isPrimaryContact,
      },
      standing: {
        signatureStatus: resident.signatureStatus,
        isObjecting: resident.isObjecting,
      },
      preferences: {
        language: resident.language,
        preferredChannel: resident.preferredChannel,
        whatsappOptIn: resident.whatsappOptIn,
        smsOptIn: resident.smsOptIn,
        emailOptIn: resident.emailOptIn,
        // Shown but not editable: a resident who asked not to be contacted
        // should be able to SEE that it is recorded, and ask for it to be
        // lifted, rather than wondering why the project has gone quiet.
        doNotContact: resident.doNotContact,
        portalInboxEnabled: resident.portalEnabled,
      },
      /** So the page can say "we already have your request" instead of a second one. */
      pendingContactRequest: pending,
    }
  }

  // ── The five editable fields ──────────────────────────────────────────────

  async update(scope: PortalScope, dto: UpdatePortalProfileDto, ctx: RequestContext) {
    const before = await this.prisma.resident.findFirstOrThrow({
      where: { id: scope.residentId },
      select: {
        language: true, preferredChannel: true,
        whatsappOptIn: true, smsOptIn: true, emailOptIn: true,
      },
    })

    // Only what genuinely differs. An audit trail full of "changed X to X" is
    // an audit trail nobody reads.
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    const data: Record<string, unknown> = {}
    for (const [key, next] of Object.entries(dto)) {
      if (next === undefined) continue
      const current = (before as Record<string, unknown>)[key]
      if (current === next) continue
      data[key] = next
      changes[key] = { from: current, to: next }
    }

    if (Object.keys(data).length === 0) {
      return { changed: false, changedFields: [] as string[] }
    }

    await this.prisma.resident.update({ where: { id: scope.residentId }, data })

    await this.audit.recordAnonymous(scope.tenantId, ctx, {
      action: 'UPDATE',
      entity: 'Resident',
      entityId: scope.residentId,
      changes: {
        before: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
        after: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
      },
      metadata: {
        // `userId` is null on this row by necessity, so the actor has to be
        // legible from the metadata or the entry says "somebody" did it.
        actor: 'RESIDENT',
        residentId: scope.residentId,
        projectId: scope.projectId,
        selfService: true,
      },
    })

    this.logger.log(
      `Resident ${scope.residentId} updated their own ${Object.keys(changes).join(', ')}`,
    )
    return { changed: true, changedFields: Object.keys(changes) }
  }

  // ── Asking a human to change the rest ─────────────────────────────────────

  /**
   * Files a request for staff to update contact details.
   *
   * Two records, deliberately:
   *
   *   - a `SupportTicket`, which is the durable, assignable, resolvable home
   *     for it and the table the support inbox will read;
   *   - a `Notification` to the project manager, because the support inbox does
   *     not exist yet and a request nobody can see is not a request.
   *
   * The second is not a workaround to delete later. A ticket filed today should
   * reach a person today, and a notification is how every other module already
   * tells staff something happened.
   */
  async requestContactUpdate(scope: PortalScope, dto: ContactUpdateRequestDto, ctx: RequestContext) {
    const existing = await this.prisma.supportTicket.findFirst({
      where: {
        residentId: scope.residentId, tenantId: scope.tenantId,
        category: CONTACT_UPDATE_CATEGORY, status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      select: { id: true, createdAt: true },
    })
    if (existing) {
      // Not an error the resident caused, and not a reason to open a second
      // one: they pressed the button twice, or staff has not got to it yet.
      throw new BadRequestException({
        code: 'CONTACT_REQUEST_ALREADY_OPEN',
        message: 'כבר קיימת בקשה פתוחה לעדכון פרטים. ניצור איתך קשר בהקדם.',
        ticketId: existing.id,
      })
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        tenantId: scope.tenantId,
        residentId: scope.residentId,
        category: CONTACT_UPDATE_CATEGORY,
        subject: `בקשת עדכון פרטי התקשרות — ${scope.residentName}`,
        description:
          `דירה ${scope.apartmentNumber}, ${scope.buildingAddress}\n` +
          `${scope.projectName}\n\n` +
          `${dto.message}`,
        status: 'OPEN',
        priority: 'MEDIUM',
      },
      select: { id: true, createdAt: true, status: true },
    })

    await this.audit.recordAnonymous(scope.tenantId, ctx, {
      action: 'CREATE',
      entity: 'SupportTicket',
      entityId: ticket.id,
      metadata: {
        actor: 'RESIDENT',
        residentId: scope.residentId,
        category: CONTACT_UPDATE_CATEGORY,
      },
    })

    await this.notifyProjectTeam(scope, ticket.id)

    return ticket
  }

  /**
   * Tells the project manager, if the project names one who is still here.
   *
   * Best-effort by design: a request that was filed must not be lost because
   * nobody is assigned to the project, so a failure to notify is logged and the
   * ticket stands on its own.
   */
  private async notifyProjectTeam(scope: PortalScope, ticketId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: scope.projectId, tenantId: scope.tenantId },
      select: { projectManagerId: true, name: true },
    })
    if (!project?.projectManagerId) {
      this.logger.warn(
        `Contact-update ticket ${ticketId} has no project manager to notify on project ${scope.projectId}`,
      )
      return
    }

    await this.notifications.emit({
      tenantId: scope.tenantId,
      userId: project.projectManagerId,
      type: 'SYSTEM',
      title: 'בקשת עדכון פרטי התקשרות',
      body: `${scope.residentName} (דירה ${scope.apartmentNumber}, ${project.name}) ביקש/ה לעדכן פרטי התקשרות.`,
      entityType: 'SupportTicket',
      entityId: ticketId,
      metadata: { residentId: scope.residentId, category: CONTACT_UPDATE_CATEGORY },
    })
  }
}
