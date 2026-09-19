import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AuditService } from '../common/audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import type { PortalScope } from './portal-scope.service'
import type { CreateSupportTicketDto, CreateTicketReplyDto } from './dto/portal-support.dto'

/**
 * The resident's own support conversations.
 *
 * ── WHY A TICKET IS PERSONAL AND NOT A HOUSEHOLD MATTER ─────────────────────
 *
 * An apartment can hold several residents — `Apartment.residents` is a list,
 * `ownershipPercentage` exists because apartments are jointly owned, and
 * `isPrimaryContact` exists to pick one among several. So "should co-residents
 * see each other's tickets" is a real question, and the answer here is no.
 *
 * The reason is in the ownership model itself: it carries `viaInheritance` and
 * `poaHolderId` because apartments inherited by several heirs are ordinary in
 * pinuy-binuy, and heirs contest estates. Divorcing couples co-own. Siblings
 * disagree about signing — `isObjecting` is per-resident precisely because the
 * schema expects two people in one apartment to hold opposite positions.
 *
 * Showing one of them the other's ticket could disclose an heir's private
 * correspondence with the promoter to the sibling contesting the estate. There
 * is no "household" flag on `SupportTicket` to opt into sharing, so the private
 * reading is the only defensible default — and it is also the only one the
 * schema actually expresses, since `residentId` is the sole link.
 *
 * ── AND WHY `isInternal` IS THE OTHER HALF OF THAT ──────────────────────────
 *
 * `TicketReply.isInternal` separates staff's private notes from the reply the
 * resident is meant to read. Every read below filters it out. Forgetting once
 * would put the project team's internal assessment of a resident in front of
 * that resident.
 *
 * NOTE — a limit this cannot fix: the ticket's own `subject` and `description`
 * carry no such flag, so a ticket staff opens ABOUT a resident is visible to
 * them in full. That is a CRM interface concern, recorded in
 * docs/PORTAL_SUPPORT_VISIBILITY.md.
 */

/** Statuses that still count as "being handled" for the open-ticket cap. */
const LIVE_STATUSES = ['OPEN', 'IN_PROGRESS'] as const

/**
 * How many tickets one resident may have open at once.
 *
 * Not a rate limit — a person with five unanswered questions has a problem the
 * project should be solving rather than throttling. It exists so a script (or a
 * stuck button) cannot fill the support queue.
 */
const MAX_OPEN_TICKETS = 5

