import { UnauthorizedException } from '@nestjs/common'
import type { AuditActor } from './audit/audit.service'

/**
 * Builds the `AuditActor` for a request.
 *
 * `JwtStrategy.validate()` returns `userId` — reading `req.user.sub` yields
 * `undefined` and silently writes anonymous audit rows. That bug has already
 * been fixed in 11 places; this helper exists so it cannot come back.
 *
 * ── WHY A RESIDENT SESSION IS REFUSED OUTRIGHT ──────────────────────────────
 *
 * On a resident-portal token `userId` is the RESIDENT id, because `sub` is the
 * resident. `AuditLog.userId` is a foreign key to `User`, and a resident has no
 * user row — so the insert fails, and `AuditService.record` catches and logs
 * that failure rather than rethrowing. The result is an action that happened
 * with NO audit row and nothing but a log line to say so.
 *
 * That is the worst possible outcome for an audit trail: not an error anyone
 * notices, just a silently missing record. Resident-initiated actions must use
 * `AuditService.recordAnonymous`, which writes `userId: null` and carries the
 * resident id in metadata. Throwing here makes the wrong call a loud failure at
 * the call site instead of a hole discovered months later.
 */
export function actorFrom(req: any): AuditActor {
  const tenantId = req?.user?.tenantId
  const userId = req?.user?.userId
  if (!tenantId) throw new UnauthorizedException('Missing tenant context')
  if (!userId) throw new UnauthorizedException('Missing user context')
  if (req?.user?.role === 'RESIDENT') {
    throw new Error(
      'actorFrom() was called on a resident-portal session. `AuditLog.userId` is a ' +
      'User foreign key and a resident has none, so this row would be silently ' +
      'dropped. Use AuditService.recordAnonymous() for resident-initiated actions.',
    )
  }
  return {
    userId,
    tenantId,
    role: req.user.role,
    ip: req.ip ?? req.headers?.['x-forwarded-for'] ?? null,
    userAgent: req.headers?.['user-agent'] ?? null,
  }
}

/** Tenant id only, for read endpoints that do not audit. */
export function tenantFrom(req: any): string {
  const tenantId = req?.user?.tenantId
  if (!tenantId) throw new UnauthorizedException('Missing tenant context')
  return tenantId
}
