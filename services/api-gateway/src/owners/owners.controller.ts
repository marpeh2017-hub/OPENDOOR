import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Request,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES, MANAGER_ROLES } from '../auth/roles.constants'
import { OwnersService } from './owners.service'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'
import {
  CreateOwnerDto, UpdateOwnerDto, SetOwnerActiveDto, SetOwnerShareDto, BulkAssignOwnerDto,
} from './dto/owner.dto'

/**
 * Owners (registered title holders) — distinct from Residents.
 *
 * No response from this controller contains a national ID: the service returns
 * `hasNationalId` and a fixed mask instead.
 */
@ApiTags('owners')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller({ path: 'owners', version: '1' })
export class OwnersController {
  constructor(private readonly owners: OwnersService) {}

  @Get()
  @ApiOperation({ summary: 'List owners for the tenant' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isEstate', required: false, type: Boolean })
  findAll(
    @Request() req: any,
    @Query('projectId') projectId?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('isEstate') isEstate?: string,
  ) {
    return mapDomainErrors(() =>
      this.owners.findAll(tenantFrom(req), {
        projectId,
        search,
        isActive: isActive === undefined ? undefined : isActive === 'true',
        isEstate: isEstate === undefined ? undefined : isEstate === 'true',
      }),
    )
  }

  @Get(':id')
  @ApiOperation({ summary: 'Owner profile: holdings, signatures, linked resident' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.owners.findOne(id, tenantFrom(req)))
  }

  @Post()
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Create an owner (manager+)' })
  create(@Body() dto: CreateOwnerDto, @Request() req: any) {
    return mapDomainErrors(() => this.owners.create(dto, actorFrom(req)))
  }

  @Patch(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Update an owner (manager+)' })
  update(@Param('id') id: string, @Body() dto: UpdateOwnerDto, @Request() req: any) {
    return mapDomainErrors(() => this.owners.update(id, dto, actorFrom(req)))
  }

  @Patch(':id/active')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Archive or restore an owner (manager+)' })
  setActive(@Param('id') id: string, @Body() dto: SetOwnerActiveDto, @Request() req: any) {
    return mapDomainErrors(() => this.owners.setActive(id, dto, actorFrom(req)))
  }

  @Delete(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Archive an owner (manager+). Soft — holdings and signatures are kept.' })
  archive(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.owners.archive(id, actorFrom(req)))
  }

  // ── Holdings ─────────────────────────────────────────────────────────────

  @Get(':id/holdings')
  @ApiOperation({ summary: 'Apartments this owner holds a share of' })
  listHoldings(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.owners.listHoldings(id, tenantFrom(req)))
  }

  @Patch(':id/holdings')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({
    summary: 'Set this owner’s share of one apartment (manager+). The apartment’s total may not exceed 1.',
  })
  setShare(@Param('id') id: string, @Body() dto: SetOwnerShareDto, @Request() req: any) {
    return mapDomainErrors(() => this.owners.setShare(id, dto, actorFrom(req)))
  }

  @Delete(':id/holdings/:apartmentId')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Detach this owner from one apartment (manager+)' })
  removeHolding(
    @Param('id') id: string,
    @Param('apartmentId') apartmentId: string,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.owners.removeHolding(id, apartmentId, actorFrom(req)))
  }
}

@ApiTags('owners')
@ApiBearerAuth()
@Roles(...MANAGER_ROLES)
@Controller({ path: 'owners/bulk', version: '1' })
export class OwnersBulkController {
  constructor(private readonly owners: OwnersService) {}

  @Post('assign')
  @ApiOperation({
    summary: 'Assign one owner to many apartments at a uniform share (manager+). Single transaction; rejected if any apartment would exceed a share sum of 1.',
  })
  bulkAssign(@Body() dto: BulkAssignOwnerDto, @Request() req: any) {
    return mapDomainErrors(() => this.owners.bulkAssign(dto, actorFrom(req)))
  }
}
