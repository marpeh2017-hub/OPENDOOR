import { Inject, Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { REDIS } from '../redis/redis.module'
import { ResidentIdentityService } from './resident-identity.service'

/**
 * "Is a resident signed in to the portal right now?" — asked from a PUBLIC route.
 *
 * ── WHY THIS EXISTS SEPARATELY FROM THE GUARD ───────────────────────────────
 *
 * Signing a document and answering a meeting invitation both happen through a
 * tokenised link that anybody holding the link can open. Those routes are
 * `@Public()`, so `JwtAuthGuard` never runs and `req.user` is never populated —
 * which is correct, because requiring a session would break the flow for every
 * resident who simply clicks the link in their SMS.
 *
 * But a resident who IS signed in when they click gains something: the action
 * can be attributed to an authenticated identity as well as to the bearer of a
 * link. That is a materially stronger record, and it costs the resident nothing.
 *
 * ── THE ONE RULE THIS SERVICE FOLLOWS ───────────────────────────────────────
 *
 * IT NEVER THROWS. A missing header, a malformed token, an expired one, a
 * revoked session, a token for a resident who has since been archived — every
 * one of them returns `null`, and the caller carries on down the token path
 * exactly as it does today.
 *
 * That is not defensive habit, it is the requirement: the token flow must be
 * unchanged for everyone who is not signed in, and an exception thrown while
 * OPTIONALLY looking for extra provenance would turn a nice-to-have into a way
 * to break signing for people holding a valid link.
 */

export interface PortalSessionAttribution {
  residentId: string
  tenantId: string
  projectId: string
  residentName: string
  sessionId: string
}

@Injectable()
export class PortalSessionProbe {
  private readonly logger = new Logger(PortalSessionProbe.name)

  constructor(
    private readonly jwt: JwtService,
    private readonly identity: ResidentIdentityService,
    @Inject(REDIS) private readonly redis: any,
  ) {}

  /**
   * Resolves the resident session behind an `Authorization` header, if there is
   * one and it is genuinely valid.
   *
   * The scope is re-derived from the database rather than trusted from the
   * claims — the same rule `PortalScopeService` follows for authenticated
   * routes. A token whose claims no longer match where the resident lives
   * attributes nothing, because a stale claim is not evidence.
   */
  async probe(authorizationHeader?: string | null): Promise<PortalSessionAttribution | null> {
    try {
      const raw = extractBearer(authorizationHeader)
      if (!raw) return null

      const payload = this.jwt.verify<{
        sub?: string; role?: string; tenantId?: string
        projectId?: string; residentId?: string; sessionId?: string
      }>(raw, { secret: process.env.JWT_SECRET as string })

      if (payload.role !== 'RESIDENT') return null
      if (!payload.residentId || !payload.tenantId || !payload.projectId || !payload.sessionId) {
        return null
      }

      // Logout revokes the session; a revoked one attributes nothing.
      if (await this.redis.exists(`jwt:revoked:${payload.sessionId}`)) return null

      const context = await this.identity.contextForResident(payload.residentId)
      if (!context) return null
      if (context.tenantId !== payload.tenantId || context.projectId !== payload.projectId) {
        // The resident moved since the token was issued. Recording an
        // attribution from a session that no longer describes reality would put
        // a false statement into an evidence package.
        this.logger.warn(
          `Portal session for resident ${payload.residentId} no longer matches its claims — not attributing.`,
        )
        return null
      }

      return {
        residentId: context.residentId,
        tenantId: context.tenantId,
        projectId: context.projectId,
        residentName: context.residentName,
        sessionId: payload.sessionId,
      }
    } catch {
      // Expired, malformed, wrong signature, Redis unreachable — all the same
      // answer. See the class comment: this must never break the token path.
      return null
    }
  }
}

/** `Authorization: Bearer <token>` → the token, or null for anything else. */
function extractBearer(header?: string | null): string | null {
  if (!header) return null
  const [scheme, value] = header.split(' ')
  if (!value || scheme?.toLowerCase() !== 'bearer') return null
  return value.trim() || null
}
