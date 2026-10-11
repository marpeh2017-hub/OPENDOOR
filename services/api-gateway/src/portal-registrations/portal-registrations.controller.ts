import { Body, Controller, Get, HttpCode, Param, Post, Query, Request } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { RESIDENT_INVITE_ROLES, STAFF_ROLES } from '../auth/roles.constants'
import { actorFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'
import { PortalRegistrationsService } from './portal-registrations.service'
import { ApproveRegistrationDto, ListRegistrationsDto, RejectRegistrationDto } from './dto/portal-registration.dto'

/**
 * Registration requests for staff: every staff role sees them; deciding is
 * for the roles that already issue personal-area links.
 */
@ApiTags('portal')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller({ path: 'portal-registrations', version: '1' })
export class PortalRegistrationsController {
  constructor(private readonly registrations: PortalRegistrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Registration requests, newest first' })
  list(@Query() query: ListRegistrationsDto, @Request() req: any) {
    return this.registrations.list(req.user.tenantId, query.status)
  }

  @Get(':id')
  @ApiOperation({ summary: 'One request, with the matched building’s apartments and residents' })
  get(@Param('id') id: string, @Request() req: any) {
    return this.registrations.get(id, req.user.tenantId)
  }

  @Post(':id/approve')
  @Roles(...RESIDENT_INVITE_ROLES)
  @HttpCode(200)
  @ApiOperation({ summary: 'Put the person on a resident file, so they can sign in' })
  approve(@Param('id') id: string, @Body() dto: ApproveRegistrationDto, @Request() req: any) {
    return mapDomainErrors(() => this.registrations.approve(id, dto, actorFrom(req)))
  }

  @Post(':id/reject')
  @Roles(...RESIDENT_INVITE_ROLES)
  @HttpCode(200)
  @ApiOperation({ summary: 'Decline the request' })
  reject(@Param('id') id: string, @Body() dto: RejectRegistrationDto, @Request() req: any) {
    return this.registrations.reject(id, dto.note, actorFrom(req))
  }
}
