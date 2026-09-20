import { Module } from '@nestjs/common'
import { AutomationsModule } from '../automations/automations.module'
import { ProjectsController, ProjectsBulkController } from './projects.controller'
import { ProjectsService }    from './projects.service'

@Module({
  // Imported for `AutomationRunnerService`, which this module's service calls
  // after a domain event commits.
  imports: [AutomationsModule],
  controllers: [ProjectsController, ProjectsBulkController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
