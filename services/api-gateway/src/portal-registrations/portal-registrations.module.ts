import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { LeadsModule } from '../leads/leads.module'
import { SignaturesModule } from '../signatures/signatures.module'
import { PortalRegistrationsService } from './portal-registrations.service'
import { PortalRegistrationsController } from './portal-registrations.controller'
import { PublicPortalRegistrationsController } from './public-portal-registrations.controller'

/**
 * Registration for the personal area. AuthModule for the resident lookup the
 * sign-in itself uses, LeadsModule for the public intake and the office
 * alert, SignaturesModule for its email sender.
 */
@Module({
  imports: [AuthModule, LeadsModule, SignaturesModule],
  controllers: [PublicPortalRegistrationsController, PortalRegistrationsController],
  providers: [PortalRegistrationsService],
})
export class PortalRegistrationsModule {}
