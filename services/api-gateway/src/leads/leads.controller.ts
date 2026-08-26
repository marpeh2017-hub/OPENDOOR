import {
  Controller, Get, Post, Patch, Param, Body, Query, Request, UnauthorizedException,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES } from '../auth/roles.constants'
import { LeadsService } from './leads.service'
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto'

@ApiTags('leads')
@ApiBearerAuth()
// Baseline authorization floor: every endpoint in this controller requires a
// staff role unless a method-level @Roles() narrows it further. @Public()
// routes bypass RolesGuard entirely.
@Roles(...STAFF_ROLES)
@Controller({ path: 'leads', version: '1' })
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page',   required: false })
  findAll(@Query() query: Record<string, string>, @Request() req: any) {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return this.leadsService.findAll(query, req.user.tenantId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return this.leadsService.findOne(id, req.user.tenantId)
  }

  @Post()
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'RESIDENT_RELATIONS_MANAGER', 'FIELD_AGENT')
  create(@Body() body: any, @Request() req: any) {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return this.leadsService.create(body, req.user.tenantId)
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'RESIDENT_RELATIONS_MANAGER', 'FIELD_AGENT')
  updateStatus(
    // Bind the whole body to a DTO: `@Body('status')` extracts a raw property
    // and bypasses ValidationPipe entirely, which let an unknown status reach
    // Prisma and surface as a 500 instead of a 400.
    @Param('id') id: string,
    @Body() body: UpdateLeadStatusDto,
    @Request() req: any,
  ) {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return this.leadsService.updateStatus(id, body.status, req.user.tenantId, req.user?.userId ?? 'system')
  }

  @Post(':id/activity')
  @Roles('SUPER_ADMIN', 'COMPANY_ADMIN', 'PROJECT_MANAGER', 'RESIDENT_RELATIONS_MANAGER', 'FIELD_AGENT')
  addActivity(
    @Param('id') id: string,
    @Body() body: { type: string; note: string },
    @Request() req: any,
  ) {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return this.leadsService.addActivity(id, body.type, body.note, req.user.tenantId, req.user?.userId ?? 'system')
  }
}
