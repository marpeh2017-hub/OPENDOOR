import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Request, Query,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { BuildingsService } from './buildings.service'
import { STAFF_ROLES, MANAGER_ROLES } from '../auth/roles.constants'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'
import {
  CreateBuildingDto, UpdateBuildingDto, MoveBuildingDto, SetEntityStatusDto,
  CreateApartmentDto, UpdateApartmentDto, SetApartmentOwnersDto,
  BulkBuildingStatusDto, BulkMoveBuildingsDto,
} from './dto/building.dto'

@ApiTags('buildings')
@ApiBearerAuth()
@Controller({ path: 'buildings', version: '1' })
export class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List buildings for the tenant' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'complexId', required: false })
  @ApiQuery({ name: 'city',      required: false })
  @ApiQuery({ name: 'search',    required: false })
  findAll(
    @Request() req: any,
    @Query('projectId') projectId?: string,
    @Query('complexId') complexId?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ) {
    return mapDomainErrors(() =>
      this.buildings.findAll(tenantFrom(req), { projectId, complexId, city, search }),
    )
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get a building with its apartments' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.findOne(id, tenantFrom(req)))
  }

  @Post()
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Create a building (manager+)' })
  create(@Body() dto: CreateBuildingDto, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.create(dto, actorFrom(req)))
  }

  @Patch(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Update a building (manager+)' })
  update(@Param('id') id: string, @Body() dto: UpdateBuildingDto, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.update(id, dto, actorFrom(req)))
  }

  @Patch(':id/complex')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Move a building to another complex/project (manager+)' })
  move(@Param('id') id: string, @Body() dto: MoveBuildingDto, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.move(id, dto, actorFrom(req)))
  }

  @Patch(':id/status')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Archive or restore a building (manager+)' })
  setStatus(@Param('id') id: string, @Body() dto: SetEntityStatusDto, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.setStatus(id, dto, actorFrom(req)))
  }

  @Delete(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Archive a building (manager+). Soft — apartments are archived too.' })
  remove(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.remove(id, actorFrom(req)))
  }
}

@ApiTags('buildings')
@ApiBearerAuth()
@Roles(...MANAGER_ROLES)
@Controller({ path: 'buildings/bulk', version: '1' })
export class BuildingsBulkController {
  constructor(private readonly buildings: BuildingsService) {}

  @Post('status')
  @ApiOperation({ summary: 'Bulk archive/restore buildings (manager+). Single transaction.' })
  bulkStatus(@Body() dto: BulkBuildingStatusDto, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.bulkSetStatus(dto, actorFrom(req)))
  }

  @Post('move')
  @ApiOperation({ summary: 'Bulk move buildings to a complex (manager+). Single transaction.' })
  bulkMove(@Body() dto: BulkMoveBuildingsDto, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.bulkMove(dto, actorFrom(req)))
  }
}

@ApiTags('buildings')
@ApiBearerAuth()
@Controller({ path: 'complexes', version: '1' })
export class ComplexesController {
  constructor(private readonly buildings: BuildingsService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List complexes for the tenant' })
  @ApiQuery({ name: 'projectId', required: false })
  findAll(@Request() req: any, @Query('projectId') projectId?: string) {
    return mapDomainErrors(() => this.buildings.findComplexes(tenantFrom(req), projectId))
  }
}

@ApiTags('buildings')
@ApiBearerAuth()
@Controller({ path: 'apartments', version: '1' })
export class ApartmentsController {
  constructor(private readonly buildings: BuildingsService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List apartments' })
  @ApiQuery({ name: 'buildingId', required: false })
  findAll(@Request() req: any, @Query('buildingId') buildingId?: string) {
    return mapDomainErrors(() => this.buildings.findApartments(tenantFrom(req), buildingId))
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get an apartment, with its exact ownership share sum' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.findApartment(id, tenantFrom(req)))
  }

  @Post()
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Create an apartment, optionally with owners (manager+)' })
  create(@Body() dto: CreateApartmentDto, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.createApartment(dto, actorFrom(req)))
  }

  @Patch(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Update an apartment (manager+)' })
  update(@Param('id') id: string, @Body() dto: UpdateApartmentDto, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.updateApartment(id, dto, actorFrom(req)))
  }

  @Patch(':id/status')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Archive or restore an apartment (manager+)' })
  setStatus(@Param('id') id: string, @Body() dto: SetEntityStatusDto, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.setApartmentStatus(id, dto, actorFrom(req)))
  }

  @Delete(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Archive an apartment (manager+). Soft.' })
  remove(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.removeApartment(id, actorFrom(req)))
  }

  // ── Ownership ────────────────────────────────────────────────────────────

  @Get(':id/owners')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Ownership of an apartment with the exact reduced share sum' })
  getOwners(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.getApartmentOwners(id, tenantFrom(req)))
  }

  @Put(':id/owners')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({
    summary: 'Replace an apartment’s ownership (manager+). Shares are exact fractions; the sum may never exceed 1.',
  })
  setOwners(@Param('id') id: string, @Body() dto: SetApartmentOwnersDto, @Request() req: any) {
    return mapDomainErrors(() => this.buildings.setApartmentOwners(id, dto, actorFrom(req)))
  }

  @Delete(':id/owners/:ownerId')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Remove one owner from an apartment (manager+)' })
  removeOwner(
    @Param('id') id: string,
    @Param('ownerId') ownerId: string,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.buildings.removeApartmentOwner(id, ownerId, actorFrom(req)))
  }
}
