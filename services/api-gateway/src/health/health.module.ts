import { Module } from '@nestjs/common'
import { HealthScoreService } from './health-score.service'
import { HealthController } from './health.controller'
import { PrismaModule } from '../prisma.module'
import { DataQualityModule } from '../data-quality/data-quality.module'

@Module({
  imports: [PrismaModule, DataQualityModule],
  controllers: [HealthController],
  providers: [HealthScoreService],
  exports: [HealthScoreService],
})
export class ProjectHealthModule {}
