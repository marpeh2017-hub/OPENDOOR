import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { OutboundMessageService } from '../messaging/outbound-message.service'
import { ResidentContactService, isRoutable } from '../messaging/resident-contact.service'
import { MeetingAccessService } from './meeting-access.service'

/** Every resident-facing meeting communication this module can originate. */
export type MeetingResidentEvent =
  | 'invitation'
  | 'updated'
  | 'cancelled'
  | 'reminder'

export interface ResidentFanoutResult {
  queued: number
  /** Residents that could not be reached, with the reason. For the CRM. */
  skipped: { residentId: string; reason: string }[]
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem',
  }).format(date)
}

/**
 * Resident-facing meeting communications.
 *
 * This is the module that closes the Phase 3 gap: meetings could record a
 * Resident as an attendee but had no way to tell them, because
 * `Notification.userId` is an FK to `User`. Rather than making residents into
 * Users, this fans out through the messaging dispatcher — SMS / WhatsApp /
 * email / portal inbox, chosen per resident by `ResidentContactService`
 * according to their own consent flags.
 *
 * NEVER THROWS. Same contract as `NotificationsService.emit`, for the same
 * reason: a meeting that was scheduled successfully but whose resident
 * invitation could not be queued is a degraded invitation, not a failed
 * meeting. Every failure is logged and returned in `skipped` so the CRM can
 * show the organiser exactly who was not reached and why.
 */
@Injectable()
export class MeetingResidentNotifierService {
  private readonly logger = new Logger(MeetingResidentNotifierService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundMessageService,
    private readonly contacts: ResidentContactService,
    private readonly access: MeetingAccessService,
  ) {}

