import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Request,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES, MANAGER_ROLES, ADMIN_ROLES } from '../auth/roles.constants'
import { actorFrom, tenantFrom } from '../common/actor'
import { AutomationsService } from './automations.service'
import { CreateAutomationDto, UpdateAutomationDto, SetDryRunDto } from './dto/automation.dto'
import {
  AUTOMATION_TRIGGERS, AUTOMATION_ACTION_TYPES,
  ENABLED_ACTION_TYPES, DISABLED_ACTION_REASONS,
} from './automation-catalog'

/**
 * Automations API.
 *
 * WRITE IS `MANAGER_ROLES`, deliberately narrower than most write surfaces in
 * this codebase. An automation is a standing instruction that fires unattended
 * and repeatedly; arming one is closer to changing a project's configuration
 * than to creating a record inside it.
 */
@ApiTags('automations')
@ApiBearerAuth()
@Controller({ path: 'automations', version: '1' })
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  /**
   * The catalogue, so the CRM can build its editor from the server's truth
   * rather than a hardcoded copy that drifts. Reports which action types are
   * executable and why the others are not.
   */
  @Get('catalog')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Available triggers and action types' })
  catalog() {
    return {
      triggers: AUTOMATION_TRIGGERS,
      actionTypes: AUTOMATION_ACTION_TYPES.map((type) => ({
        type,
        enabled: (ENABLED_ACTION_TYPES as readonly string[]).includes(type),
        disabledReason: DISABLED_ACTION_REASONS[type] ?? null,
      })),
    }
  }

  /**
   * "What is armed right now, and will it actually send?"
   *
   * The read-only operational view. Deliberately a separate, narrow endpoint
   * rather than a filter on the list: before trusting an unattended system,
   * the question people actually need answered is which automations can fire
   * and which of those will reach a real person.
   */
  @Get('armed')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Active automations, showing which will really send' })
  armed(@Request() req: any) {
    return this.automations.armed(tenantFrom(req))
  }

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List automations for the tenant' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @Request() req: any,
    @Query('projectId') projectId?: string,
    // Parsed by hand: `enableImplicitConversion` turns the string 'false' into
    // boolean true, which has already inverted a query filter here once.
    @Query('isActive') isActive?: string,
  ) {
    return this.automations.findAll(tenantFrom(req), {
      projectId,
      isActive:
        isActive === undefined ? undefined
        : isActive === 'true'  ? true
        : isActive === 'false' ? false
        : undefined,
    })
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'One automation with its actions (404 across tenants)' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.automations.findOne(tenantFrom(req), id)
  }

  @Post()
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Create an automation (inactive unless isActive is set)' })
  create(@Request() req: any, @Body() dto: CreateAutomationDto) {
    return this.automations.create(actorFrom(req), dto)
  }

  @Patch(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Update an automation; supplying `actions` replaces the whole list' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAutomationDto) {
    return this.automations.update(actorFrom(req), id, dto)
  }

  /**
   * Take an outbound automation live, or put it back into dry run.
   *
   * ADMIN ONLY and separate from PATCH: this is the moment real residents start
   * receiving real messages, and it is the manual confirmation step that
   * activation deliberately does not perform on its own.
   */
  @Patch(':id/dry-run')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Take an outbound automation live (dryRun:false) or back to dry run' })
  setDryRun(@Request() req: any, @Param('id') id: string, @Body() dto: SetDryRunDto) {
    return this.automations.setDryRun(actorFrom(req), id, dto.dryRun)
  }

  @Delete(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Delete an automation and its actions' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.automations.remove(actorFrom(req), id)
  }
}
