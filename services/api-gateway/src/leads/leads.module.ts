import { Module } from '@nestjs/common'
import { AutomationsModule } from '../automations/automations.module'
import { LeadsController } from './leads.controller'
import { LeadsService }    from './leads.service'
import { PublicLeadsController } from './public-leads.controller'
import { PublicLeadsService }    from './public-leads.service'

/**
 * `PublicLeadsController` is the system's only unauthenticated write surface.
 * It is registered here alongside the staff-facing controller because both
 * write the same `Lead` model, but they share no service: the public path has
 * its own narrow service so nothing staff-facing can accidentally acquire an
 * anonymous code path.
 */
@Module({
  // Imported for `AutomationRunnerService`, which this module's service calls
  // after a domain event commits.
  imports: [AutomationsModule],
  controllers: [LeadsController, PublicLeadsController],
  providers: [LeadsService, PublicLeadsService],
})
export class LeadsModule {}
