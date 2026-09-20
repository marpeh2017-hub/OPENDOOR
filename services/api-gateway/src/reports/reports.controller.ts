import {
  Controller, Get, Post, Delete,
  Param, Body, Request, UnauthorizedException, NotFoundException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../prisma.service'

const REPORT_ROLES = ['SUPER_ADMIN','COMPANY_ADMIN','PROJECT_MANAGER','DEVELOPER_REP','MUNICIPALITY_USER'] as const

@ApiTags('reports')
@ApiBearerAuth()
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  private tenantId(req: any): string {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    return req.user.tenantId
  }

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
  create(@Body() body: any, @Request() req: any) {
    const tenantId = this.tenantId(req)
    return this.prisma.savedReport.create({
      data: { ...body, tenantId, createdById: req.user.userId },
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
