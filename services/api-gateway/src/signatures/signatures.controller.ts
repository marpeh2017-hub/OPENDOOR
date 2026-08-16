import { Controller, Get, Param, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ThresholdService } from './threshold.service'

@ApiTags('signatures')
@ApiBearerAuth()
@Controller({ path: 'signatures', version: '1' })
export class SignaturesController {
  constructor(private readonly threshold: ThresholdService) {}

  @Get('threshold/:projectId')
  @ApiOperation({ summary: 'Live signature-threshold status for a project (shares-based)' })
  getThreshold(@Param('projectId') projectId: string, @Request() req: any) {
    const tenantId = req.user?.tenantId ?? 'tnt_01'
    return this.threshold.computeForProject(projectId, tenantId)
  }
}
