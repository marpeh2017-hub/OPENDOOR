import {
  Controller, Get, Post, Put, Patch, Param, Body, Query, Request,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { ProjectsService } from './projects.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'
import { Public } from '../auth/decorators/public.decorator'

@ApiTags('projects')
@ApiBearerAuth()
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List all tenant projects' })
  @ApiQuery({ name: 'stage',  required: false })
  @ApiQuery({ name: 'city',   required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page',   required: false })
  @ApiQuery({ name: 'limit',  required: false })
  findAll(@Query() query: Record<string, string>, @Request() req: any) {
    const tenantId = req.user?.tenantId ?? 'tnt_01'
    return this.projectsService.findAll(query, tenantId)
  }

  @Post()
  @ApiOperation({ summary: 'Create project' })
  create(@Body() dto: CreateProjectDto, @Request() req: any) {
    const tenantId = req.user?.tenantId ?? 'tnt_01'
    return this.projectsService.create(dto, tenantId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project with all data' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update project' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto)
  }

  @Patch(':id/stage')
  @ApiOperation({ summary: 'Advance project stage' })
  advanceStage(
    @Param('id') id: string,
    @Body('stage') stage: string,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    return this.projectsService.advanceStage(id, stage, notes, req.user?.sub)
  }

  @Get(':id/signature-report')
  @ApiOperation({ summary: 'Signature status report' })
  signatureReport(@Param('id') id: string) {
    return this.projectsService.getSignatureReport(id)
  }
}
