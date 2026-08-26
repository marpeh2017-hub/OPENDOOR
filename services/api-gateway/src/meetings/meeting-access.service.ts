import { Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { AuditService } from '../common/audit/audit.service'
import { PrismaService } from '../prisma.service'
import { DomainError } from '../common/errors/domain-error'
import { MessagingConfig } from '../messaging/messaging.config'
import { RSVP_STATUSES, type RsvpStatus } from './meeting-constants'

/** What a resident sees behind their invitation link. Deliberately sparse. */
export interface MeetingInvitationView {
  meeting: {
    id: string
    title: string
    description: string | null
    location: string | null
    isVirtual: boolean
    meetingUrl: string | null
    startTime: Date
    endTime: Date | null
    status: string
    cancelledAt: Date | null
    cancelReason: string | null
    projectName: string | null
  }
  attendee: {
    id: string
    residentName: string
    rsvpStatus: string
    respondedAt: Date | null
    attended: boolean | null
  }
  /** True once the token can no longer be used to change an answer. */
  readOnly: boolean
}

const ATTENDEE_LOAD = {
  id: true, rsvpStatus: true, respondedAt: true, attended: true, residentId: true,
  resident: { select: { id: true, firstName: true, lastName: true } },
  meeting: {
    select: {
      id: true, tenantId: true, title: true, description: true, location: true,
      isVirtual: true, meetingUrl: true, startTime: true, endTime: true,
      status: true, cancelledAt: true, cancelReason: true,
      project: { select: { name: true } },
    },
  },
} as const

/**
 * Resident-facing, tokenised access to a single meeting invitation.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS SHAPE
 * ─────────────────────────────────────────────────────────────────────────
 * Modelled on `SigningSessionService`, which is the established precedent in
 * this codebase for letting a non-User act on one record: 48 random bytes,
 * base64url, an expiry, explicit revocation, and NO account. A resident never
 * becomes a `User`; the token's entire authority is "this attendee row, this
 * meeting".
 *
 * It is weaker than a signing session on purpose, and stronger in one place:
 *
 *   - WEAKER: no OTP step. A signature is a legal act with evidentiary weight,
 *     so it earns a second factor. An RSVP is a logistical courtesy; putting an
 *     SMS OTP in front of "will you attend?" would cost more in unanswered
 *     invitations than it could possibly protect. The worst a leaked link does
 *     is misreport one person's attendance intention.
 *   - STRONGER in lifetime handling: a signing session is single-use, but a
 *     resident legitimately reopens an invitation (view, accept, change their
 *     mind, confirm attendance afterwards). So instead of single-use we bound
 *     REPLAY: every state-changing use increments `useCount`, and the token
 *     dies at `MEETING_TOKEN_MAX_USES`. A replayed or shared link can therefore
 *     flip an RSVP a bounded number of times and then becomes inert, rather
 *     than being an unlimited handle for the life of the meeting.
 *
 * TENANT ISOLATION. The token carries no tenant claim. The tenant is DERIVED —
 * token → attendee → meeting.tenantId — so there is nothing in the token a
 * caller could tamper with to reach another tenant, and every write below is
 * additionally scoped by the attendee id the token resolved to.
 */
@Injectable()
export class MeetingAccessService {
  private readonly logger = new Logger(MeetingAccessService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Issues (or re-issues) the invitation token for a resident attendee.
   *
   * Re-issuing ROTATES the token and resets `useCount`. That is what makes a
   * re-sent invitation safe: the link in the old SMS stops working, so a
   * resident who forwarded it to a neighbour has not permanently delegated
   * their RSVP.
   */
  async issueForAttendee(attendeeId: string): Promise<{ token: string; url: string } | null> {
    const attendee = await this.prisma.meetingAttendee.findUnique({
      where: { id: attendeeId },
      select: { id: true, residentId: true, meeting: { select: { startTime: true, status: true } } },
    })
    // Staff attendees use the authenticated CRM; there is nothing to tokenise.
    if (!attendee || !attendee.residentId) return null
    if (attendee.meeting.status === 'cancelled') return null

    const token = randomBytes(48).toString('base64url')
    const expiresAt = this.expiryFor(attendee.meeting.startTime)

    await this.prisma.meetingAccessToken.upsert({
      where:  { attendeeId },
      create: { attendeeId, token, expiresAt },
      update: { token, expiresAt, revokedAt: null, useCount: 0 },
    })

    return { token, url: this.urlFor(token) }
  }

  /**
   * Token lifetime: the meeting's start plus a grace window, so "confirm you
   * attended" still works the morning after — capped so a meeting scheduled two
   * years out does not mint a two-year credential.
   */
  private expiryFor(startTime: Date): Date {
    const grace = startTime.getTime() + MessagingConfig.meetingTokenGraceDays * 86_400_000
    const ceiling = Date.now() + MessagingConfig.meetingTokenMaxDays * 86_400_000
    // Always at least an hour, so a meeting created for "in five minutes" still
    // produces a usable link.
    return new Date(Math.max(Date.now() + 3_600_000, Math.min(grace, ceiling)))
  }

  urlFor(token: string): string {
    return `${MessagingConfig.portalUrl}/he/meetings/invite/${token}`
  }

  /** Revokes every outstanding invitation link for a meeting. */
  async revokeForMeeting(meetingId: string): Promise<number> {
    const result = await this.prisma.meetingAccessToken.updateMany({
      where: { attendee: { meetingId }, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return result.count
  }

  /**
   * Resolves a token to its attendee, or throws.
   *
   * The error vocabulary is deliberately uniform: an unknown token, a revoked
   * token and a used-up token all answer 404, so the endpoint cannot be used to
   * enumerate valid tokens or to learn that one merely expired. Only genuine
   * expiry answers differently (410), because a resident staring at a dead link
   * needs to be told to ask for a new one rather than that they typed it wrong.
   */
  private async resolve(token: string) {
    if (!token || token.length < 32 || token.length > 128) {
      throw DomainError.notFound('MEETING_INVITE_NOT_FOUND', 'ההזמנה לא נמצאה')
    }

    const row = await this.prisma.meetingAccessToken.findUnique({
      where: { token },
      select: {
        id: true, expiresAt: true, revokedAt: true, useCount: true,
        attendee: { select: ATTENDEE_LOAD },
      },
    })

    if (!row || !row.attendee) {
      throw DomainError.notFound('MEETING_INVITE_NOT_FOUND', 'ההזמנה לא נמצאה')
    }
    if (row.revokedAt) {
      throw DomainError.notFound('MEETING_INVITE_NOT_FOUND', 'ההזמנה לא נמצאה')
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw DomainError.conflict('MEETING_INVITE_EXPIRED', 'תוקף ההזמנה פג — יש לבקש קישור חדש')
    }
    if (row.useCount >= MessagingConfig.meetingTokenMaxUses) {
      // Replay ceiling reached. Same 404 as an unknown token.
      this.logger.warn(`Meeting invitation token exhausted its use budget (attendee ${row.attendee.id})`)
      throw DomainError.notFound('MEETING_INVITE_NOT_FOUND', 'ההזמנה לא נמצאה')
    }

    return row
  }

  /** Read-only view. Does NOT consume a use — looking is free. */
  async view(token: string): Promise<MeetingInvitationView> {
    const row = await this.resolve(token)
    return this.present(row.attendee, row.useCount)
  }

  /**
   * The resident's RSVP.
   *
   * Consumes a use, inside the same transaction as the RSVP write, so a burst
   * of replayed requests cannot each read `useCount` before any of them
   * increments it. The `useCount` guard in the UPDATE's WHERE clause is the
   * atomic part — same conditional-update pattern the dispatcher uses to claim
   * a message, and safe for the same reason.
   */
  async rsvp(
    token: string,
    rsvpStatus: RsvpStatus,
    meta?: { ip?: string | null },
  ): Promise<MeetingInvitationView> {
    if (!RSVP_STATUSES.includes(rsvpStatus)) {
      throw DomainError.validation('MEETING_RSVP_INVALID', 'תשובה לא חוקית')
    }

    const row = await this.resolve(token)
    const meeting = row.attendee.meeting

    if (meeting.status === 'cancelled') {
      throw DomainError.conflict('MEETING_CANCELLED', 'הפגישה בוטלה')
    }
    if (meeting.status === 'completed') {
      throw DomainError.conflict('MEETING_ALREADY_HELD', 'הפגישה כבר התקיימה')
    }

    const consumed = await this.prisma.meetingAccessToken.updateMany({
      // Re-asserting every precondition in the WHERE clause, not trusting the
      // read above: between `resolve` and here another request may have
      // revoked or exhausted the token.
      where: {
        id: row.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        useCount: { lt: MessagingConfig.meetingTokenMaxUses },
      },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
        ...(row.useCount === 0 ? { firstUsedAt: new Date() } : {}),
      },
    })
    if (consumed.count !== 1) {
      throw DomainError.notFound('MEETING_INVITE_NOT_FOUND', 'ההזמנה לא נמצאה')
    }

    await this.prisma.meetingAttendee.update({
      where: { id: row.attendee.id },
      data: {
        rsvpStatus,
        respondedAt: new Date(),
        respondedVia: 'token',
      },
    })

    /**
     * Audited without an actor: there is no `User` behind a token RSVP, and
     * inventing one would corrupt the audit trail. `recordAnonymous` is the
     * established shape for that — the same one the public lead form uses.
     *
     * This block previously only wrote a LOG LINE while its comment claimed the
     * action was audited, and `meta.ip` — which the controller has always
     * passed — was silently discarded. A resident's RSVP is evidence about a
     * legally consequential meeting; a log line rotates away, an audit row does
     * not.
     *
     * The IP is recorded because the caller supplies it and `AuditLog` already
     * carries `ipAddress` for every other action. No resident NAME or contact
     * detail goes into the metadata — the attendee id is the identity, and it
     * resolves to a person only for someone already inside the tenant.
     */
    await this.audit.recordAnonymous(
      meeting.tenantId,
      { ip: meta?.ip ?? null, userAgent: null },
      {
        action: 'UPDATE',
        entity: 'MeetingAttendee',
        entityId: row.attendee.id,
        metadata: {
          rsvpStatus,
          respondedVia: 'token',
          meetingId: meeting.id,
        },
      },
    )

    this.logger.log(
      `Resident RSVP '${rsvpStatus}' recorded via invitation token ` +
      `(meeting ${meeting.id}, attendee ${row.attendee.id})`,
    )

    const refreshed = await this.prisma.meetingAttendee.findUniqueOrThrow({
      where: { id: row.attendee.id },
      select: ATTENDEE_LOAD,
    })
    return this.present(refreshed, row.useCount + 1)
  }

  /**
   * Post-hoc self-confirmation of attendance.
   *
   * Separate column from RSVP, per `meeting-constants.ts`. Only allowed once
   * the meeting has actually started — "I attended" before the meeting begins
   * is not a fact anyone can assert.
   */
  async confirmAttendance(token: string, attended: boolean): Promise<MeetingInvitationView> {
    const row = await this.resolve(token)
    const meeting = row.attendee.meeting

    if (meeting.status === 'cancelled') {
      throw DomainError.conflict('MEETING_CANCELLED', 'הפגישה בוטלה')
    }
    if (meeting.startTime.getTime() > Date.now()) {
      throw DomainError.conflict('MEETING_NOT_STARTED', 'הפגישה טרם התקיימה')
    }

    const consumed = await this.prisma.meetingAccessToken.updateMany({
      where: {
        id: row.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        useCount: { lt: MessagingConfig.meetingTokenMaxUses },
      },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    })
    if (consumed.count !== 1) {
      throw DomainError.notFound('MEETING_INVITE_NOT_FOUND', 'ההזמנה לא נמצאה')
    }

    await this.prisma.meetingAttendee.update({
      where: { id: row.attendee.id },
      data: { attended },
    })

    const refreshed = await this.prisma.meetingAttendee.findUniqueOrThrow({
      where: { id: row.attendee.id },
      select: ATTENDEE_LOAD,
    })
    return this.present(refreshed, row.useCount + 1)
  }

  /**
   * Shapes the resident-facing payload.
   *
   * The allow-list is the security control. A resident must not learn the
   * attendee roster (their neighbours' names and phone numbers), the organiser,
   * the internal notes, the tenant id, or the project code — all of which are
   * on the rows loaded above.
   */
  private present(
    attendee: {
      id: string
      rsvpStatus: string
      respondedAt: Date | null
      attended: boolean | null
      resident: { firstName: string; lastName: string } | null
      meeting: {
        id: string; title: string; description: string | null; location: string | null
        isVirtual: boolean; meetingUrl: string | null; startTime: Date; endTime: Date | null
        status: string; cancelledAt: Date | null; cancelReason: string | null
        project: { name: string } | null
      }
    },
    useCount: number,
  ): MeetingInvitationView {
    const m = attendee.meeting
    return {
      meeting: {
        id: m.id,
        title: m.title,
        description: m.description,
        location: m.location,
        isVirtual: m.isVirtual,
        meetingUrl: m.meetingUrl,
        startTime: m.startTime,
        endTime: m.endTime,
        status: m.status,
        cancelledAt: m.cancelledAt,
        cancelReason: m.cancelReason,
        projectName: m.project?.name ?? null,
      },
      attendee: {
        id: attendee.id,
        residentName: attendee.resident
          ? `${attendee.resident.firstName} ${attendee.resident.lastName}`.trim()
          : '',
        rsvpStatus: attendee.rsvpStatus,
        respondedAt: attendee.respondedAt,
        attended: attendee.attended,
      },
      readOnly:
        m.status !== 'scheduled' ||
        useCount >= MessagingConfig.meetingTokenMaxUses,
    }
  }
}
