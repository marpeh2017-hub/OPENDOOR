import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { MessagingConfig } from '../messaging/messaging.config'

export interface RetentionSweepResult {
  tenantsScanned: number
  deleted: number
  /** Per-tenant breakdown, for the log and for tests. */
  perTenant: { tenantId: string; retentionDays: number; deleted: number }[]
}

/**
 * ════════════════════════════════════════════════════════════════════════
 * NOTIFICATION RETENTION POLICY
 * ════════════════════════════════════════════════════════════════════════
 *
 * WHAT IS DELETED
 *   A `Notification` row is eligible when ALL of the following hold:
 *     1. `isRead = true`  — the user has seen it;
 *     2. `readAt` is older than the tenant's retention window;
 *     3. `createdAt` is also older than that window (belt and braces: a row
 *        with a bad `readAt` backfill cannot be aged out prematurely).
 *
 * WHAT IS NEVER DELETED — and this is the important half
 *   • UNREAD notifications, at ANY age. An unread notification is outstanding
 *     work. Ageing it out silently removes the only trace that someone was
 *     told something, which is precisely the trace that matters when a
 *     resident-relations dispute asks "was the manager notified?".
 *   • `AuditLog` rows. Untouched by anything here. The audit trail is the
 *     compliance record and has its own (currently unbounded) lifecycle.
 *   • Signature evidence — `SignaturePackage`, `SignatureRecord`,
 *     `SignatureEvent`, `SigningSession`, evidence PDFs in object storage.
 *     None of it is a `Notification` and none of it is reachable from this
 *     service. A pinuy-binuy signature is a legally consequential act; its
 *     evidence chain outlives every convenience record in the system.
 *   • `Message` rows (the communications log). Also out of scope: a message to
 *     a resident is a record of what the developer told them, which is
 *     evidentiary in a way an in-app bell notification is not. If message
 *     retention is ever wanted it needs its own policy and its own product
 *     decision — see the report.
 *
 * HOW LONG
 *   `Tenant.notificationRetentionDays` when set, otherwise
 *   `NOTIFICATION_RETENTION_DAYS` (default 180). An explicit column rather than
 *   a key in the `settings` JSON blob, because a value that governs DELETION
 *   should not live somewhere unvalidated. Values are clamped to [7, 3650]:
 *   a tenant cannot configure a same-day purge that would destroy this week's
 *   notifications, nor an effectively infinite window that quietly disables the
 *   policy.
 *
 * TENANT SAFETY
 *   The sweep iterates tenants and issues one `deleteMany` per tenant with
 *   `tenantId` in the WHERE clause. There is no global delete anywhere in this
 *   file. A bug in the date arithmetic can therefore over-delete within one
 *   tenant; it cannot cross a tenant boundary.
 *
 * AUDITABILITY
 *   One `AuditLog` row per tenant per sweep that actually deleted something,
 *   recording the cutoff and the count — not one row per deleted notification,
 *   which would replace the notification table with an equally large audit
 *   table and bury the consequential entries the audit log exists for.
 *
 * BATCHING
 *   Capped at `NOTIFICATION_RETENTION_BATCH_SIZE` rows per tenant per sweep, so
 *   the first run against a tenant with a two-year backlog drains gradually
 *   instead of taking a long lock and stalling the API.
 */
@Injectable()
export class NotificationRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationRetentionService.name)
  private timer: NodeJS.Timeout | null = null
  private stopped = false
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    if (!MessagingConfig.notificationRetentionEnabled) {
      this.logger.log('Notification retention sweep disabled (NOTIFICATION_RETENTION_ENABLED)')
      return
    }
    this.logger.log(
      `Notification retention active — default ${MessagingConfig.notificationRetentionDays} days, ` +
      `sweeping every ${Math.round(MessagingConfig.notificationRetentionIntervalMs / 3600_000)}h`,
    )
    // Deliberately not at t=0: a deploy loop must not run a delete sweep on
    // every restart. First sweep is one interval after boot.
    this.schedule(MessagingConfig.notificationRetentionIntervalMs)
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
      const r = await this.sweep()
      if (r.deleted > 0) {
        this.logger.log(
          `retention sweep: ${r.deleted} read notification(s) removed across ` +
          `${r.perTenant.length} tenant(s)`,
        )
      }
    } catch (err) {
      this.logger.error(`Retention sweep failed: ${(err as Error).message}`)
    } finally {
      this.running = false
      this.schedule(MessagingConfig.notificationRetentionIntervalMs)
    }
  }

  /** Effective window for a tenant, clamped. */
  retentionDaysFor(configured: number | null | undefined): number {
    const days = configured ?? MessagingConfig.notificationRetentionDays
    return Math.min(3650, Math.max(7, Math.trunc(days)))
  }

  /**
   * One sweep. Public so tests drive it deterministically rather than waiting
   * six hours for a timer.
   *
   * `now` is injectable for the same reason: a test can assert that a
   * three-day-old read notification survives a 180-day policy without having to
   * fabricate a row dated last year.
   */
  async sweep(options?: { now?: Date; tenantId?: string }): Promise<RetentionSweepResult> {
    const now = options?.now ?? new Date()
    const result: RetentionSweepResult = { tenantsScanned: 0, deleted: 0, perTenant: [] }

    const tenants = await this.prisma.tenant.findMany({
      where: options?.tenantId ? { id: options.tenantId } : {},
      select: { id: true, notificationRetentionDays: true },
    })

    for (const tenant of tenants) {
      result.tenantsScanned += 1
      const retentionDays = this.retentionDaysFor(tenant.notificationRetentionDays)
      const cutoff = new Date(now.getTime() - retentionDays * 86_400_000)

      try {
        /*
         * Two-step: select the ids, then delete by id. A single `deleteMany`
         * cannot be limited, so on a tenant with a large backlog it would take
         * one enormous transaction. Selecting a bounded page of ids first keeps
         * every statement small and interruptible.
         */
        const doomed = await this.prisma.notification.findMany({
          where: {
            tenantId: tenant.id,
            // UNREAD IS NEVER TOUCHED. See the class comment.
            isRead: true,
            readAt: { not: null, lt: cutoff },
            createdAt: { lt: cutoff },
          },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
          take: MessagingConfig.notificationRetentionBatchSize,
        })

        if (doomed.length === 0) continue

        const deleted = await this.prisma.notification.deleteMany({
          // `tenantId` repeated in the delete, not just in the select above:
          // the tenant scope is asserted on the statement that actually
          // destroys data, not only on the one that chose the ids.
          where: { id: { in: doomed.map((d) => d.id) }, tenantId: tenant.id, isRead: true },
        })

        result.deleted += deleted.count
        result.perTenant.push({ tenantId: tenant.id, retentionDays, deleted: deleted.count })

        // System actor: there is no human behind a scheduled sweep, and
        // attributing the deletion to one would be a false audit record.
        // `AuditLog.userId` is nullable precisely for this case.
        const systemActor = {
          userId: null, tenantId: tenant.id, role: 'SYSTEM',
        } as unknown as AuditActor

        await this.audit.record(systemActor, {
          action: 'DELETE',
          entity: 'Notification',
          entityId: null,
          metadata: {
            policy: 'notification-retention',
            retentionDays,
            cutoff: cutoff.toISOString(),
            deleted: deleted.count,
            scope: 'read notifications only; audit and signature records untouched',
          },
        })
      } catch (err) {
        // One tenant's failure must not abort the sweep for the others.
        this.logger.error(
          `Retention sweep failed for tenant ${tenant.id}: ${(err as Error).message}`,
        )
      }
    }

    return result
  }
}
