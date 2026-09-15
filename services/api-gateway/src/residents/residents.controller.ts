import {
  Controller, Get, Patch, Post, Delete, Param, Body, Query, Request,
  HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES, MANAGER_ROLES } from '../auth/roles.constants'
import { ResidentsService } from './residents.service'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'
import { CreateResidentDto } from './dto/create-resident.dto'
import { UpdateResidentDto } from './dto/update-resident.dto'
import {
  UpdateSignatureStatusDto, AddResidentActivityDto, SetResidentActiveDto,
  MoveResidentDto, BulkResidentStatusDto, SetPortalInboxDto,
} from './dto/resident-actions.dto'

/** Roles allowed to edit resident records and their engagement state. */
const RESIDENT_WRITE_ROLES = [
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER',
  'RESIDENT_RELATIONS_MANAGER', 'FIELD_AGENT',
] as const

@ApiTags('residents')
@ApiBearerAuth()
// Baseline authorization floor: every endpoint in this controller requires a
// staff role unless a method-level @Roles() narrows it further. @Public()
// routes bypass RolesGuard entirely.
@Roles(...STAFF_ROLES)
@Controller({ path: 'residents', version: '1' })
export class ResidentsController {
  constructor(private readonly residentsService: ResidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List residents with filters' })
  @ApiQuery({ name: 'projectId',       required: false })
  @ApiQuery({ name: 'signatureStatus', required: false })
  @ApiQuery({ name: 'search',          required: false })
  @ApiQuery({ name: 'page',            required: false })
  @ApiQuery({ name: 'limit',           required: false })
  findAll(@Query() query: Record<string, string>, @Request() req: any) {
    return mapDomainErrors(() => this.residentsService.findAll(query, tenantFrom(req)))
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resident profile (national ID never included)' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.residentsService.findOne(id, tenantFrom(req)))
  }

  @Post()
  @Roles(...RESIDENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Create a resident' })
  create(@Body() dto: CreateResidentDto, @Request() req: any) {
    return mapDomainErrors(() => this.residentsService.create(dto, actorFrom(req)))
  }

  @Patch(':id')
  @Roles(...RESIDENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Update a resident' })
  update(@Param('id') id: string, @Body() dto: UpdateResidentDto, @Request() req: any) {
    return mapDomainErrors(() => this.residentsService.update(id, dto, actorFrom(req)))
  }

  @Patch(':id/apartment')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Move a resident to another apartment (manager+)' })
  move(@Param('id') id: string, @Body() dto: MoveResidentDto, @Request() req: any) {
    return mapDomainErrors(() => this.residentsService.moveToApartment(id, dto, actorFrom(req)))
  }

  @Patch(':id/active')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Archive or restore a resident (manager+)' })
  setActive(@Param('id') id: string, @Body() dto: SetResidentActiveDto, @Request() req: any) {
    return mapDomainErrors(() => this.residentsService.setActive(id, dto, actorFrom(req)))
  }

  /**
   * Open or close this resident's portal inbox.
   *
   * `RESIDENT_WRITE_ROLES` rather than manager-only: it is the same tier that
   * may edit the resident's contact details, and it is the field agent at the
   * door who discovers somebody wants to stop receiving texts and read things
   * in the app instead.
   */
  @Patch(':id/portal-inbox')
  @Roles(...RESIDENT_WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Enable or disable the resident's portal inbox" })
  setPortalInbox(
    @Param('id') id: string,
    @Body() dto: SetPortalInboxDto,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.residentsService.setPortalInbox(id, dto, actorFrom(req)))
  }

  @Delete(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Archive a resident (manager+). Soft — history is preserved.' })
  archive(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.residentsService.archive(id, actorFrom(req)))
  }

  @Patch(':id/signature-status')
  @Roles(...RESIDENT_WRITE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update resident signature status' })
  // Validated DTO body — @Body('status') would skip the ValidationPipe.
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSignatureStatusDto,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.residentsService.updateStatus(id, dto, actorFrom(req)))
  }

  @Post(':id/activity')
  @Roles(...RESIDENT_WRITE_ROLES)
  @ApiOperation({ summary: 'Add activity log entry' })
  addActivity(
    @Param('id') id: string,
    @Body() dto: AddResidentActivityDto,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.residentsService.addActivity(id, dto, actorFrom(req)))
  }
}

@ApiTags('residents')
@ApiBearerAuth()
@Roles(...MANAGER_ROLES)
@Controller({ path: 'residents/bulk', version: '1' })
export class ResidentsBulkController {
  constructor(private readonly residentsService: ResidentsService) {}

  @Post('signature-status')
  @ApiOperation({
    summary: 'Bulk update resident signature status (manager+). Single transaction.',
  })
  bulkStatus(@Body() dto: BulkResidentStatusDto, @Request() req: any) {
    return mapDomainErrors(() => this.residentsService.bulkUpdateStatus(dto, actorFrom(req)))
  }
}
