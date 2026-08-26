import { UnauthorizedException } from '@nestjs/common'
import type { AuditActor } from './audit/audit.service'

/**
 * Builds the `AuditActor` for a request.
 *
 * `JwtStrategy.validate()` returns `userId` — reading `req.user.sub` yields
 * `undefined` and silently writes anonymous audit rows. That bug has already
 * been fixed in 11 places; this helper exists so it cannot come back.
 */
export function actorFrom(req: any): AuditActor {
  const tenantId = req?.user?.tenantId
  const userId = req?.user?.userId
  if (!tenantId) throw new UnauthorizedException('Missing tenant context')
  if (!userId) throw new UnauthorizedException('Missing user context')
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
