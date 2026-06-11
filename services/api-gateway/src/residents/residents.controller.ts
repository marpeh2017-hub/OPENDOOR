import {
  Controller, Get, Patch, Post, Param, Body, Query, Request, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { ResidentsService } from './residents.service'

@ApiTags('residents')
@ApiBearerAuth()
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
    const tenantId = req.user?.tenantId ?? 'tnt_01'
    return this.residentsService.findAll(query, tenantId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resident profile' })
  findOne(@Param('id') id: string) {
    return this.residentsService.findOne(id)
  }

  @Patch(':id/signature-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update resident signature status' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req: any,
  ) {
    return this.residentsService.updateStatus(id, status, req.user?.sub ?? 'system')
  }

  @Post(':id/activity')
  @ApiOperation({ summary: 'Add activity log entry' })
  addActivity(
    @Param('id') id: string,
    @Body() body: { type: string; title: string; note?: string },
    @Request() req: any,
  ) {
    return this.residentsService.addActivity(id, body.type, body.title, body.note ?? '', req.user?.sub ?? 'system')
  }
}
