import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Request,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES, MANAGER_ROLES, ADMIN_ROLES } from '../auth/roles.constants'
import { ProjectsService } from './projects.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'
import {
  AdvanceStageDto, ChangeProjectStatusDto, AssignProjectTeamDto,
  AddProjectMemberDto, BulkProjectStatusDto, ArchiveProjectDto, RestoreProjectDto,
} from './dto/project-actions.dto'
import { actorFrom, tenantFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'

@ApiTags('projects')
@ApiBearerAuth()
// Baseline authorization floor: every endpoint in this controller requires a
// staff role unless a method-level @Roles() narrows it further. @Public()
// routes bypass RolesGuard entirely.
@Roles(...STAFF_ROLES)
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List all tenant projects' })
  @ApiQuery({ name: 'stage',  required: false })
  @ApiQuery({ name: 'city',   required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, description: 'Exact status filter, e.g. ARCHIVED' })
  @ApiQuery({
    name: 'includeArchived', required: false,
    description: 'Set true to include archived projects. Archived are hidden by default.',
  })
  @ApiQuery({ name: 'page',   required: false })
  @ApiQuery({ name: 'limit',  required: false })
  findAll(@Query() query: Record<string, string>, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.findAll(query, tenantFrom(req)))
  }

  @Post()
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Create project (manager+)' })
  create(@Body() dto: CreateProjectDto, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.create(dto, actorFrom(req)))
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project with all data' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.findOne(id, tenantFrom(req)))
  }

  @Put(':id')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Update project (manager+)' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.update(id, dto, actorFrom(req)))
  }

  @Patch(':id/stage')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Advance project stage (manager+)' })
  // Body is a validated DTO — per-property @Body('stage') would bypass the
  // global ValidationPipe entirely.
  advanceStage(@Param('id') id: string, @Body() dto: AdvanceStageDto, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.advanceStage(id, dto, actorFrom(req)))
  }

  @Patch(':id/status')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Change project status, including ARCHIVE (manager+)' })
  changeStatus(@Param('id') id: string, @Body() dto: ChangeProjectStatusDto, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.changeStatus(id, dto, actorFrom(req)))
  }

  @Post(':id/archive')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({
    summary: 'Archive a project — soft closure (manager+). 409 if already archived.',
  })
  archive(@Param('id') id: string, @Body() dto: ArchiveProjectDto, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.archive(id, dto, actorFrom(req)))
  }

  @Post(':id/restore')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({
    summary: 'Restore an archived project (manager+). 409 if it is not archived.',
  })
  restore(@Param('id') id: string, @Body() dto: RestoreProjectDto, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.restore(id, dto, actorFrom(req)))
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary:
      'Hard-delete an EMPTY project (admin only). 409 if it holds any complex, ' +
      'building, apartment, document, meeting, task or team member — archive instead.',
  })
  remove(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.remove(id, actorFrom(req)))
  }

  @Patch(':id/team')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Assign project manager / lawyer / architect (manager+)' })
  assignTeam(@Param('id') id: string, @Body() dto: AssignProjectTeamDto, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.assignTeam(id, dto, actorFrom(req)))
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List project team members' })
  listMembers(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.listMembers(id, tenantFrom(req)))
  }

  @Post(':id/members')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Add a project team member (manager+)' })
  addMember(@Param('id') id: string, @Body() dto: AddProjectMemberDto, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.addMember(id, dto, actorFrom(req)))
  }

  @Delete(':id/members/:memberId')
  @Roles(...MANAGER_ROLES)
  @ApiOperation({ summary: 'Remove a project team member (manager+)' })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req: any,
  ) {
    return mapDomainErrors(() => this.projectsService.removeMember(id, memberId, actorFrom(req)))
  }

  @Get(':id/signature-report')
  @ApiOperation({ summary: 'Signature status report' })
  signatureReport(@Param('id') id: string, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.getSignatureReport(id, tenantFrom(req)))
  }
}

@ApiTags('projects')
@ApiBearerAuth()
@Roles(...MANAGER_ROLES)
@Controller({ path: 'projects/bulk', version: '1' })
export class ProjectsBulkController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('status')
  @ApiOperation({
    summary: 'Bulk change project status / archive (manager+). Single transaction.',
  })
  bulkStatus(@Body() dto: BulkProjectStatusDto, @Request() req: any) {
    return mapDomainErrors(() => this.projectsService.bulkChangeStatus(dto, actorFrom(req)))
  }
}
