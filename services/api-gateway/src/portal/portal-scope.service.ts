import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ResidentIdentityService } from '../auth/resident-identity.service'
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator'

/**
 * The one place a portal request learns what it is allowed to see.
 *
 * ── WHY THIS IS A SERVICE AND NOT THREE LINES IN A CONTROLLER ───────────────
 *
 * Every resident-facing endpoint asks the same question — "whose data is this
 * request entitled to?" — and gets it wrong in the same way: by reading an id
 * out of the request. A `projectId` in a query string, a `residentId` in a
 * path, an apartment id in a body. Each one looks harmless in isolation and
 * each one is an IDOR.
 *
 * So the answer comes from HERE, derived from the authenticated session and
 * nothing else, and every portal service takes a `PortalScope` rather than a
 * request. A route that wants to scope a query has to hold one of these, and
 * the only way to get one is to have been authenticated as that resident.
 *
 * ── WHY THE SESSION IS RE-CHECKED AGAINST THE DATABASE ──────────────────────
 *
 * The access token is valid for 12 hours and the refresh token for 30 days.
 * That is a long time in which a resident can be archived, or moved to another
 * apartment — possibly in another project. The claims would still be perfectly
 * valid, correctly signed, and describing a world that no longer exists.
 *
 * When the token and the database disagree, this refuses. It deliberately does
 * NOT quietly adopt the new placement: a session was issued for one scope, and
 * silently widening it to another — even a legitimate one — is how a session
 * ends up somewhere nobody decided it should be. The resident signs in again
 * and gets a session that says what is true now.
 */

/** What one authenticated resident may see. Nothing here came from the request body. */
export interface PortalScope {
  tenantId: string
  projectId: string
  buildingId: string
  apartmentId: string
  residentId: string
  residentName: string
  residentFirstName: string
  projectName: string
  buildingAddress: string
  apartmentNumber: string
}

@Injectable()
export class PortalScopeService {
  private readonly logger = new Logger(PortalScopeService.name)

  constructor(private readonly identity: ResidentIdentityService) {}

  async resolve(user: CurrentUserPayload | undefined): Promise<PortalScope> {
    /*
     * Belt and braces. `JwtStrategy` already rejects a RESIDENT token without
     * these claims, and `RolesGuard` already rejects a non-resident on these
     * routes. Both are checked again because the cost is three comparisons and
     * the failure mode is serving one resident another resident's file.
     */
    if (!user || user.role !== 'RESIDENT' || !user.residentId || !user.projectId || !user.tenantId) {
      throw new UnauthorizedException({
        code: 'PORTAL_SESSION_INVALID',
        message: 'ההתחברות אינה תקפה. יש להתחבר מחדש.',
      })
    }

    const context = await this.identity.contextForResident(user.residentId)
    if (!context) {
      // Archived, or deleted, since the token was issued.
      throw new UnauthorizedException({
        code: 'RESIDENT_NOT_FOUND',
        message: 'הפרופיל אינו זמין עוד. יש להתחבר מחדש.',
      })
    }

    if (context.tenantId !== user.tenantId || context.projectId !== user.projectId) {
      this.logger.warn(
        `Portal session for resident ${user.residentId} claims tenant ${user.tenantId}/project ` +
        `${user.projectId} but the resident is now in ${context.tenantId}/${context.projectId} — refusing.`,
      )
      throw new UnauthorizedException({
        code: 'PORTAL_SCOPE_CHANGED',
        message: 'פרטי הדירה השתנו מאז ההתחברות. יש להתחבר מחדש.',
      })
    }

    return {
      tenantId: context.tenantId,
      projectId: context.projectId,
      buildingId: context.buildingId,
      apartmentId: context.apartmentId,
      residentId: context.residentId,
      residentName: context.residentName,
      residentFirstName: context.residentName.split(' ')[0] ?? context.residentName,
      projectName: context.projectName,
      buildingAddress: context.buildingAddress,
      apartmentNumber: context.apartmentNumber,
    }
  }
}
