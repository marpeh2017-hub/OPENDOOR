import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import type { PortalScope } from './portal-scope.service'

/**
 * What the project has actually said to this resident.
 *
 * ── "ACTUALLY" IS THE WHOLE POINT ───────────────────────────────────────────
 *
 * A `Message` row is created the moment somebody presses send, in state
 * `QUEUED`, and the dispatcher advances it later. A queued message has not been
 * sent. A failed message was never delivered. A cancelled one was withdrawn
 * before it left.
 *
 * Showing any of those here would tell a resident they were informed of
 * something they never received — and in a pinuy-binuy project that is not a
 * cosmetic error. "You were notified" is a claim that gets made in front of a
 * lawyer, and the portal must not be the thing that manufactures it.
 *
 * ── WHY `SENT` COUNTS AS DELIVERED, FOR NOW ─────────────────────────────────
 *
 * `SENT` is written in exactly one place — the resolve path of a real provider
 * call — so it means "a carrier accepted this for delivery". `DELIVERED` means
 * a receipt came back, and `READ` that the recipient opened it.
 *
 * No delivery receipts are wired up yet (the 2026-09-09 audit lists this as
 * A6: `SENT` conflated with delivered, `providerMessageId` unused), so today
 * every real message sits at `SENT` and a `DELIVERED`-only filter would show
 * the resident an empty page. `SENT` is therefore the strongest available fact,
 * and this list is the reason to want a stronger one: WHEN A6 IS CLOSED AND
 * RECEIPTS LAND, TIGHTEN THIS SET.
 *
 * PORTAL-channel messages are the exception that proves the rule — the
 * dispatcher writes them straight to `DELIVERED`, because their transport is
 * this database and durable genuinely does mean delivered.
 */

/**
 * Statuses that mean the message reached the resident, or as near as the system
 * can currently establish. Deliberately a named constant: it is the one line in
 * this file that will change, and it should be obvious where.
 */
const REACHED_THE_RESIDENT = ['SENT', 'DELIVERED', 'READ'] as const

const DEFAULT_LIMIT = 30

@Injectable()
export class PortalMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: PortalScope, opts: { limit?: number; cursor?: string } = {}) {
    const limit = opts.limit ?? DEFAULT_LIMIT

    /*
     * The cursor is a message id from the previous page. It is applied INSIDE
     * the scoped query, so a cursor naming another resident's message simply
     * matches nothing and pages from the start rather than reaching across.
     */
    const where = {
      residentId: scope.residentId,
      tenantId: scope.tenantId,
      direction: 'OUTBOUND' as const,
      status: { in: [...REACHED_THE_RESIDENT] },
    }

    const [rows, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        select: {
          id: true, subject: true, body: true, channel: true, status: true,
          sentAt: true, deliveredAt: true, createdAt: true,
          automationId: true,
          template: { select: { name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        // One extra row answers "is there another page?" without a second count.
        take: limit + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      }),
      this.prisma.message.count({ where }),
    ])

    const page = rows.slice(0, limit)
    const hasMore = rows.length > limit

    return {
      total,
      /** The project is the sender; `Message` records no individual author. */
      from: scope.projectName,
      messages: page.map((m) => ({
        id: m.id,
        subject: m.subject,
        body: m.body,
        channel: m.channel,
        // The moment it left, not the moment it was composed. A message that
        // sat in the queue for an hour was received an hour later.
        sentAt: m.sentAt ?? m.createdAt,
        deliveredAt: m.deliveredAt,
        /**
         * Whether a person or a rule sent it. Not decoration: a resident
         * deciding whether to phone the office is better off knowing that the
         * 06:00 reminder was automatic.
         */
        automated: m.automationId !== null,
        templateName: m.template?.name ?? null,
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    }
  }
}
