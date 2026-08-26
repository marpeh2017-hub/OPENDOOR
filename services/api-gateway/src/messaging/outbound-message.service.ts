import { Injectable, Logger } from '@nestjs/common'
import type { MessageChannel, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { DomainError } from '../common/errors/domain-error'
import { MessagingConfig } from './messaging.config'

/** Channels a caller may enqueue. IN_APP is the Notification module's job. */
export const ENQUEUEABLE_CHANNELS: readonly MessageChannel[] = ['SMS', 'WHATSAPP', 'EMAIL', 'PORTAL']

export interface EnqueueInput {
  tenantId: string
  channel: MessageChannel
  body: string
  subject?: string | null
  residentId?: string | null
  toPhone?: string | null
  toEmail?: string | null
  /**
   * De-duplication key, unique per tenant. Supplying one makes the enqueue
   * IDEMPOTENT: a second call with the same key returns the existing row
   * instead of creating a second message. Every automated emitter (meeting
   * invitations, reminders, signature invitations) MUST supply one — they run
   * on retryable paths and on timers, and "the scheduler ticked twice" must not
   * mean "the resident got two texts at 06:00".
   */
  idempotencyKey?: string | null
  metadata?: Prisma.InputJsonValue | null
  /** Overrides the configured default. Used for one-shot, don't-retry sends. */
  maxAttempts?: number
  /** Delay before the first attempt. Used by nothing yet; reminders use it. */
  delayMs?: number
  /** Template this body was rendered from, for provenance. */
  templateId?: string | null
  /**
   * Automation that produced this message.
   *
   * Not decoration: per-automation send caps are counted from these rows, so an
   * automated send that fails to tag itself here is a send that does not count
   * against its own cap.
   */
  automationId?: string | null
}

/**
 * Enqueue-side of the pipeline: turns a business intention into a durable
 * QUEUED `Message` row. It does NOT send — sending is the dispatcher's job,
 * and keeping the two apart is what makes a send survive a process restart.
 *
 * Every other module talks to messaging through THIS service. Nothing writes
 * `prisma.message` with a QUEUED status directly, or the recipient validation,
 * the attempt cap and the idempotency contract all get bypassed one caller at
 * a time.
 */
@Injectable()
export class OutboundMessageService {
  private readonly logger = new Logger(OutboundMessageService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates (or returns) a queued message.
   *
   * IDEMPOTENCY IMPLEMENTATION. The unique index `(tenantId, idempotencyKey)`
   * is the authority, not a pre-read. We attempt the insert and catch P2002,
   * rather than checking-then-inserting, because two concurrent callers would
   * both pass a check and both insert. The database constraint is the only
   * thing that is actually atomic here.
   */
  async enqueue(input: EnqueueInput): Promise<{ id: string; status: string; deduplicated: boolean }> {
    if (!ENQUEUEABLE_CHANNELS.includes(input.channel)) {
      throw DomainError.validation('MESSAGE_CHANNEL_NOT_SENDABLE', 'ערוץ ההודעה אינו נתמך')
    }
    if (!input.body?.trim()) {
      throw DomainError.validation('MESSAGE_BODY_EMPTY', 'גוף ההודעה ריק')
    }

    // A message with no way to reach anyone is a bug at the call site, and
    // storing it would mean a permanent FAILED row nobody asked for.
    const hasAddress = Boolean(input.toPhone || input.toEmail || input.residentId)
    if (!hasAddress) {
      throw DomainError.validation('MESSAGE_NO_RECIPIENT', 'להודעה אין נמען')
    }
    if (input.channel === 'EMAIL' && !input.toEmail) {
      throw DomainError.validation('MESSAGE_NO_EMAIL', 'לערוץ דוא״ל נדרשת כתובת דוא״ל')
    }
    if ((input.channel === 'SMS' || input.channel === 'WHATSAPP') && !input.toPhone) {
      throw DomainError.validation('MESSAGE_NO_PHONE', 'לערוץ זה נדרש מספר טלפון')
    }

    const now = Date.now()
    const data: Prisma.MessageUncheckedCreateInput = {
      tenantId:  input.tenantId,
      channel:   input.channel,
      direction: 'OUTBOUND',
      status:    'QUEUED',
      body:      input.body,
      subject:   input.subject ?? null,
      residentId: input.residentId ?? null,
      toPhone:   input.toPhone ?? null,
      toEmail:   input.toEmail ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      // Snapshotted at enqueue time. Raising MESSAGE_MAX_ATTEMPTS later must
      // not resurrect messages that already exhausted the old cap.
      maxAttempts: Math.min(20, Math.max(1, input.maxAttempts ?? MessagingConfig.maxAttempts)),
      nextAttemptAt: new Date(now + Math.max(0, input.delayMs ?? 0)),
      templateId:   input.templateId ?? null,
      automationId: input.automationId ?? null,
      metadata: (input.metadata ?? undefined) as never,
    }

    try {
      const row = await this.prisma.message.create({
        data,
        select: { id: true, status: true },
      })
      return { ...row, deduplicated: false }
    } catch (err) {
      if (input.idempotencyKey && isUniqueViolation(err)) {
        const existing = await this.prisma.message.findFirst({
          where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
          select: { id: true, status: true },
        })
        if (existing) {
          this.logger.debug(`Enqueue de-duplicated on key (tenant ${input.tenantId})`)
          return { ...existing, deduplicated: true }
        }
      }
      throw err
    }
  }

  /**
   * Best-effort enqueue for callers on a business-critical path.
   *
   * Same rule as `NotificationsService.emit`: failing to queue a notification
   * must not roll back the meeting that caused it. Returns null on failure.
   */
  async enqueueSafe(input: EnqueueInput): Promise<{ id: string } | null> {
    try {
      return await this.enqueue(input)
    } catch (err) {
      this.logger.error(
        `Failed to enqueue ${input.channel} message: ${(err as Error).message}`,
      )
      return null
    }
  }

  /**
   * Withdraws a message that has not gone out yet.
   *
   * Scoped `updateMany` guarded on `status: QUEUED`, so it cannot cancel a
   * message a worker has already claimed — at that point a provider call may be
   * in flight and "cancelled" would be a lie.
   */
  async cancel(tenantId: string, id: string, reason?: string): Promise<{ id: string }> {
    const result = await this.prisma.message.updateMany({
      where: { id, tenantId, status: 'QUEUED' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        failureReason: reason ? reason.slice(0, 240) : 'cancelled',
      },
    })
    if (result.count === 0) {
      // Either it does not exist, is in another tenant, or has left QUEUED.
      const exists = await this.prisma.message.findFirst({
        where: { id, tenantId }, select: { status: true },
      })
      if (!exists) throw DomainError.notFound('MESSAGE_NOT_FOUND', 'ההודעה לא נמצאה')
      throw DomainError.conflict(
        'MESSAGE_NOT_CANCELLABLE',
        'לא ניתן לבטל הודעה שכבר יצאה לשליחה',
      )
    }
    return { id }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}
