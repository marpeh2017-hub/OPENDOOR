import {
  Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Request, UnauthorizedException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { MANAGER_ROLES, STAFF_ROLES } from '../auth/roles.constants'
import { actorFrom } from '../common/actor'
import { GisService } from './gis.service'
import { GEO_ENTITY_KINDS, GisGeocodeService, type GeoEntityKind } from './gis-geocode.service'
import { RunGeocodeDto } from './dto/run-geocode.dto'
import { SetCoordinatesDto } from './dto/set-coordinates.dto'
import { BadRequestException } from '@nestjs/common'

@ApiTags('gis')
@ApiBearerAuth()
@Controller({ path: 'gis', version: '1' })
export class GisController {
  constructor(
    private readonly gis: GisService,
    private readonly geocode: GisGeocodeService,
  ) {}

  private tenantId(req: any): string {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return req.user.tenantId
  }

  /** Path params are user input; a bad kind is a 400, not a cast. */
  private parseKind(raw: string): GeoEntityKind {
    const kind = raw?.toUpperCase() as GeoEntityKind
    if (!GEO_ENTITY_KINDS.includes(kind)) {
      throw new BadRequestException(`kind must be one of: ${GEO_ENTITY_KINDS.join(', ')}`)
    }
    return kind
  }

  @Get('overview')
  @Roles(...STAFF_ROLES)
  @ApiOperation({
    summary: 'Mappable entities plus geographic-coverage statistics for the tenant',
  })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'city',      required: false })
  @ApiQuery({ name: 'search',    required: false })
  overview(
    @Request() req: any,
    @Query('projectId') projectId?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ) {
    return this.gis.overview(this.tenantId(req), { projectId, city, search })
  }

  /**
   * Entities with an address and no coordinates — the sweep's work queue.
   * Read-only, so it is open to all staff; running the sweep is not.
   */
  @Get('geocode/pending')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Entities that have an address but no coordinates' })
  @ApiQuery({ name: 'projectId', required: false })
  async pending(@Request() req: any, @Query('projectId') projectId?: string) {
    const candidates = await this.geocode.findCandidates(this.tenantId(req), { projectId })
    return { total: candidates.length, candidates }
  }

  /**
   * Admin-triggered geocode sweep.
   *
   * Explicitly a manual action, never a background job: the provider is a
   * donated public service capped at 1 request/second and an automatic sweep
   * would violate its usage policy. Restricted to MANAGER_ROLES because it
   * writes location data onto real projects.
   */
  @Post('geocode/run')
  // A sweep is an action over existing rows, not the creation of a resource —
  // 200 with a summary, not Nest's default 201.
  @HttpCode(200)
  @Roles(...MANAGER_ROLES)
  @ApiOperation({
    summary: 'Resolve coordinates for entities that are missing them (manual, batch-capped)',
  })
  runGeocode(@Request() req: any, @Body() body: RunGeocodeDto) {
    return this.geocode.runSweep(actorFrom(req), body)
  }

  /**
   * Manual override — a human supplies or corrects a location the provider got
   * wrong. Essential for Israeli addresses, where OSM coverage is uneven.
   */
  @Put('coordinates/:kind/:id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Set an entity’s coordinates by hand' })
  @ApiParam({ name: 'kind', enum: GEO_ENTITY_KINDS })
  setCoordinates(
    @Request() req: any,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: SetCoordinatesDto,
  ) {
    return this.geocode.setManualCoordinates(actorFrom(req), this.parseKind(kind), id, body)
  }

  /** Removes a coordinate; the entity goes back to being honestly unplaced. */
  @Delete('coordinates/:kind/:id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Clear an entity’s coordinates' })
  @ApiParam({ name: 'kind', enum: GEO_ENTITY_KINDS })
  async clearCoordinates(
    @Request() req: any,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    await this.geocode.clearCoordinates(actorFrom(req), this.parseKind(kind), id)
    return { cleared: true }
  }
}
