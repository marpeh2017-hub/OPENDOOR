import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { MessagingConfig } from '../messaging/messaging.config'
import { MeetingResidentNotifierService } from './meeting-resident-notifier.service'

export interface ReminderScanResult {
  meetingsConsidered: number
  remindersDispatched: number
  staffNotified: number
  residentsQueued: number
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem',
  }).format(date)
}

/**
 * Meeting reminders.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE MINIMUM RELIABLE MECHANISM
 * ─────────────────────────────────────────────────────────────────────────
 * No scheduler existed. What is added is a self-rescheduling `setTimeout` that
 * runs a SCAN — not a per-meeting timer, and not a cron library.
 *
 * A per-meeting `setTimeout` is the obvious design and it is wrong: timers live
 * in one process's memory, so every deploy, crash and restart silently drops
 * every pending reminder, and nothing tells you it happened. The scan asks the
 * database "what is due and not yet sent?", which means a process that was down
 * at the reminder moment simply sends it on its next tick. Restart-safe by
 * construction rather than by care.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NO DUPLICATE REMINDERS
 * ─────────────────────────────────────────────────────────────────────────
 * Two independent guards, deliberately belt-and-braces because a duplicated
 * 06:00 SMS to two hundred residents is both expensive and the kind of thing
 * that gets a platform muted:
 *
 *   1. `MeetingReminderDispatch` has a UNIQUE (meetingId, offsetMinutes). The
 *      scanner INSERTS that row FIRST and treats a unique violation as "someone
 *      else already claimed this reminder" — the same conditional-claim idea
 *      the message dispatcher uses, and the reason two API instances running
 *      the scanner concurrently is safe.
 *   2. Every resident message carries an idempotency key that includes the
 *      offset, so even if guard 1 were somehow bypassed the message-level
 *      unique index still collapses the duplicate.
 *
 * A CANCELLED MEETING PRODUCES NO REMINDERS: the scan filters on
 * `status: 'scheduled'`, so cancelling before the reminder window means it is
 * never claimed, and cancelling after means the row already exists and cannot
 * be claimed again.
 */
