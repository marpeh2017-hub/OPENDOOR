import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService }    from './dashboard.service'
import { ProjectHealthModule }  from '../health/health.module'

@Module({
  imports: [ProjectHealthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
