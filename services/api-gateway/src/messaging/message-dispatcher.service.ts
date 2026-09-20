import { Injectable, Logger } from '@nestjs/common'
import type { Message } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { ProviderRegistryService } from './provider-registry.service'
import { MessagingConfig, backoffDelayMs } from './messaging.config'
import { sanitiseProviderDetail } from './sanitise'
import { DeliveryError } from './providers/delivery-provider.interface'
import type { OutboundPayload } from './providers/delivery-provider.interface'

export interface DispatchTickResult {
  claimed: number
  sent: number
  retried: number
  failed: number
  requeuedStuck: number
}

/**
 * The dispatcher. Claims queued messages and drives them to a terminal status.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY A DATABASE QUEUE
 * ─────────────────────────────────────────────────────────────────────────
 * No queue infrastructure existed, and this workload does not justify creating
 * any. The volume is a few thousand messages a day across all tenants — a
 * rounding error for Postgres. More importantly, the `Message` row is REQUIRED
 * to exist and to be durable regardless of the queue: it is the tenant's
 * communications log, it is read by the CRM, and it is evidence in a
 * pinuy-binuy process. Once the row must be in Postgres anyway, putting the
 * queue state in a second system (Redis list, RabbitMQ — `amqplib` is even in
 * package.json) buys nothing and costs the hardest bug class there is: the
 * queue and the log disagreeing about whether a message was sent, with no
 * transaction spanning both.
 *
 * So: the queue IS the table, `status` IS the queue state, and a polling worker
 * drains it. Redis is used elsewhere in this service and remains available for
 * rate limiting; it is not a system of record here.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY NO DOUBLE-SEND (the concurrency argument)
 * ─────────────────────────────────────────────────────────────────────────
 * Claiming is a single conditional UPDATE:
 *
 *     UPDATE messages SET status='PROCESSING', ...
 *      WHERE id = $1 AND status = 'QUEUED'
 *
 * expressed as Prisma's `updateMany` (which compiles to exactly that) and
 * guarded on `result.count === 1`.
 *
 * Under PostgreSQL's default READ COMMITTED, when two workers issue this
 * statement for the same row concurrently, the second blocks on the first's row
 * lock. When the first commits, the second does NOT proceed on its original
 * snapshot: Postgres re-evaluates the WHERE clause against the newly committed
 * version (the EvalPlanQual recheck). That version has `status='PROCESSING'`,
 * so the predicate now fails, the row is not updated, and the second worker
 * gets `count = 0` and skips it. Exactly one worker ever sees `count = 1`, and
 * only that worker calls the provider. This holds across processes and machines
 * because the guarantee is the row lock, not anything in Node.
 *
 * `SELECT … FOR UPDATE SKIP LOCKED` would also work and is the usual idiom, but
 * it requires holding a transaction open across the provider HTTP call — which
 * means a database connection pinned for up to `providerTimeoutMs`, and a
 * connection-pool exhaustion incident the first time a provider hangs. The
 * conditional UPDATE takes its lock for microseconds and releases it before any
 * network I/O. That is the trade that decided it.
 *
 * The residual risk is not double-send but LOST send: a worker that dies
 * between claiming and completing leaves a row PROCESSING forever. `requeueStuck`
 * handles that, and it is why `attemptCount` increments on CLAIM rather than on
 * success — a crash-looping message consumes its attempts and reaches FAILED
 * instead of being retried indefinitely.
 */
@Injectable()
export class MessageDispatcherService {
  private readonly logger = new Logger(MessageDispatcherService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistryService,
  ) {}

  /**
   * One pass over the queue. Never throws — a dispatcher that can crash the
   * process on a bad message is a dispatcher that takes the API down with it.
   */
  async tick(opts?: { tenantId?: string }): Promise<DispatchTickResult> {
    const result: DispatchTickResult = { claimed: 0, sent: 0, retried: 0, failed: 0, requeuedStuck: 0 }

    try {
      result.requeuedStuck = await this.requeueStuck(opts)
    } catch (err) {
      this.logger.error(`Stuck-message sweep failed: ${sanitiseProviderDetail(err)}`)
    }

    let candidates: { id: string }[]
    try {
      candidates = await this.prisma.message.findMany({
        where: {
          status: 'QUEUED',
          direction: 'OUTBOUND',
          // Optional tenant scope. The background worker never passes it — a
          // production queue is drained globally and must stay that way, or a
          // tenant with no scheduled tick would never send. It exists so a
          // CALLER can drain exactly one tenant: the E2E suites run in
          // parallel against one shared database, and an unscoped tick in one
          // suite would claim messages another suite had just enqueued and is
          // asserting on, producing a false failure that says nothing about
          // the dispatcher.
          ...(opts?.tenantId ? { tenantId: opts.tenantId } : {}),
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        },
        select: { id: true },
        orderBy: { nextAttemptAt: 'asc' },
        take: MessagingConfig.batchSize,
      })
    } catch (err) {
      this.logger.error(`Queue scan failed: ${sanitiseProviderDetail(err)}`)
      return result
    }

    // Sequential rather than Promise.all: the candidates are already a bounded
    // batch, and serialising keeps a provider's rate limit reachable instead of
    // firing 20 concurrent requests at it.
    for (const { id } of candidates) {
      try {
        const outcome = await this.processOne(id)
        if (outcome === 'skipped') continue
        result.claimed += 1
        if (outcome === 'sent') result.sent += 1
        else if (outcome === 'retried') result.retried += 1
        else if (outcome === 'failed') result.failed += 1
      } catch (err) {
        // A failed message must never crash the app, and must never stop the
        // rest of the batch.
        this.logger.error(`Dispatch of message ${id} threw: ${sanitiseProviderDetail(err)}`)
      }
    }

    return result
  }

