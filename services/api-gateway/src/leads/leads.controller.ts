import {
  Controller, Get, Post, Patch, Param, Body, Query, Request,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { LeadsService } from './leads.service'

@ApiTags('leads')
@ApiBearerAuth()
@Controller({ path: 'leads', version: '1' })
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page',   required: false })
  findAll(@Query() query: Record<string, string>, @Request() req: any) {
    return this.leadsService.findAll(query, req.user?.tenantId ?? 'tnt_01')
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id)
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.leadsService.create(body, req.user?.tenantId ?? 'tnt_01')
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req: any,
  ) {
    return this.leadsService.updateStatus(id, status, req.user?.sub ?? 'system')
  }

  @Post(':id/activity')
  addActivity(
    @Param('id') id: string,
    @Body() body: { type: string; note: string },
    @Request() req: any,
  ) {
    return this.leadsService.addActivity(id, body.type, body.note, req.user?.sub ?? 'system')
  }
}
