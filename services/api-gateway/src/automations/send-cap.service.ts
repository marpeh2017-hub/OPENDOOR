import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export interface CapDecision {
  allowed: number
  blocked: number
  reason?: 'HOURLY_CAP' | 'DAILY_CAP'
  capPerHour?: number | null
  capPerDay?: number | null
  usedLastHour?: number
  usedLastDay?: number
}

/**
 * Enforces per-automation outbound send caps.
 *
 * ── WHY THE COUNT COMES FROM `Message` ROWS ────────────────────────────────
 *
 * The obvious implementation is a Redis counter with a TTL. It is the wrong one
 * here: Redis in this deployment is explicitly optional in development and
 * falls back to in-memory, so a cap built on it would silently become no cap at
 * all on a restart or a flush — and the failure would be invisible until a
 * resident received their fiftieth message.
 *
 * Counting rows already written to `messages` (tagged with `automationId`, and
 * indexed on `[automationId, createdAt]`) makes the window durable by
 * construction. It is a little more expensive per run; an automation that fires
 * often enough for that to matter is one whose cap should be low anyway.
 *
 * ── FAIL CLOSED ────────────────────────────────────────────────────────────
 *
 * If the count cannot be established, the send is REFUSED. The alternative —
 * assuming zero on error — turns a database hiccup into an uncapped send.
 */
@Injectable()
export class SendCapService {
  private readonly logger = new Logger(SendCapService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * How many of `requested` sends this automation may perform right now.
   *
   * Returns the permitted count rather than a boolean so a fan-out to a whole
   * project can be partially allowed up to the cap instead of being dropped
   * wholesale.
   */
  async check(
    automation: { id: string; sendCapPerHour: number | null; sendCapPerDay: number | null },
    requested: number,
  ): Promise<CapDecision> {
    const { sendCapPerHour, sendCapPerDay } = automation
    if (sendCapPerHour == null && sendCapPerDay == null) {
      return { allowed: requested, blocked: 0 }
    }

    const now = Date.now()
    try {
      const [usedLastHour, usedLastDay] = await Promise.all([
        sendCapPerHour == null
          ? Promise.resolve(0)
          : this.prisma.message.count({
              where: {
                automationId: automation.id,
                createdAt: { gte: new Date(now - 60 * 60 * 1000) },
              },
            }),
        sendCapPerDay == null
          ? Promise.resolve(0)
          : this.prisma.message.count({
              where: {
                automationId: automation.id,
                createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
              },
            }),
      ])

      const hourRoom = sendCapPerHour == null ? Infinity : Math.max(0, sendCapPerHour - usedLastHour)
      const dayRoom  = sendCapPerDay  == null ? Infinity : Math.max(0, sendCapPerDay  - usedLastDay)
      const room = Math.min(hourRoom, dayRoom)
      const allowed = Math.min(requested, room)

      const decision: CapDecision = {
        allowed,
        blocked: requested - allowed,
        capPerHour: sendCapPerHour,
        capPerDay: sendCapPerDay,
        usedLastHour,
        usedLastDay,
      }
      if (allowed < requested) {
        decision.reason = hourRoom <= dayRoom ? 'HOURLY_CAP' : 'DAILY_CAP'
        this.logger.warn(
          `Automation ${automation.id} hit its ${decision.reason}: ` +
          `${allowed}/${requested} sends permitted`,
        )
      }
      return decision
    } catch (err) {
      // Fail closed — see the class doc.
      this.logger.error(
        `Send cap check failed for automation ${automation.id}; refusing all sends: ` +
        `${(err as Error).message}`,
      )
      return { allowed: 0, blocked: requested, reason: 'DAILY_CAP' }
    }
  }
}
