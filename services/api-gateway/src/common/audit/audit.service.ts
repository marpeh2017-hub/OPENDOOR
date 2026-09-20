import { Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma.service'

/** The actor behind a mutation, assembled once per request by the controller. */
export interface AuditActor {
  /** `JwtStrategy.validate()` returns `userId`. NEVER `sub`. */
  userId: string
  tenantId: string
  role?: string
  ip?: string | null
  userAgent?: string | null
}

export type AuditActionName =
  | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'DOWNLOAD'
  | 'SIGN' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'IMPERSONATE'

export interface AuditEntry {
  action: AuditActionName
  /** Model name, e.g. `Project`, `Apartment`, `OwnerApartment`, `User`. */
  entity: string
  entityId?: string | null
  changes?: { before?: unknown; after?: unknown } | null
  metadata?: Record<string, unknown> | null
}

/**
 * Field names whose VALUES must never reach an audit row.
 *
 * Audit rows are read back by the dashboard activity feed and exported, so a
 * national ID or a password hash landing in `changes` would be a leak with a
 * long tail. Matching is case-insensitive and substring-based so
 * `nationalId`, `national_id`, `ownerNationalId` and `passwordHash` are all
 * caught. Redacted values become the marker below — the fact that a field
 * CHANGED is still auditable, its content is not.
 */
const REDACTED_FIELDS = [
  'nationalid', 'national_id', 'passwordhash', 'password', 'mfasecret',
  'token', 'refreshtoken', 'accesstoken', 'secret', 'apikey', 'privatekey',
  'otp', 'bankaccount', 'iban', 'creditcard', 'storagekey', 'signedurl',
]

const REDACTION_MARKER = '[redacted]'

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z]/g, '')
  return REDACTED_FIELDS.some((f) => k.includes(f.replace(/[^a-z]/g, '')))
}

/**
 * Deep-clones a value, replacing sensitive fields with a marker and dropping
 * anything not JSON-representable. Depth-capped so a cyclic or pathological
 * payload cannot hang the request.
 */
export function redactForAudit(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTION_MARKER
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((v) => redactForAudit(v, depth + 1))
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTION_MARKER : redactForAudit(v, depth + 1)
    }
    return out
  }
  if (typeof value === 'function' || typeof value === 'symbol') return undefined
  return value
}

/**
 * The single audit trail. There is exactly one `AuditLog` table and this is the
 * only writer for domain mutations — do not add a second trail.
 *
 * Every method accepts an optional transaction client so an audit row commits
 * or rolls back atomically with the change it describes.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private readonly prisma: PrismaService) {}

  async record(
    actor: AuditActor,
    entry: AuditEntry,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma
    try {
      await client.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          action: entry.action as never,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          changes: (entry.changes ? redactForAudit(entry.changes) : null) as never,
          metadata: (entry.metadata ? redactForAudit(entry.metadata) : null) as never,
          ipAddress: actor.ip ?? null,
          userAgent: actor.userAgent ?? null,
        },
      })
    } catch (err) {
      // Inside a transaction the caller must see the failure (the audit row is
      // part of the unit of work). Outside one, a broken audit write must not
      // mask a successful mutation — log without any payload detail.
      if (tx) throw err
      this.logger.error(
        `Audit write failed for ${entry.entity}/${entry.entityId ?? '-'} (${entry.action})`,
      )
    }
  }

  /**
   * Audit an action taken by NOBODY — a genuinely unauthenticated request.
   *
   * Currently only the public marketing lead form, which by definition has no
   * user. Kept as a separate, explicitly-named method rather than by widening
   * `AuditActor.userId` to `string | null`: every authenticated caller must
   * keep failing to compile if it loses its actor, and an anonymous audit row
   * should be something a reviewer can grep for. `AuditLog.userId` is a
   * foreign key, so `null` is the only honest value here — a placeholder id
   * would violate the constraint, and a borrowed one would be a lie.
   */
  async recordAnonymous(
    tenantId: string,
    context: { ip?: string | null; userAgent?: string | null },
    entry: AuditEntry,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma
    try {
      await client.auditLog.create({
        data: {
          tenantId,
          userId: null,
          action: entry.action as never,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          changes: (entry.changes ? redactForAudit(entry.changes) : null) as never,
          metadata: (entry.metadata ? redactForAudit(entry.metadata) : null) as never,
          ipAddress: context.ip ?? null,
          userAgent: context.userAgent ?? null,
        },
      })
    } catch (err) {
      if (tx) throw err
      this.logger.error(
        `Anonymous audit write failed for ${entry.entity}/${entry.entityId ?? '-'} (${entry.action})`,
      )
    }
  }

  /** Batch variant — one `createMany` for bulk operations, no per-row round trip. */
  async recordMany(
    actor: AuditActor,
    entries: AuditEntry[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (entries.length === 0) return
    const client = tx ?? this.prisma
    await client.auditLog.createMany({
      data: entries.map((entry) => ({
        tenantId: actor.tenantId,
        userId: actor.userId,
        action: entry.action as never,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        changes: (entry.changes ? redactForAudit(entry.changes) : null) as never,
        metadata: (entry.metadata ? redactForAudit(entry.metadata) : null) as never,
        ipAddress: actor.ip ?? null,
        userAgent: actor.userAgent ?? null,
      })),
    })
  }

  /**
   * Builds a `{ before, after }` diff containing ONLY the keys that actually
   * changed, so audit rows stay small and reviewable.
   */
  static diff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
    const b: Record<string, unknown> = {}
    const a: Record<string, unknown> = {}
    for (const key of Object.keys(after)) {
      const bv = before[key]
      const av = after[key]
      const same = bv instanceof Date && av instanceof Date
        ? bv.getTime() === av.getTime()
        : JSON.stringify(bv ?? null) === JSON.stringify(av ?? null)
      if (same) continue
      b[key] = bv ?? null
      a[key] = av ?? null
    }
    return Object.keys(a).length ? { before: b, after: a } : null
  }
}
