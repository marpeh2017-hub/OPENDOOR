import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { DomainError } from '../common/errors/domain-error'
import {
  isNotificationKind, type NotificationKind, type NotificationEntityType,
} from './notification-kinds'
import type { CreateNotificationDto, ListNotificationsQueryDto } from './dto/notification.dto'

/**
 * Columns safe to return. `userId` is included deliberately — a caller only
 * ever receives their OWN rows, so it is never new information, and the CRM
 * uses it as a sanity check.
 */
const PUBLIC_FIELDS = {
  id: true, type: true, title: true, body: true, link: true,
  entityType: true, entityId: true, isRead: true, readAt: true,
  metadata: true, createdAt: true, userId: true,
} as const

/** What another module passes to `emit`. */
export interface EmitNotificationInput {
  /** Recipient. MUST belong to `tenantId`; `emit` verifies and refuses if not. */
  userId: string
  tenantId: string
  type: NotificationKind
  title: string
  body: string
  /** Relative in-app path. Absolute URLs are stripped — see `safeLink`. */
  link?: string | null
  entityType?: NotificationEntityType | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Notifications — the in-app delivery substrate.
 *
 * This is NOT a UI feature with an API bolted on. It is the thing other modules
 * call when they need to tell a person something, and Meetings (Phase C) and
 * Automations (later) are its consumers. Two design consequences follow:
 *
 *   1. `emit` / `emitMany` are the integration point, and they are written to be
 *      called from inside another module's request handling. They therefore
 *      NEVER throw for a recoverable reason: a failure to notify must not roll
 *      back the business operation that triggered it. A meeting that was
 *      created successfully but whose invitation notification failed is a
 *      degraded notification, not a failed meeting. Failures are logged and
 *      swallowed; unrecoverable programmer errors (a kind that is not in the
 *      registry) are logged loudly and the row is skipped.
 *
 *   2. Reading is strictly first-person. There is no "list notifications for
 *      user X" endpoint and no admin override, because a notification body is
 *      arbitrary text about that user's work. Every read path below is filtered
 *      by BOTH `userId` and `tenantId` taken from the JWT — never from a
 *      parameter — so there is no id a caller can supply to widen the scope.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The scope EVERY read and every mutation is filtered by.
   *
   * Both halves matter. `userId` alone would be enough in a correct system —
   * user ids are cuids and unique across tenants — but pairing it with
   * `tenantId` means a row that somehow acquired the wrong tenant (a bad
   * backfill, a bug in a future emitter) becomes invisible rather than
   * cross-tenant readable. Cheap, and it fails closed.
   */
  private ownScope(actor: { userId: string; tenantId: string }) {
    return { userId: actor.userId, tenantId: actor.tenantId }
  }

  /**
   * Refuses anything that is not a relative in-app path.
   *
   * A notification's `link` is rendered by the CRM as a destination the user
   * clicks. If an emitter could put `https://evil.example` (or `javascript:`)
   * there, the notification list would be an open redirect / script sink inside
   * an authenticated surface. Only a path beginning with a single `/` is kept;
   * `//host` is rejected too, because a protocol-relative URL is an absolute
   * URL that merely looks like a path.
   */
  private safeLink(link: string | null | undefined): string | null {
    if (!link) return null
    const trimmed = link.trim()
    if (!trimmed.startsWith('/')) return null
    if (trimmed.startsWith('//')) return null
    if (trimmed.includes('\\')) return null
    return trimmed.slice(0, 500)
  }

  // ── Emission (the integration point for other modules) ───────────────────

  /**
   * Creates one notification. Returns the row, or `null` if it could not be
   * created — callers are expected to ignore the return value.
   *
   * The recipient is verified to be in `tenantId` before the write. That check
   * is the reason this cannot be used to plant a notification in another
   * tenant, and it is done with a scoped `findFirst` rather than a `findUnique`
   * plus comparison so there is no branch to get wrong.
   */
  async emit(input: EmitNotificationInput): Promise<{ id: string } | null> {
    try {
      if (!isNotificationKind(input.type)) {
        // A programmer error, not a user error: some module is emitting a kind
        // that is not in the registry. Loud, and skipped rather than stored,
        // because an unrecognised kind renders as a blank row in the CRM.
        this.logger.error(`Refusing notification with unknown kind: ${String(input.type)}`)
        return null
      }

      const recipient = await this.prisma.user.findFirst({
        where: { id: input.userId, tenantId: input.tenantId },
        select: { id: true },
      })
      if (!recipient) {
        this.logger.warn('Refusing notification: recipient is not in the emitting tenant')
        return null
      }

      const row = await this.prisma.notification.create({
        data: {
          tenantId:   input.tenantId,
          userId:     input.userId,
          type:       input.type,
          title:      input.title.slice(0, 200),
          body:       input.body.slice(0, 2000),
          link:       this.safeLink(input.link),
          entityType: input.entityType ?? null,
          entityId:   input.entityId ?? null,
          metadata:   (input.metadata ?? undefined) as never,
        },
        select: { id: true },
      })
      return row
    } catch (error) {
      // Never propagate. See the class comment: a notification failure must not
      // roll back the operation that triggered it.
      this.logger.error(
        `Failed to emit ${String(input.type)} notification: ${(error as Error).message}`,
      )
      return null
    }
  }

