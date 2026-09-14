import {
  Controller, Get, Post, Patch, Param, Body, Query, Request,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { LeadsService } from './leads.service'
import { CreateLeadDto } from './dto/create-lead.dto'
import { CreatePublicLeadDto } from './dto/create-public-lead.dto'
import { Public } from '../auth/decorators/public.decorator'

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
  @ApiOperation({ summary: 'Create a lead' })
  create(@Body() body: CreateLeadDto, @Request() req: any) {
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

  /**
   * Public intake for the marketing site's contact form. The site has no
   * credential to present, so this route is exempt from JwtAuthGuard.
   *
   * What keeps it narrow:
   *  - CreatePublicLeadDto has no status/score/assignedToId/source fields, and
   *    the global ValidationPipe rejects unknown properties.
   *  - The service, not the caller, sets source=WEBSITE and status=NEW.
   *  - Overrides the 'long' throttler (see ThrottlerModule in app.module)
   *    from 300/min down to 5/min. The decorator has to name an existing
   *    throttler: a key the module does not define is simply ignored.
   */
  @Public()
  @Throttle({ long: { ttl: 60_000, limit: 5 } })
  @Post('intake')
  @ApiOperation({ summary: 'Create a lead from the public website form' })
  createPublic(@Body() body: CreatePublicLeadDto) {
    return this.leadsService.createFromWebsite(body)
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