  /**
   * Sends `event` to every RESIDENT attendee of `meetingId`.
   *
   * `dedupeSuffix` participates in the idempotency key. For a reminder it is
   * the offset (`1440`), so the day-before and the two-hours-before reminders
   * are distinct messages while a repeated scheduler tick for the same offset
   * is not. For an update it is the meeting's `updatedAt` timestamp, so moving
   * a meeting twice notifies twice but a retried request does not.
   */
  async notifyResidents(
    tenantId: string,
    meetingId: string,
    event: MeetingResidentEvent,
    dedupeSuffix: string,
    options?: { residentAttendeeIds?: readonly string[] },
  ): Promise<ResidentFanoutResult> {
    const out: ResidentFanoutResult = { queued: 0, skipped: [] }

    try {
      const meeting = await this.prisma.meeting.findFirst({
        where: { id: meetingId, tenantId },
        select: {
          id: true, title: true, startTime: true, location: true,
          isVirtual: true, meetingUrl: true, status: true, cancelReason: true,
        },
      })
      if (!meeting) {
        this.logger.warn(`Resident fan-out skipped: meeting ${meetingId} not in tenant`)
        return out
      }

      const attendees = await this.prisma.meetingAttendee.findMany({
        where: {
          meetingId: meeting.id,
          residentId: { not: null },
          ...(options?.residentAttendeeIds
            ? { id: { in: [...options.residentAttendeeIds] } }
            : {}),
        },
        select: { id: true, residentId: true },
      })
      if (attendees.length === 0) return out

      const routes = await this.contacts.routeMany(
        tenantId,
        attendees.map((a) => a.residentId!),
      )
      const routeById = new Map(routes.map((r) => [r.residentId, r]))

      for (const attendee of attendees) {
        const route = routeById.get(attendee.residentId!)
        if (!route || !isRoutable(route)) {
          out.skipped.push({
            residentId: attendee.residentId!,
            reason: route ? route.reason : 'NOT_FOUND',
          })
          continue
        }

        // A cancellation kills the link; everything else refreshes it, which
        // also rotates any previously-sent token.
        //
        // Rotation happens BEFORE the message is composed, because the message
        // contains the link. That ordering is unavoidable, and it is why
        // `rotated` is kept: if the send then fails, the resident would be left
        // holding a dead link and no replacement — worse off than if we had
        // never touched it. The failure path below puts the old one back.
        let link: string | null = null
        let rotated: { token: string; expiresAt: Date; useCount: number } | null = null
        if (event === 'cancelled') {
          await this.access.issueForAttendee(attendee.id).catch(() => null)
        } else {
          const issued = await this.access.issueForAttendee(attendee.id).catch((err) => {
            this.logger.error(`Could not issue invitation token: ${(err as Error).message}`)
            return null
          })
          link = issued?.url ?? null
          rotated = issued?.previous ?? null
        }

        const { subject, body } = this.compose(event, meeting, link)

        const queued = await this.outbound.enqueueSafe({
          tenantId,
          channel: route.channel,
          body,
          subject: route.channel === 'EMAIL' ? subject : null,
          residentId: route.residentId,
          toPhone: route.toPhone,
          toEmail: route.toEmail,
          // The whole point: a second scheduler tick, a retried HTTP request or
          // a duplicated job cannot produce a second message about the same
          // thing to the same person.
          idempotencyKey: `meeting:${meeting.id}:${attendee.id}:${event}:${dedupeSuffix}`,
          metadata: {
            kind: 'MEETING',
            event,
            meetingId: meeting.id,
            attendeeId: attendee.id,
            // Durable, per-resident answer to "why did my old link stop
            // working?" — the log line is transient, this row is not.
            ...(rotated ? { rotatedFromToken: `${rotated.token.slice(0, 8)}…` } : {}),
          },
        })

        if (queued) {
          out.queued += 1
        } else {
          // The replacement never left the building. Undo the rotation so the
          // link the resident already has keeps working.
          if (rotated) {
            await this.access
              .restorePrevious(attendee.id, rotated, `the ${event} message could not be queued`)
              .catch((err) => this.logger.error(`Could not restore invitation link: ${(err as Error).message}`))
          }
          out.skipped.push({ residentId: route.residentId, reason: 'ENQUEUE_FAILED' })
        }
      }
    } catch (err) {
      // Contract: never throw into the caller's transaction path.
      this.logger.error(`Resident meeting fan-out failed: ${(err as Error).message}`)
    }

    return out
  }

  /**
   * Message bodies.
   *
   * Kept short and SMS-shaped because SMS is the lowest common denominator and
   * a body that overflows a segment costs real money per resident per message.
   * No PII beyond the meeting details themselves, and the link is the only
   * sensitive element — which is why it is last, so a lock-screen preview shows
   * the meeting, not the credential.
   */
  private compose(
    event: MeetingResidentEvent,
    meeting: {
      title: string; startTime: Date; location: string | null
      isVirtual: boolean; meetingUrl: string | null; cancelReason: string | null
    },
    link: string | null,
  ): { subject: string; body: string } {
    const when = formatWhen(meeting.startTime)
    const where = meeting.isVirtual
      ? 'מפגש מקוון'
      : meeting.location ?? ''

    const headline: Record<MeetingResidentEvent, string> = {
      invitation: 'הזמנה לאסיפת דיירים',
      updated:    'עדכון פרטי אסיפת דיירים',
      cancelled:  'ביטול אסיפת דיירים',
      reminder:   'תזכורת — אסיפת דיירים',
    }

    const lines: string[] = [headline[event], meeting.title, when]
    if (where) lines.push(where)

    if (event === 'cancelled') {
      lines.push('האסיפה בוטלה.')
      if (meeting.cancelReason) lines.push(`סיבה: ${meeting.cancelReason}`)
    } else if (link) {
      lines.push(event === 'reminder' ? 'לאישור הגעה:' : 'לצפייה ולאישור הגעה:')
      lines.push(link)
    }

    return { subject: `${headline[event]}: ${meeting.title}`, body: lines.join('\n') }
  }
}
