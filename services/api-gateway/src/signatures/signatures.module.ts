import { Module } from '@nestjs/common'
import { SignaturesController } from './signatures.controller'
import { ThresholdService } from './threshold.service'

@Module({
  controllers: [SignaturesController],
  providers: [ThresholdService],
  exports: [ThresholdService],
})
export class SignaturesModule {}
