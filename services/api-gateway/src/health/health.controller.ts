import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { MANAGER_ROLES } from '../auth/roles.constants'
import { HealthScoreService } from './health-score.service'

@UseGuards(JwtAuthGuard)
@Roles(...MANAGER_ROLES)
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthScoreService: HealthScoreService) {}

  @Get('portfolio')
  async getPortfolio(@Request() req: { user: { tenantId: string } }) {
    return this.healthScoreService.getPortfolio(req.user.tenantId)
  }

  @Get(':projectId')
  async getProjectHealth(
    @Param('projectId') projectId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.healthScoreService.getProjectHealth(projectId, req.user.tenantId)
  }
}
