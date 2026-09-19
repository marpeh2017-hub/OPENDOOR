import { Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { AutomationRunnerService } from '../automations/automation-runner.service'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { DomainError } from '../common/errors/domain-error'
import { NotificationsService } from '../notifications/notifications.service'
import { MeetingResidentNotifierService } from './meeting-resident-notifier.service'
import { MeetingAccessService } from './meeting-access.service'
import {
  MEETING_STATUSES, RSVP_STATUSES, type MeetingStatus, type RsvpStatus,
} from './meeting-constants'
import type {
  CreateMeetingDto, UpdateMeetingDto, ListMeetingsQueryDto,
  MeetingAttendeeInputDto, CancelMeetingDto, CompleteMeetingDto,
  RsvpDto, SetAttendanceDto,
} from './dto/meeting.dto'

const ATTENDEE_SELECT = {
  id: true, userId: true, residentId: true, role: true,
  rsvpStatus: true, respondedAt: true, invitedAt: true, attended: true,
  user:     { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
  resident: { select: { id: true, firstName: true, lastName: true, phone: true } },
} as const

const MEETING_SELECT = {
  id: true, tenantId: true, projectId: true, createdById: true,
  title: true, description: true, location: true, isVirtual: true, meetingUrl: true,
  startTime: true, endTime: true, notes: true, status: true,
  cancelledAt: true, cancelReason: true,
  aiSummary: true, aiSummaryGeneratedAt: true,
  createdAt: true, updatedAt: true,
  project:   { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const

const MEETING_DETAIL_SELECT = {
  ...MEETING_SELECT,
  attendees: { select: ATTENDEE_SELECT, orderBy: { invitedAt: 'asc' } },
} as const

/** Hebrew date/time for notification bodies. */
function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem',
  }).format(date)
}

/**
 * Meetings — scheduling, invitations, RSVP and attendance.
 *
 * TENANT BOUNDARY. `Meeting.tenantId` is on the row, so meetings scope
 * directly rather than through the Complex→Building→Apartment traversal that
 * Building and Apartment need. But the things a meeting POINTS AT do need
 * traversal, and that is where cross-tenant leakage would actually happen:
 *
 *   - `projectId` is checked against `project.tenantId`;
 *   - an invited `userId` is checked against `user.tenantId`;
 *   - an invited `residentId` is checked through
 *     `apartment → building → complex → project → tenantId`, because Resident's
 *     own `tenantId` column is documented in the schema as app-layer-enforced
 *     and is therefore not the authority.
 *
 * Every one of those answers 404 on failure, never 403 — a caller must not be
 * able to learn that an id exists in a tenant they cannot see.
 *
 * TWO DELIVERY PATHS, ONE PER KIND OF PERSON. Staff attendees are `User` rows
 * and get in-app notifications through `NotificationsService`. Resident
 * attendees are NOT users — `Notification.userId` is an FK to `User` — and are
 * reached instead through `MeetingResidentNotifierService`, which queues a real
 * message (SMS / WhatsApp / email / portal inbox) via the communications
 * dispatcher, honouring the resident's own consent flags. Neither path can
 * throw into a scheduling transaction: a delivery problem degrades the
 * invitation, it does not fail the meeting.
 */
@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly residentNotifier: MeetingResidentNotifierService,
    private readonly access: MeetingAccessService,
    private readonly automations: AutomationRunnerService,
  ) {}

  // ── Validation helpers ───────────────────────────────────────────────────

  /** Throws unless the project exists IN THIS TENANT. */
  private async assertProjectInTenant(tenantId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    })
    if (!project) {
      throw DomainError.notFound('MEETING_PROJECT_NOT_FOUND', 'הפרויקט לא נמצא')
    }
  }

  /**
   * Validates one attendee input and returns the row data.
   *
   * The "exactly one of" rule is enforced here rather than in the DTO because
   * class-validator cannot express it cleanly, and because the database cannot
   * express it either — both columns are nullable, so a row naming neither
   * would be accepted by Postgres and would then render as a blank attendee
   * that nobody can remove by name.
   */
  private async resolveAttendee(
    tenantId: string,
    input: MeetingAttendeeInputDto,
  ): Promise<{ userId: string | null; residentId: string | null; role: string | null }> {
    const hasUser = Boolean(input.userId)
    const hasResident = Boolean(input.residentId)

    if (hasUser === hasResident) {
      throw DomainError.validation(
        'MEETING_ATTENDEE_AMBIGUOUS',
        'יש לציין משתמש או דייר עבור כל משתתף — בדיוק אחד מהם',
      )
    }

    if (hasUser) {
      const user = await this.prisma.user.findFirst({
        where: { id: input.userId!, tenantId },
        select: { id: true },
      })
      if (!user) throw DomainError.notFound('MEETING_ATTENDEE_USER_NOT_FOUND', 'המשתמש לא נמצא')
      return { userId: user.id, residentId: null, role: input.role ?? 'attendee' }
    }

    // Resident: traverse to the project, which is where the tenant boundary
    // actually lives. Resident.tenantId is not trusted for this.
    const resident = await this.prisma.resident.findFirst({
      where: {
        id: input.residentId!,
        apartment: { building: { complex: { project: { tenantId } } } },
      },
      select: { id: true },
    })
    if (!resident) {
      throw DomainError.notFound('MEETING_ATTENDEE_RESIDENT_NOT_FOUND', 'הדייר לא נמצא')
    }
    return { userId: null, residentId: resident.id, role: input.role ?? 'attendee' }
  }

  private assertTimeOrder(startTime: Date, endTime: Date | null): void {
    if (endTime && endTime.getTime() <= startTime.getTime()) {
      throw DomainError.validation(
        'MEETING_TIME_ORDER',
        'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
      )
    }
  }

  /** Loads a meeting inside the tenant, or 404s. */
  private async loadScoped(tenantId: string, id: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, tenantId },
      select: MEETING_DETAIL_SELECT,
    })
    if (!meeting) throw DomainError.notFound('MEETING_NOT_FOUND', 'הפגישה לא נמצאה')
    return meeting
  }

  // ── Notification fan-out ─────────────────────────────────────────────────

  /**
   * Notifies the STAFF attendees of a meeting, in-app.
   *
   * Residents are handled separately by `notifyResidentAttendees` — not because
   * they are second-class, but because they are not `User` rows and reaching
   * them is a different mechanism with different consent rules. Both are called
   * from every mutation that changes what an attendee needs to know.
   *
   * Never throws — `NotificationsService.emit` swallows its own failures — so a
   * notification problem cannot roll back a successful scheduling operation.
   */
  private async notifyStaffAttendees(
    tenantId: string,
    meetingId: string,
    attendees: { userId: string | null }[],
    payload: { title: string; body: string },
    excludeUserId?: string,
  ): Promise<number> {
    const userIds = attendees
      .map((a) => a.userId)
      .filter((id): id is string => Boolean(id) && id !== excludeUserId)

    if (userIds.length === 0) return 0

    return this.notifications.emitMany(userIds, {
      tenantId,
      type: 'MEETING',
      title: payload.title,
      body: payload.body,
      link: `/meetings/${meetingId}`,
      entityType: 'Meeting',
      entityId: meetingId,
    })
  }

  /**
   * Notifies the RESIDENT attendees, through the communications dispatcher.
   *
   * `dedupeSuffix` is what makes a repeated call safe: it becomes part of the
   * message's idempotency key, so a retried HTTP request produces one message,
   * while a genuinely new event (the meeting moved again) produces a new one.
   * Callers pass something that changes exactly when the resident needs telling
   * again — `updatedAt` for an edit, the meeting id for a one-off.
   *
   * Never throws; the notifier swallows and reports its own failures.
   */
  private async notifyResidentAttendees(
    tenantId: string,
    meetingId: string,
    event: 'invitation' | 'updated' | 'cancelled',
    dedupeSuffix: string,
    residentAttendeeIds?: readonly string[],
  ): Promise<void> {
    const result = await this.residentNotifier.notifyResidents(
      tenantId, meetingId, event, dedupeSuffix,
      residentAttendeeIds ? { residentAttendeeIds } : undefined,
    )
    if (result.skipped.length > 0) {
      // Logged, not thrown. The organiser also sees this in the CRM via the
      // per-resident message log, which is the durable version of this line.
      this.logger.warn(
        `Meeting ${meetingId} ${event}: ${result.queued} resident message(s) queued, ` +
        `${result.skipped.length} unreachable ` +
        `(${result.skipped.map((s) => s.reason).join(', ')})`,
      )
    }
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  async findAll(actor: { userId: string; tenantId: string }, query: ListMeetingsQueryDto = {}) {
    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    const where: Prisma.MeetingWhereInput = {
      tenantId: actor.tenantId,
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            startTime: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
      // "Mine" means invited, not created — the calendar a user cares about is
      // the one they are expected to attend.
      ...(query.mineOnly ? { attendees: { some: { userId: actor.userId } } } : {}),
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.meeting.findMany({
        where,
        select: {
          ...MEETING_SELECT,
          attendees: { select: ATTENDEE_SELECT, orderBy: { invitedAt: 'asc' } },
          _count: { select: { attendees: true } },
        },
        orderBy: { startTime: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.meeting.count({ where }),
    ])

    return { items, total, limit, offset }
  }

  async findOne(tenantId: string, id: string) {
    return this.loadScoped(tenantId, id)
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  async create(actor: AuditActor, dto: CreateMeetingDto) {
    const startTime = new Date(dto.startTime)
    const endTime = dto.endTime ? new Date(dto.endTime) : null
    this.assertTimeOrder(startTime, endTime)

    if (dto.projectId) await this.assertProjectInTenant(actor.tenantId, dto.projectId)

    /*
     * Attendees are resolved BEFORE the meeting is created, so an invalid or
     * cross-tenant invitee fails the whole request rather than leaving a
     * half-invited meeting behind. Duplicates in the payload are collapsed here
     * too — the unique constraint would otherwise turn "invited Dana twice" into
     * a 500 rather than a sensible meeting.
     */
    const resolved = await Promise.all(
      (dto.attendees ?? []).map((a) => this.resolveAttendee(actor.tenantId, a)),
    )
    const deduped = [...new Map(
      resolved.map((a) => [`${a.userId ?? ''}|${a.residentId ?? ''}`, a]),
    ).values()]

    const meeting = await this.prisma.meeting.create({
      data: {
        tenantId:    actor.tenantId,
        createdById: actor.userId,
        projectId:   dto.projectId ?? null,
        title:       dto.title,
        description: dto.description ?? null,
        location:    dto.location ?? null,
        isVirtual:   dto.isVirtual ?? false,
        meetingUrl:  dto.meetingUrl ?? null,
        startTime,
        endTime,
        notes:       dto.notes ?? null,
        status:      'scheduled' satisfies MeetingStatus,
        attendees: deduped.length
          ? { create: deduped.map((a) => ({ ...a, rsvpStatus: 'pending' satisfies RsvpStatus })) }
          : undefined,
      },
      select: MEETING_DETAIL_SELECT,
    })

    await this.audit.record(actor, {
      action: 'CREATE',
      entity: 'Meeting',
      entityId: meeting.id,
      metadata: {
        projectId: meeting.projectId,
        startTime: meeting.startTime.toISOString(),
        attendeeCount: deduped.length,
      },
    })

    // The organiser is excluded: they just scheduled it, telling them about it
    // is noise.
    await this.notifyStaffAttendees(
      actor.tenantId, meeting.id, deduped,
      {
        title: 'הוזמנתם לפגישה',
        body: `${meeting.title} — ${formatWhen(meeting.startTime)}`,
      },
      actor.userId,
    )

    // Residents get a real message with a tokenised invitation link. Suffixed
    // by the meeting id: an invitation is sent exactly once per attendee per
    // meeting, and a retried create cannot double it.
    await this.notifyResidentAttendees(
      actor.tenantId, meeting.id, 'invitation', meeting.id,
    )

    return meeting
  }

  async update(actor: AuditActor, id: string, dto: UpdateMeetingDto) {
    const before = await this.loadScoped(actor.tenantId, id)

    if (before.status === 'cancelled') {
      throw DomainError.conflict(
        'MEETING_CANCELLED',
        'לא ניתן לערוך פגישה שבוטלה',
      )
    }

    const startTime = dto.startTime ? new Date(dto.startTime) : before.startTime
    const endTime = dto.endTime !== undefined
      ? (dto.endTime ? new Date(dto.endTime) : null)
      : before.endTime
    this.assertTimeOrder(startTime, endTime)

    if (dto.projectId) await this.assertProjectInTenant(actor.tenantId, dto.projectId)

    const updated = await this.prisma.meeting.update({
      where: { id: before.id },
      data: {
        ...(dto.title !== undefined       ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.location !== undefined    ? { location: dto.location } : {}),
        ...(dto.isVirtual !== undefined   ? { isVirtual: dto.isVirtual } : {}),
        ...(dto.meetingUrl !== undefined  ? { meetingUrl: dto.meetingUrl } : {}),
        ...(dto.startTime !== undefined   ? { startTime } : {}),
        ...(dto.endTime !== undefined     ? { endTime } : {}),
        ...(dto.projectId !== undefined   ? { projectId: dto.projectId } : {}),
        ...(dto.notes !== undefined       ? { notes: dto.notes } : {}),
      },
      select: MEETING_DETAIL_SELECT,
    })

    await this.audit.record(actor, {
      action: 'UPDATE',
      entity: 'Meeting',
      entityId: updated.id,
      changes: {
        before: { startTime: before.startTime, location: before.location, title: before.title },
        after:  { startTime: updated.startTime, location: updated.location, title: updated.title },
      },
    })

    /*
     * Attendees are re-notified only when the meeting MOVED. An edit to the
     * description or notes is not something anyone needs a notification for,
     * and a module that notifies on every save trains people to ignore it.
     */
    const moved =
      before.startTime.getTime() !== updated.startTime.getTime() ||
      (before.location ?? '') !== (updated.location ?? '')

    if (moved) {
      await this.notifyStaffAttendees(
        actor.tenantId, updated.id, updated.attendees,
        {
          title: 'פרטי הפגישה עודכנו',
          body: `${updated.title} — ${formatWhen(updated.startTime)}`,
        },
        actor.userId,
      )
      // `updatedAt` as the suffix: moving the meeting twice tells residents
      // twice, retrying the same save tells them once.
      await this.notifyResidentAttendees(
        actor.tenantId, updated.id, 'updated', updated.updatedAt.toISOString(),
      )
    }

    return updated
  }

  /**
   * Cancels a meeting.
   *
   * A state change, not a delete. Attendees were already told the meeting
   * exists, so the row has to survive in order for "this was called off" to be
   * a thing the system can say — and the attendee list has to survive in order
   * to know whom to tell.
   */
  async cancel(actor: AuditActor, id: string, dto: CancelMeetingDto) {
    const before = await this.loadScoped(actor.tenantId, id)

    if (before.status === 'cancelled') {
      // Idempotent-ish, but explicit: a second cancel must not fire a second
      // round of notifications at everyone.
      throw DomainError.conflict('MEETING_ALREADY_CANCELLED', 'הפגישה כבר בוטלה')
    }

    const updated = await this.prisma.meeting.update({
      where: { id: before.id },
      data: {
        status: 'cancelled' satisfies MeetingStatus,
        cancelledAt: new Date(),
        cancelReason: dto.reason ?? null,
      },
      select: MEETING_DETAIL_SELECT,
    })

    await this.audit.record(actor, {
      action: 'UPDATE',
      entity: 'Meeting',
      entityId: updated.id,
      metadata: { transition: 'cancelled', hasReason: Boolean(dto.reason) },
    })

    await this.notifyStaffAttendees(
      actor.tenantId, updated.id, updated.attendees,
      {
        title: 'הפגישה בוטלה',
        body: dto.reason
          ? `${updated.title} — ${formatWhen(updated.startTime)}. סיבה: ${dto.reason}`
          : `${updated.title} — ${formatWhen(updated.startTime)}`,
      },
      actor.userId,
    )

    // Tell residents BEFORE killing their links, so the cancellation message is
    // composed while the meeting is still loadable.
    await this.notifyResidentAttendees(
      actor.tenantId, updated.id, 'cancelled', updated.id,
    )

    // Every outstanding invitation link dies with the meeting: a cancelled
    // meeting must not leave a live credential that still accepts an RSVP.
    const revoked = await this.access.revokeForMeeting(updated.id).catch(() => 0)
    if (revoked > 0) {
      this.logger.log(`Revoked ${revoked} resident invitation link(s) for cancelled meeting ${updated.id}`)
    }

    return updated
  }

  /** Marks the meeting as having taken place. No notification — it is history. */
  async complete(actor: AuditActor, id: string, dto: CompleteMeetingDto) {
    const before = await this.loadScoped(actor.tenantId, id)
    if (before.status === 'cancelled') {
      throw DomainError.conflict('MEETING_CANCELLED', 'לא ניתן לסמן פגישה שבוטלה כהתקיימה')
    }

    const updated = await this.prisma.meeting.update({
      where: { id: before.id },
      data: {
        status: 'completed' satisfies MeetingStatus,
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      select: MEETING_DETAIL_SELECT,
    })

    await this.audit.record(actor, {
      action: 'UPDATE', entity: 'Meeting', entityId: updated.id,
      metadata: { transition: 'completed' },
    })

    /**
     * Dispatched after the write commits. `dispatch()` never throws, so a
     * broken automation cannot stop a meeting being marked as held.
     *
     * Note this is the one trigger fired from a state TRANSITION rather than a
     * creation, so it fires once per completion. Marking an already-completed
     * meeting complete again would fire it again; that is acceptable because
     * the send path is idempotency-keyed on the subject id.
     */
    await this.automations.dispatch({
      trigger: 'MEETING_COMPLETED',
      tenantId: actor.tenantId,
      projectId: updated.projectId ?? null,
      subjectId: updated.id,
      context: {
        meetingTitle: updated.title ?? '',
      },
    })

    return updated
  }

  /**
   * Hard delete.
   *
   * Only allowed while the meeting is still `scheduled` AND has no attendees:
   * once anyone has been invited, the correct verb is `cancel`, because deleting
   * silently removes something people have already been notified about and put
   * in their calendar. This is the same reasoning that stops a superseded
   * document version being deleted.
   */
  async remove(actor: AuditActor, id: string) {
    const meeting = await this.loadScoped(actor.tenantId, id)

    if (meeting.attendees.length > 0) {
      throw DomainError.conflict(
        'MEETING_HAS_ATTENDEES',
        'לפגישה יש משתתפים שכבר הוזמנו — יש לבטל אותה במקום למחוק',
      )
    }

    await this.prisma.meeting.delete({ where: { id: meeting.id } })
    await this.audit.record(actor, {
      action: 'DELETE', entity: 'Meeting', entityId: meeting.id,
      metadata: { title: meeting.title },
    })
    return { id: meeting.id }
  }

  // ── Attendees ────────────────────────────────────────────────────────────

  async addAttendees(actor: AuditActor, meetingId: string, inputs: MeetingAttendeeInputDto[]) {
    const meeting = await this.loadScoped(actor.tenantId, meetingId)
    if (meeting.status === 'cancelled') {
      throw DomainError.conflict('MEETING_CANCELLED', 'לא ניתן להוסיף משתתפים לפגישה שבוטלה')
    }

    const resolved = await Promise.all(
      inputs.map((a) => this.resolveAttendee(actor.tenantId, a)),
    )

    // Already-invited people are skipped rather than erroring: re-submitting a
    // roster that contains an existing attendee is an ordinary UI action, and
    // the unique constraint would otherwise surface as a 500.
    const existingUserIds = new Set(meeting.attendees.map((a) => a.userId).filter(Boolean))
    const existingResidentIds = new Set(
      meeting.attendees.map((a) => a.residentId).filter(Boolean),
    )
    const fresh = resolved.filter((a) =>
      a.userId ? !existingUserIds.has(a.userId) : !existingResidentIds.has(a.residentId!),
    )

    if (fresh.length > 0) {
      await this.prisma.meetingAttendee.createMany({
        data: fresh.map((a) => ({
          meetingId: meeting.id,
          ...a,
          rsvpStatus: 'pending' satisfies RsvpStatus,
        })),
      })

      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'Meeting', entityId: meeting.id,
        metadata: { transition: 'attendees_added', added: fresh.length },
      })

      await this.notifyStaffAttendees(
        actor.tenantId, meeting.id, fresh,
        {
          title: 'הוזמנתם לפגישה',
          body: `${meeting.title} — ${formatWhen(meeting.startTime)}`,
        },
        actor.userId,
      )

      // Only the NEWLY added residents — re-sending the roster must not
      // re-invite everyone who was already on it. The attendee ids are read
      // back rather than assumed, because `createMany` does not return them.
      const freshResidentIds = fresh
        .map((a) => a.residentId)
        .filter((id): id is string => Boolean(id))
      if (freshResidentIds.length > 0) {
        const newRows = await this.prisma.meetingAttendee.findMany({
          where: { meetingId: meeting.id, residentId: { in: freshResidentIds } },
          select: { id: true },
        })
        await this.notifyResidentAttendees(
          actor.tenantId, meeting.id, 'invitation', meeting.id,
          newRows.map((r) => r.id),
        )
      }
    }

    return this.loadScoped(actor.tenantId, meeting.id)
  }

  async removeAttendee(actor: AuditActor, meetingId: string, attendeeId: string) {
    // Scoped through the meeting, so an attendee id from another tenant's
    // meeting matches nothing and answers 404.
    const result = await this.prisma.meetingAttendee.deleteMany({
      where: { id: attendeeId, meeting: { id: meetingId, tenantId: actor.tenantId } },
    })
    if (result.count === 0) {
      throw DomainError.notFound('MEETING_ATTENDEE_NOT_FOUND', 'המשתתף לא נמצא')
    }

    await this.audit.record(actor, {
      action: 'UPDATE', entity: 'Meeting', entityId: meetingId,
      metadata: { transition: 'attendee_removed' },
    })

    return this.loadScoped(actor.tenantId, meetingId)
  }

  /**
   * The invitee's own RSVP.
   *
   * FIRST-PERSON ONLY. The `where` matches on `userId: actor.userId`, so a
   * caller can only answer for themselves — there is no attendee id that lets
   * one user accept on another's behalf, regardless of role. An organiser who
   * needs to record what someone told them offline uses `setAttendance` after
   * the fact, or removes and re-invites; overwriting another person's stated
   * intention is not a thing this API does.
   *
   * Residents answer through a different door entirely — their tokenised
   * invitation link, handled by `MeetingAccessService` and the public
   * `/meeting-invitations/:token/rsvp` endpoint. They still have no `User`
   * account, and this staff-only method still cannot be used on their behalf.
   */
  async rsvp(actor: AuditActor, meetingId: string, dto: RsvpDto) {
    const meeting = await this.loadScoped(actor.tenantId, meetingId)
    if (meeting.status === 'cancelled') {
      throw DomainError.conflict('MEETING_CANCELLED', 'הפגישה בוטלה')
    }

    const result = await this.prisma.meetingAttendee.updateMany({
      where: {
        meetingId: meeting.id,
        userId: actor.userId,
        meeting: { tenantId: actor.tenantId },
      },
      data: { rsvpStatus: dto.rsvpStatus, respondedAt: new Date() },
    })

    if (result.count === 0) {
      // Not invited. 404 rather than 403 — consistent with everything else, and
      // it does not confirm who else is on the invitation list.
      throw DomainError.notFound('MEETING_NOT_INVITED', 'אינכם מוזמנים לפגישה זו')
    }

    await this.audit.record(actor, {
      action: 'UPDATE', entity: 'MeetingAttendee', entityId: meeting.id,
      metadata: { transition: 'rsvp', rsvpStatus: dto.rsvpStatus },
    })

    // Tell the organiser, unless they are answering their own invitation.
    if (meeting.createdById && meeting.createdById !== actor.userId) {
      const answer = RSVP_STATUSES.includes(dto.rsvpStatus) ? dto.rsvpStatus : 'pending'
      await this.notifications.emit({
        userId: meeting.createdById,
        tenantId: actor.tenantId,
        type: 'MEETING',
        title: 'תשובה להזמנה לפגישה',
        body: `${meeting.title}: התקבלה תשובה (${answer})`,
        link: `/meetings/${meeting.id}`,
        entityType: 'Meeting',
        entityId: meeting.id,
      })
    }

    return this.loadScoped(actor.tenantId, meeting.id)
  }

  /**
   * Attendance, recorded by an organiser AFTER the meeting.
   *
   * Distinct from RSVP on purpose — see `meeting-constants.ts`. This one is
   * third-person by design (someone marks who showed up), which is why it is
   * restricted to manager roles at the controller rather than to the invitee.
   */
  async setAttendance(
    actor: AuditActor,
    meetingId: string,
    attendeeId: string,
    dto: SetAttendanceDto,
  ) {
    const result = await this.prisma.meetingAttendee.updateMany({
      where: { id: attendeeId, meeting: { id: meetingId, tenantId: actor.tenantId } },
      data: { attended: dto.attended },
    })
    if (result.count === 0) {
      throw DomainError.notFound('MEETING_ATTENDEE_NOT_FOUND', 'המשתתף לא נמצא')
    }

    await this.audit.record(actor, {
      action: 'UPDATE', entity: 'MeetingAttendee', entityId: attendeeId,
      metadata: { transition: 'attendance', attended: dto.attended },
    })

    return this.loadScoped(actor.tenantId, meetingId)
  }

  /** Exposed for tests and the CRM so the vocabulary has one source. */
  get statuses(): readonly string[] { return MEETING_STATUSES }
}