@Injectable()
export class PortalSupportService {
  private readonly logger = new Logger(PortalSupportService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── The list ──────────────────────────────────────────────────────────────

  async list(scope: PortalScope) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { residentId: scope.residentId, tenantId: scope.tenantId },
      select: {
        id: true, subject: true, status: true, priority: true, category: true,
        createdAt: true, updatedAt: true, resolvedAt: true, closedAt: true,
        _count: { select: { replies: { where: { isInternal: false } } } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return {
      tickets: tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        category: t.category,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        // Internal notes are not "replies" from where the resident is sitting,
        // so a ticket with three staff notes and no answer must not look
        // answered.
        replyCount: t._count.replies,
      })),
      faq: await this.faq(scope),
    }
  }

  // ── One conversation ──────────────────────────────────────────────────────

  async get(scope: PortalScope, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      // The id goes INSIDE a query already scoped to this resident, so another
      // resident's ticket does not match and the answer is 404 rather than a
      // permission decision that confirms the id exists.
      where: { id: ticketId, residentId: scope.residentId, tenantId: scope.tenantId },
      select: {
        id: true, subject: true, description: true, status: true,
        priority: true, category: true,
        createdAt: true, updatedAt: true, resolvedAt: true, closedAt: true,
        replies: {
          where: { isInternal: false },
          select: {
            id: true, body: true, createdAt: true,
            authorId: true, authorResidentId: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!ticket) {
      this.logger.warn(
        `Resident ${scope.residentId} asked for ticket ${ticketId}, which is not theirs — 404.`,
      )
      throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'הפנייה לא נמצאה' })
    }

    // Staff authors are resolved to a name, and only a name. Which staff member
    // answered is useful; their email, role and id are not the resident's to
    // have, and a raw `authorId` in the response is an id to go probing with.
    const staffIds = [...new Set(ticket.replies.map((r) => r.authorId).filter(Boolean))] as string[]
    const staff = staffIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: staffIds }, tenantId: scope.tenantId },
          select: { id: true, firstName: true, lastName: true },
        })
      : []
    const staffNames = new Map(staff.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]))

    return {
      id: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      category: ticket.category,
      createdAt: ticket.createdAt,
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      canReply: ticket.status !== 'CLOSED',
      replies: ticket.replies.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.createdAt,
        fromResident: r.authorResidentId === scope.residentId,
        authorName: r.authorResidentId
          ? scope.residentName
          : (r.authorId && staffNames.get(r.authorId)) || scope.projectName,
      })),
    }
  }

  // ── Opening one ───────────────────────────────────────────────────────────

  async create(
    scope: PortalScope,
    dto: CreateSupportTicketDto,
    ctx: { ip?: string | null; userAgent?: string | null },
  ) {
    const open = await this.prisma.supportTicket.count({
      where: {
        residentId: scope.residentId, tenantId: scope.tenantId,
        status: { in: [...LIVE_STATUSES] },
      },
    })
    if (open >= MAX_OPEN_TICKETS) {
      throw new BadRequestException({
        code: 'TOO_MANY_OPEN_TICKETS',
        message: 'יש לך כבר מספר פניות פתוחות. נטפל בהן בהקדם ואז נוכל לקבל פנייה נוספת.',
      })
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        tenantId: scope.tenantId,
        residentId: scope.residentId,
        subject: dto.subject,
        description: dto.description,
        category: dto.category ?? 'GENERAL',
        status: 'OPEN',
        priority: 'MEDIUM',
      },
      select: { id: true, subject: true, status: true, category: true, createdAt: true },
    })

    await this.audit.recordAnonymous(scope.tenantId, ctx, {
      action: 'CREATE', entity: 'SupportTicket', entityId: ticket.id,
      metadata: {
        actor: 'RESIDENT', residentId: scope.residentId,
        projectId: scope.projectId, category: ticket.category,
      },
    })

    await this.notifyProjectTeam(scope, ticket.id, 'פנייה חדשה מדייר', ticket.subject)
    return ticket
  }

  // ── Replying to one ───────────────────────────────────────────────────────

  async reply(
    scope: PortalScope,
    ticketId: string,
    dto: CreateTicketReplyDto,
    ctx: { ip?: string | null; userAgent?: string | null },
  ) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, residentId: scope.residentId, tenantId: scope.tenantId },
      select: { id: true, status: true, subject: true },
    })
    if (!ticket) {
      throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'הפנייה לא נמצאה' })
    }
    if (ticket.status === 'CLOSED') {
      // Terminal on purpose. A closed case that can be reopened months later by
      // a stray message is a case nobody can say is finished.
      throw new BadRequestException({
        code: 'TICKET_CLOSED',
        message: 'הפנייה נסגרה. ניתן לפתוח פנייה חדשה.',
      })
    }

    const reply = await this.prisma.ticketReply.create({
      data: {
        ticketId: ticket.id,
        authorResidentId: scope.residentId,
        body: dto.body,
        // Server-assigned, and not reachable from the DTO. A resident writing
        // into the internal channel would be writing somewhere they cannot read
        // and staff does not expect them.
        isInternal: false,
      },
      select: { id: true, body: true, createdAt: true },
    })

    /*
     * A resident answering a RESOLVED ticket reopens it. "That did not fix it"
     * is the most important thing a support system can hear, and leaving it
     * resolved would file the answer under a case nobody is looking at.
     */
    const reopened = ticket.status === 'RESOLVED'
    await this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: reopened
        ? { status: 'OPEN', resolvedAt: null, updatedAt: new Date() }
        : { updatedAt: new Date() },
    })

    await this.audit.recordAnonymous(scope.tenantId, ctx, {
      action: 'CREATE', entity: 'TicketReply', entityId: reply.id,
      metadata: {
        actor: 'RESIDENT', residentId: scope.residentId,
        ticketId: ticket.id, reopened,
      },
    })

    await this.notifyProjectTeam(
      scope, ticket.id,
      reopened ? 'דייר פתח מחדש פנייה' : 'תגובה חדשה מדייר',
      ticket.subject,
    )

    return { ...reply, reopened }
  }

  // ── Questions the database can actually answer ────────────────────────────

  /**
   * The FAQ, from this project's own record.
   *
   * ── WHAT THIS REPLACES, AND WHY IT MATTERED ─────────────────────────────
   *
   * The page shipped five hard-coded answers containing legal and contractual
   * assertions: that the court threshold is 80%, that delivery is end-2027,
   * that the new apartment is at least 25% larger, and that the developer bears
   * every evacuation cost. A resident can rely on those, and "the promoter's
   * own portal told me 80%" is a real problem in a dispute — especially when
   * `Project.signatureGoal` defaults to 67 and is per-project, so the page
   * contradicted the system's own data.
   *
   * What remains is only what this project's record can answer, read from it,
   * per resident. An entry whose data is missing is OMITTED rather than
   * answered with a guess: silence is recoverable, a wrong number in front of a
   * resident is not.
   *
   * The contractual questions are gone entirely. They vary per project and per
   * agreement, and there is no CMS model for portal content to hold a correct
   * per-project answer — recorded as a product gap in
   * docs/PORTAL_SUPPORT_VISIBILITY.md.
   */
  private async faq(scope: PortalScope) {
    const project = await this.prisma.project.findFirstOrThrow({
      where: { id: scope.projectId, tenantId: scope.tenantId },
      select: {
        signatureGoal: true,
        signedUnits: true, totalUnits: true,
        targetEndDate: true, stage: true,
        // `signatureActual` is deliberately NOT read. It is a denormalised
        // percentage that nothing in the codebase or the seed ever writes, so
        // it sits at its default of 0 — and reading it produced
        // "34 of 48 units (0%)" on a real project, which is both wrong and
        // visibly nonsense to the resident looking at it. The percentage is
        // derived from the two counts below, which cannot disagree with
        // themselves.
      },
    })

    const entries: { question: string; answer: string; source: string }[] = []

    if (project.totalUnits > 0) {
      entries.push({
        question: 'כמה דיירים כבר חתמו בפרויקט?',
        answer:
          `${project.signedUnits} מתוך ${project.totalUnits} יחידות ` +
          `(${Math.round((project.signedUnits / project.totalUnits) * 100)}%).`,
        source: 'PROJECT_SIGNATURES',
      })
    }

    entries.push({
      question: 'מה שיעור החתימות הנדרש בפרויקט הזה?',
      answer:
        `היעד שנקבע לפרויקט הוא ${project.signatureGoal}%. ` +
        'השיעור הנדרש על פי חוק נקבע לגופו של מקרה — לשאלות משפטיות פנו אלינו.',
      source: 'PROJECT_SIGNATURE_GOAL',
    })

    if (project.targetEndDate) {
      entries.push({
        question: 'מתי צפויה מסירת הדירות?',
        answer:
          `המועד הרשום בתכנון הפרויקט הוא ${new Intl.DateTimeFormat('he-IL', {
            month: 'long', year: 'numeric',
          }).format(project.targetEndDate)}. נעדכן בכל שינוי.`,
        source: 'PROJECT_TARGET_END_DATE',
      })
    }

    return entries
  }

  // ── Telling somebody ──────────────────────────────────────────────────────

  /** Best-effort: a ticket that was filed must not be lost because nobody is assigned. */
  private async notifyProjectTeam(
    scope: PortalScope,
    ticketId: string,
    title: string,
    subject: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: scope.projectId, tenantId: scope.tenantId },
      select: { projectManagerId: true, name: true },
    })
    if (!project?.projectManagerId) {
      this.logger.warn(`Ticket ${ticketId} has no project manager to notify on ${scope.projectId}`)
      return
    }

    await this.notifications.emit({
      tenantId: scope.tenantId,
      userId: project.projectManagerId,
      type: 'SYSTEM',
      title,
      body: `${scope.residentName} (דירה ${scope.apartmentNumber}, ${project.name}): ${subject}`,
      entityType: 'SupportTicket',
      entityId: ticketId,
      metadata: { residentId: scope.residentId },
    })
  }
}
