import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { PortalDashboardService } from './portal-dashboard.service'
import { PortalScopeService } from './portal-scope.service'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator'

/**
 * The resident-facing API.
 *
 * ── WHY THERE ARE NO PATH OR QUERY PARAMETERS ───────────────────────────────
 *
 * Not an oversight, and not a simplification to be undone when the next
 * endpoint needs "just one id". A resident-facing route that accepts an id
 * accepts it from the resident, and then has to prove — on every code path,
 * forever — that the id belongs to them. The proof is easy to write and easy
 * to forget, and forgetting it once is an IDOR.
 *
 * These routes take nothing. `PortalScopeService` derives the whole scope from
 * the authenticated session, so there is no parameter to check and none to
 * tamper with. Later portal endpoints that genuinely need to name a resource —
 * one document out of several — should scope the lookup by the session's ids
 * rather than validating the caller's, so an id that is not theirs is a 404
 * rather than a permission decision.
 */
@ApiTags('portal')
@ApiBearerAuth()
@Controller({ path: 'portal', version: '1' })
@Roles('RESIDENT')
export class PortalDashboardController {
  constructor(
    private readonly dashboard: PortalDashboardService,
    private readonly scopes: PortalScopeService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: "The signed-in resident's dashboard" })
  @ApiResponse({
    status: 401,
    description:
      'The session no longer matches the database — the resident was archived ' +
      'or moved since it was issued. The answer is a new session, not a new scope.',
  })
  @ApiResponse({ status: 403, description: 'A staff token. This is not a staff route.' })
  async get(@CurrentUser() user: CurrentUserPayload) {
    const scope = await this.scopes.resolve(user)
    return this.dashboard.build(scope)
  }
}
