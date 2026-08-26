import { Module } from '@nestjs/common'
import { AutomationsModule } from '../automations/automations.module'
import { ResidentsController, ResidentsBulkController } from './residents.controller'
import { ResidentsService }    from './residents.service'

@Module({
  // Imported for `AutomationRunnerService`, which this module's service calls
  // after a domain event commits.
  imports: [AutomationsModule],
  controllers: [ResidentsController, ResidentsBulkController],
  providers: [ResidentsService],
  exports: [ResidentsService],
})
export class ResidentsModule {}