  /**
   * Fan-out to several recipients. Each is emitted independently so one bad
   * recipient (deleted user, wrong tenant) does not cost the others their
   * notification. Returns how many were actually created.
   */
  async emitMany(
    userIds: readonly string[],
    input: Omit<EmitNotificationInput, 'userId'>,
  ): Promise<number> {
    // De-duplicate: a user who is both organiser and attendee should get one
    // invitation, not two.
    const unique = [...new Set(userIds.filter(Boolean))]
    const results = await Promise.all(
      unique.map((userId) => this.emit({ ...input, userId })),
    )
    return results.filter(Boolean).length
  }

  // ── Reading (first-person only) ──────────────────────────────────────────

  async findMine(
    actor: { userId: string; tenantId: string },
    query: ListNotificationsQueryDto = {},
  ) {
    const limit = query.limit ?? 30
    const offset = query.offset ?? 0

    const where = {
      ...this.ownScope(actor),
      ...(query.unreadOnly === undefined ? {} : { isRead: !query.unreadOnly }),
      ...(query.type ? { type: query.type } : {}),
    }

    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: PUBLIC_FIELDS,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...this.ownScope(actor), isRead: false } }),
    ])

    return { items, total, unreadCount, limit, offset }
  }

  /**
   * Unread badge count. Separate from `findMine` because the bell polls this
   * far more often than it opens the list, and it must stay a single indexed
   * COUNT rather than dragging bodies across the wire.
   */
  async unreadCount(actor: { userId: string; tenantId: string }): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { ...this.ownScope(actor), isRead: false },
    })
    return { count }
  }

  // ── Mutation ─────────────────────────────────────────────────────────────

  /**
   * Marks one notification read (or unread).
   *
   * Note the shape: a scoped `updateMany`, then a scoped read-back. Not
   * `findUnique` + `update`. With `updateMany` the tenant/user filter is part
   * of the UPDATE statement itself, so there is no window in which the row was
   * found under one scope and written under another, and a row belonging to
   * anyone else simply matches nothing — which surfaces as 404, never 403,
   * matching the convention used everywhere else here (a caller must not be
   * able to distinguish "exists but not yours" from "does not exist").
   */
  async setRead(
    actor: { userId: string; tenantId: string },
    id: string,
    isRead: boolean,
  ) {
    const result = await this.prisma.notification.updateMany({
      where: { id, ...this.ownScope(actor) },
      data: { isRead, readAt: isRead ? new Date() : null },
    })
    if (result.count === 0) throw DomainError.notFound('NOTIFICATION_NOT_FOUND', 'ההתראה לא נמצאה')

    return this.prisma.notification.findFirst({
      where: { id, ...this.ownScope(actor) },
      select: PUBLIC_FIELDS,
    })
  }

  /**
   * Marks every unread notification read.
   *
   * Not audited, by decision: it is a first-person, non-destructive UI gesture
   * performed constantly, and writing an audit row per bell-clear would bury
   * the consequential entries (ownership edits, signature events) that the
   * audit log exists for. The row's own `readAt` is the record that it
   * happened.
   */
  async markAllRead(actor: { userId: string; tenantId: string }): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { ...this.ownScope(actor), isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return { updated: result.count }
  }

  /** Deletes one of the caller's own notifications. 404 for anyone else's. */
  async remove(actor: AuditActor, id: string): Promise<{ id: string }> {
    const result = await this.prisma.notification.deleteMany({
      where: { id, userId: actor.userId, tenantId: actor.tenantId },
    })
    if (result.count === 0) throw DomainError.notFound('NOTIFICATION_NOT_FOUND', 'ההתראה לא נמצאה')
    return { id }
  }

  /**
   * Creates a notification on behalf of an authenticated actor (the
   * `POST /notifications` endpoint).
   *
   * Unlike `emit`, this one THROWS — it is serving a request whose entire
   * purpose is the notification, so a failure is a failure. A recipient outside
   * the actor's tenant is a 404, not a 403: answering "that user exists but is
   * not yours" would make the endpoint a cross-tenant user-id oracle.
   *
   * Audited, because one user addressing another is a directed act, unlike the
   * automated emissions above which are already implied by the audited event
   * that caused them.
   */
  async createAsActor(actor: AuditActor, dto: CreateNotificationDto) {
    const recipient = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId: actor.tenantId },
      select: { id: true },
    })
    if (!recipient) throw DomainError.notFound('NOTIFICATION_RECIPIENT_NOT_FOUND', 'המשתמש לא נמצא')

    if (!isNotificationKind(dto.type)) {
      throw DomainError.validation('NOTIFICATION_KIND_INVALID', 'סוג ההתראה אינו מוכר')
    }

    const created = await this.prisma.notification.create({
      data: {
        tenantId:   actor.tenantId,
        userId:     dto.userId,
        type:       dto.type,
        title:      dto.title,
        body:       dto.body,
        link:       this.safeLink(dto.link),
        entityType: dto.entityType ?? null,
        entityId:   dto.entityId ?? null,
        metadata:   (dto.metadata ?? undefined) as never,
      },
      select: PUBLIC_FIELDS,
    })

    await this.audit.record(actor, {
      action: 'CREATE',
      entity: 'Notification',
      entityId: created.id,
      // The title and body are NOT recorded: they are free text that may quote
      // resident details, and the audit log is exported.
      metadata: { type: created.type, recipientId: dto.userId },
    })

    return created
  }
}
