import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { FEASIBILITY_EDIT_ROLES, FEASIBILITY_VIEW_ROLES } from '../auth/roles.constants'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'
import {
  CreateFeasibilityRuleDto, RetireFeasibilityRuleDto, UpdateFeasibilityRuleDto,
} from './dto/feasibility-rules.dto'
import { FeasibilityRulesService } from './feasibility-rules.service'

/**
 * The registry is TENANT-level, not project-level: one set of rules serves every
 * project, which is the point — a per-project copy of the VAT rate is exactly
 * the drift this replaces.
 *
 * It sits on its own controller rather than inside `FeasibilityController`
 * because that one is mounted at `projects/:projectId/feasibility` and these
 * routes have no project. The per-project view of the registry — how one study
 * deviates from it — lives here too, as an explicit `:profileId` route.
 */
@ApiTags('feasibility')
@ApiBearerAuth()
@Roles(...FEASIBILITY_VIEW_ROLES)
@Controller({ path: 'feasibility/rules', version: '1' })
export class FeasibilityRulesController {
  constructor(private readonly rules: FeasibilityRulesService) {}

  @Get()
  @ApiOperation({ summary: 'List the regulatory rules registry' })
  list(
    @Request() req: any,
    @Query('code') code?: string,
    @Query('jurisdiction') jurisdiction?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('verification') verification?: 'VERIFIED_AGAINST_SOURCE' | 'NEEDS_VERIFICATION' | 'DISPUTED',
  ) {
    return mapDomainErrors(() => this.rules.list(tenantFrom(req), {
      code, jurisdiction, includeInactive: includeInactive === 'true', verification,
    }))
  }

  /**
   * Which version of a rule applied on a given date.
   *
   * Exposed on its own because it is the question an appraiser actually asks,
   * and because answering it from the list endpoint means re-implementing the
   * window and specificity logic in the client — where it would drift.
   */
  @Get('resolve')
  @ApiOperation({ summary: 'Resolve the rule in force for a code on a date' })
  resolve(
    @Request() req: any,
    @Query('code') code: string,
    @Query('onDate') onDate: string,
    @Query('jurisdiction') jurisdiction?: string,
  ) {
    return mapDomainErrors(() =>
      this.rules.resolve(tenantFrom(req), code, new Date(onDate), jurisdiction ?? null),
    )
  }

  @Get('deviations/:profileId')
  @ApiOperation({ summary: 'How one study deviates from the registry on its determining date' })
  deviations(@Param('profileId') profileId: string, @Request() req: any) {
    return mapDomainErrors(() => this.rules.deviationsForProfile(profileId, tenantFrom(req)))
  }

  @Post()
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Add a rule version to the registry' })
  create(@Body() dto: CreateFeasibilityRuleDto, @Request() req: any) {
    return mapDomainErrors(() => this.rules.create(tenantFrom(req), dto as any, actorFrom(req)))
  }

  @Patch(':id')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Correct a rule version' })
  update(@Param('id') id: string, @Body() dto: UpdateFeasibilityRuleDto, @Request() req: any) {
    return mapDomainErrors(() => this.rules.update(id, tenantFrom(req), dto as any, actorFrom(req)))
  }

  /**
   * There is no DELETE. A signed report cites the rule version it used, so the
   * row has to survive; closing its window is the supported way to stop it
   * applying to anything new.
   */
  @Patch(':id/retire')
  @Roles(...FEASIBILITY_EDIT_ROLES)
  @ApiOperation({ summary: 'Close a rule version — rules are retired, never deleted' })
  retire(@Param('id') id: string, @Body() dto: RetireFeasibilityRuleDto, @Request() req: any) {
    return mapDomainErrors(() =>
      this.rules.retire(id, tenantFrom(req), new Date(dto.effectiveUntil), actorFrom(req)),
    )
  }
}
