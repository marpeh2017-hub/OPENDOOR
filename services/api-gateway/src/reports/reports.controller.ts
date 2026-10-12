import {
  Controller, Get, Post, Delete, Header, HttpCode, HttpStatus,
  Param, Body, Request, UnauthorizedException, NotFoundException, StreamableFile,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../prisma.service'
import { actorFrom } from '../common/actor'
import { mapDomainErrors } from '../common/errors/domain-error'
import { ReportsService } from './reports.service'
import { RunReportDto, SaveReportDto } from './dto/report.dto'
import { REPORTS, REPORT_TYPES } from './report-catalog'

const REPORT_ROLES = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER','DEVELOPER_REP','MUNICIPALITY_USER'] as const

/** Anyone who may run at least one report; each report checks its own roles. */
const RUN_ROLES = [...new Set(REPORT_TYPES.flatMap((type) => REPORTS[type].roles))]

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

@ApiTags('reports')
@ApiBearerAuth()
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  private tenantId(req: any): string {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return req.user.tenantId
  }

  /* ─── The report generator (declared before ':id', which would swallow 'types') ── */

  @Get('types')
  @Roles(...RUN_ROLES)
  @ApiOperation({ summary: 'The reports this user may run, with their filters and columns' })
  types(@Request() req: any) {
    return this.reports.types(req.user.role)
  }

  @Post('run')
  @Roles(...RUN_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview a report: its first rows, the total and the summary' })
  run(@Body() dto: RunReportDto, @Request() req: any) {
    return mapDomainErrors(() => this.reports.run(dto, actorFrom(req)))
  }

  @Post('export')
  @Roles(...RUN_ROLES)
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', XLSX)
  @ApiOperation({ summary: 'A report as an Excel file (audited)' })
  async export(@Body() dto: RunReportDto, @Request() req: any) {
    const result = await mapDomainErrors(() => this.reports.export(dto, actorFrom(req)))
    return new StreamableFile(result.buffer, { disposition: `attachment; filename="${result.fileName}"`, type: XLSX })
  }

  /* ─── Saved report configurations ─────────────────────────────────────── */

  @Get()
  @Roles(...REPORT_ROLES)
  @ApiOperation({ summary: 'List saved reports' })
  findAll(@Request() req: any) {
    return this.prisma.savedReport.findMany({
      where: { tenantId: this.tenantId(req) },
      orderBy: { createdAt: 'desc' },
    })
  }

  @Get(':id')
  @Roles(...REPORT_ROLES)
  @ApiOperation({ summary: 'Get a saved report' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const report = await this.prisma.savedReport.findFirst({ where: { id, tenantId } })
    if (!report) throw new NotFoundException('Report not found')
    return report
  }

  @Post()
  @Roles('SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER')
  @ApiOperation({ summary: 'Save a report configuration' })
  async create(@Body() dto: SaveReportDto, @Request() req: any) {
    const tenantId = this.tenantId(req)
    // Named fields only. The body used to be spread into the row, so a caller
    // could set any column the model has.
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, tenantId }, select: { id: true } })
      if (!project) throw new NotFoundException('Project not found')
    }
    return this.prisma.savedReport.create({
      data: {
        tenantId,
        createdById: req.user.userId,
        name: dto.name,
        type: dto.type,
        config: dto.config as object,
        ...(dto.projectId ? { projectId: dto.projectId } : {}),
      },
    })
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER')
  @ApiOperation({ summary: 'Delete a saved report' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const tenantId = this.tenantId(req)
    const report = await this.prisma.savedReport.findFirst({ where: { id, tenantId } })
    if (!report) throw new NotFoundException('Report not found')
    return this.prisma.savedReport.delete({ where: { id } })
  }
}
