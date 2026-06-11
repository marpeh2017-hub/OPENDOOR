import { Controller, Get, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { DashboardService } from './dashboard.service'

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard KPIs and recent activity' })
  getStats(@Request() req: any) {
    const tenantId = req.user?.tenantId ?? 'tnt_01'
    return this.dashboardService.getStats(tenantId)
  }
}
