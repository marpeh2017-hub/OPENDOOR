import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma.module'
import { DataQualityController } from './data-quality.controller'
import { DataQualityEngine } from './data-quality.engine'
import { DataQualityService } from './data-quality.service'
import { DATA_QUALITY_RULES, RULE_PROVIDERS } from './rules'
import type { DataQualityRule } from './data-quality.types'

@Module({
  imports: [PrismaModule],
  controllers: [DataQualityController],
  providers: [
    ...RULE_PROVIDERS,
    {
      // The engine receives the rules as one injected, ordered array so a new
      // rule only has to be added to RULE_PROVIDERS.
      provide: DATA_QUALITY_RULES,
      useFactory: (...rules: DataQualityRule[]) => rules,
      inject: [...RULE_PROVIDERS],
    },
    DataQualityEngine,
    DataQualityService,
  ],
  exports: [DataQualityService, DataQualityEngine],
})
export class DataQualityModule {}