@Injectable()
export class MeetingReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MeetingReminderService.name)
  private timer: NodeJS.Timeout | null = null
  private stopped = false
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly residentNotifier: MeetingResidentNotifierService,
  ) {}

  onModuleInit(): void {
    if (!MessagingConfig.reminderSchedulerEnabled) {
      this.logger.log('Meeting reminder scheduler disabled (MEETING_REMINDER_ENABLED)')
      return
    }
    const offsets = MessagingConfig.reminderOffsetsMinutes
    if (offsets.length === 0) {
      this.logger.log('Meeting reminders disabled (no offsets configured)')
      return
    }
    this.logger.log(
      `Meeting reminder scheduler started — offsets ${offsets.join(',')} minutes, ` +
      `scanning every ${MessagingConfig.reminderScanIntervalMs}ms`,
    )
    this.schedule(0)
  }

  onModuleDestroy(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return
    this.timer = setTimeout(() => { void this.loop() }, delayMs)
    this.timer.unref?.()
  }

  private async loop(): Promise<void> {
    if (this.stopped || this.running) return
    this.running = true
    try {
      const r = await this.scan()
      if (r.remindersDispatched > 0) {
        this.logger.log(
          `reminder scan: dispatched=${r.remindersDispatched} ` +
          `staff=${r.staffNotified} residents=${r.residentsQueued}`,
        )
      }
    } catch (err) {
      this.logger.error(`Reminder scan failed: ${(err as Error).message}`)
    } finally {
      this.running = false
      this.schedule(MessagingConfig.reminderScanIntervalMs)
    }
  }

  /**
   * One scan pass. Public so tests drive it deterministically instead of
   * waiting on a timer.
   */
  async scan(now: Date = new Date()): Promise<ReminderScanResult> {
    const result: ReminderScanResult = {
      meetingsConsidered: 0, remindersDispatched: 0, staffNotified: 0, residentsQueued: 0,
    }

    const offsets = MessagingConfig.reminderOffsetsMinutes
    if (offsets.length === 0) return result

    for (const offset of offsets) {
      /*
       * The window. A reminder for offset O is due when the meeting starts
       * within O minutes. The lower bound stops a scan that has been down for a
       * week from blasting reminders for meetings that already happened — a
       * reminder that arrives after the meeting is worse than none.
       *
       * There is deliberately no upper-bound tightening to "exactly one scan
       * interval wide": a wide window plus the unique claim is what makes
       * downtime recoverable. Narrow windows plus a missed tick means a silently
       * skipped reminder.
       */
      const dueBefore = new Date(now.getTime() + offset * 60_000)

      const meetings = await this.prisma.meeting.findMany({
        where: {
          status: 'scheduled',
          startTime: { gt: now, lte: dueBefore },
          // Not yet claimed for THIS offset.
          reminders: { none: { offsetMinutes: offset } },
        },
        select: {
          id: true, tenantId: true, title: true, startTime: true, createdAt: true,
          location: true, isVirtual: true, createdById: true,
          attendees: { select: { id: true, userId: true, residentId: true } },
        },
        // Bounded so a backlog cannot make one tick run for minutes.
        take: 100,
      })

      result.meetingsConsidered += meetings.length

      for (const meeting of meetings) {
        /*
         * A reminder only fires for a window the meeting EXISTED before.
         *
         * Without this, scheduling a meeting for two hours from now instantly
         * fires the day-before reminder as well: the meeting is trivially
         * "within 1440 minutes of starting", so every larger offset matches at
         * once and the resident gets the invitation and two reminders inside a
         * minute. Nobody reads a reminder that arrives seconds after the thing
         * it is reminding you about.
         *
         * Expressed in JS rather than in the WHERE clause because it compares
         * two columns of the same row (`startTime` vs `createdAt`), which
         * Prisma cannot express. The query is already bounded to 100 rows, so
         * filtering here costs nothing.
         *
         * CONSEQUENCE, and it is intended: a meeting scheduled at shorter
         * notice than the smallest offset gets no reminder at all. The
         * invitation IS the notice in that case.
         */
        const leadAtCreation = meeting.startTime.getTime() - meeting.createdAt.getTime()
        if (leadAtCreation < offset * 60_000) continue

        // ── The claim. Insert-first; a unique violation means another scanner
        //    (or another API instance) owns this reminder.
        try {
          await this.prisma.meetingReminderDispatch.create({
            data: { meetingId: meeting.id, offsetMinutes: offset },
          })
        } catch (err) {
          if ((err as { code?: string }).code === 'P2002') continue
          this.logger.error(`Could not claim reminder: ${(err as Error).message}`)
          continue
        }

        result.remindersDispatched += 1

        // ── Staff attendees: in-app notification. Never throws.
        const staffIds = meeting.attendees
          .map((a) => a.userId)
          .filter((id): id is string => Boolean(id))

        const staffNotified = staffIds.length
          ? await this.notifications.emitMany(staffIds, {
              tenantId: meeting.tenantId,
              type: 'MEETING',
              title: 'תזכורת לפגישה',
              body: `${meeting.title} — ${formatWhen(meeting.startTime)}`,
              link: `/meetings/${meeting.id}`,
              entityType: 'Meeting',
              entityId: meeting.id,
            })
          : 0

        // ── Resident attendees: through the dispatcher. In development the
        //    dev/no-op provider means nothing is actually transmitted.
        const fanout = await this.residentNotifier.notifyResidents(
          meeting.tenantId, meeting.id, 'reminder', String(offset),
        )

        result.staffNotified += staffNotified
        result.residentsQueued += fanout.queued

        await this.prisma.meetingReminderDispatch.updateMany({
          where: { meetingId: meeting.id, offsetMinutes: offset },
          data: { staffNotified, residentsQueued: fanout.queued },
        }).catch(() => undefined)
      }
    }

    return result
  }
}
