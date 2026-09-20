import { Controller, Get, Request, UnauthorizedException } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { STAFF_ROLES } from '../auth/roles.constants'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { DashboardService } from './dashboard.service'

@ApiTags('dashboard')
@ApiBearerAuth()
// Baseline authorization floor: every endpoint in this controller requires a
// staff role unless a method-level @Roles() narrows it further. @Public()
// routes bypass RolesGuard entirely.
@Roles(...STAFF_ROLES)
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard KPIs and recent activity' })
  getStats(@Request() req: any) {
    if (!req.user?.tenantId) throw new UnauthorizedException('Missing tenant context')
    const tenantId = req.user.tenantId
    return this.dashboardService.getStats(tenantId)
  }
}