  /** Claim → send → transition, for one message. */
  async processOne(id: string): Promise<'skipped' | 'sent' | 'retried' | 'failed'> {
    const claimed = await this.claim(id)
    if (!claimed) return 'skipped'

    const provider = this.registry.resolve(claimed.channel)

    const payload: OutboundPayload = {
      messageId: claimed.id,
      channel:   claimed.channel,
      toPhone:   claimed.toPhone,
      toEmail:   claimed.toEmail,
      subject:   claimed.subject,
      body:      claimed.body,
    }

    try {
      const delivery = await withTimeout(
        provider.send(payload),
        MessagingConfig.providerTimeoutMs,
      )

      const now = new Date()
      await this.prisma.message.update({
        where: { id: claimed.id },
        data: {
          // SENT is written here and ONLY here — on the resolve path of an
          // actual provider call. There is no other assignment of SENT in this
          // module.
          status: provider.channel === 'PORTAL' || provider.channel === 'IN_APP'
            // Our own inbox: durable === delivered, and no webhook will ever
            // arrive to advance it, so it would sit at SENT forever.
            ? 'DELIVERED'
            : 'SENT',
          sentAt: now,
          ...(provider.channel === 'PORTAL' || provider.channel === 'IN_APP'
            ? { deliveredAt: now }
            : {}),
          providerName: provider.name,
          providerMessageId: delivery.providerMessageId ?? null,
          isSimulated: delivery.simulated,
          failureReason: null,
          nextAttemptAt: null,
        },
      })
      return 'sent'
    } catch (err) {
      return this.recordFailure(claimed, provider.name, err)
    }
  }

  /**
   * The atomic claim. See the class comment for why this is safe.
   *
   * Returns the claimed row, or null if another worker got there first.
   */
  private async claim(id: string): Promise<Message | null> {
    const now = new Date()
    const result = await this.prisma.message.updateMany({
      // The `status: 'QUEUED'` predicate is the entire concurrency control.
      // Removing it — or replacing this with findUnique+update — reintroduces
      // double-send.
      where: {
        id,
        status: 'QUEUED',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: {
        status: 'PROCESSING',
        // Incremented on claim, not on success: see the class comment.
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
      },
    })

    if (result.count !== 1) return null
    return this.prisma.message.findUnique({ where: { id } })
  }

  /**
   * Applies the retry policy to a failed send.
   *
   * Permanent errors skip straight to FAILED — retrying "invalid phone number"
   * four more times delays the human fix and burns provider quota.
   */
  private async recordFailure(
    claimed: Message,
    providerName: string,
    err: unknown,
  ): Promise<'retried' | 'failed'> {
    const isDelivery = err instanceof DeliveryError
    const retryable = isDelivery ? (err as DeliveryError).retryable : true
    // Sanitised before it reaches BOTH the log and the database column. The
    // CRM renders `failureReason`, so an unscrubbed provider echo would put a
    // signing link or an OTP on a support engineer's screen.
    const reason = sanitiseProviderDetail(err)

    const exhausted = claimed.attemptCount >= claimed.maxAttempts
    const giveUp = !retryable || exhausted

    if (giveUp) {
      await this.prisma.message.update({
        where: { id: claimed.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: reason,
          providerName,
          nextAttemptAt: null,
        },
      })
      this.logger.warn(
        `Message ${claimed.id} FAILED permanently after ${claimed.attemptCount} attempt(s) ` +
        `via ${providerName}: ${reason}`,
      )
      return 'failed'
    }

    const delay = backoffDelayMs(claimed.attemptCount)
    await this.prisma.message.update({
      where: { id: claimed.id },
      data: {
        // Back to QUEUED, not to a separate RETRYING status: the queue has one
        // waiting state and `nextAttemptAt` says when. A second waiting state
        // would need its own claim predicate and its own way to get stuck.
        status: 'QUEUED',
        failureReason: reason,
        providerName,
        nextAttemptAt: new Date(Date.now() + delay),
      },
    })
    this.logger.warn(
      `Message ${claimed.id} attempt ${claimed.attemptCount}/${claimed.maxAttempts} failed ` +
      `via ${providerName}, retrying in ~${Math.round(delay / 1000)}s: ${reason}`,
    )
    return 'retried'
  }

  /**
   * Returns abandoned PROCESSING rows to the queue.
   *
   * The `lastAttemptAt` cutoff must exceed the provider timeout, or this sweep
   * would re-queue a send that is still legitimately in flight — which IS the
   * double-send this module is built to prevent. `stuckAfterMs` defaults to 8×
   * the provider timeout for that reason.
   */
  async requeueStuck(opts?: { tenantId?: string }): Promise<number> {
    const cutoff = new Date(Date.now() - MessagingConfig.stuckAfterMs)
    const result = await this.prisma.message.updateMany({
      // Same optional scope as `tick` — see the comment there.
      where: {
        status: 'PROCESSING',
        lastAttemptAt: { lt: cutoff },
        ...(opts?.tenantId ? { tenantId: opts.tenantId } : {}),
      },
      data: {
        status: 'QUEUED',
        nextAttemptAt: new Date(),
        failureReason: 'worker did not complete the attempt; re-queued',
      },
    })
    if (result.count > 0) {
      this.logger.warn(`Re-queued ${result.count} message(s) abandoned in PROCESSING`)
    }
    return result.count
  }
}

/**
 * Hard ceiling on a provider call.
 *
 * `fetch` gets an AbortSignal inside each provider, but a provider SDK
 * (Twilio's, Vonage's) may not honour any timeout at all, and a hung SDK call
 * would pin a worker slot indefinitely.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(DeliveryError.transient(`provider call timed out after ${ms}ms`)),
      ms,
    )
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}
