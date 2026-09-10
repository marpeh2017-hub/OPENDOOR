import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PortalDashboardController } from './portal-dashboard.controller'
import { PortalDashboardService } from './portal-dashboard.service'
import { PortalDocumentsService } from './portal-documents.service'
import { PortalMessagesService } from './portal-messages.service'
import { PortalProfileService } from './portal-profile.service'
import { PortalSupportService } from './portal-support.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { PortalScopeService } from './portal-scope.service'

/**
 * Everything a signed-in resident can reach.
 *
 * Imports `AuthModule` for `ResidentIdentityService`, which owns the
 * apartment → building → complex → project traversal. The portal deliberately
 * does not re-derive that: a second implementation of "where does this
 * resident actually live" is a second place for it to be wrong, and it is the
 * question every access decision here depends on.
 */
@Module({
  // `NotificationsModule` because a contact-update request has to reach a
  // person today: the support inbox that will read `SupportTicket` does not
  // exist yet, and a request nobody can see is not a request.
  imports: [AuthModule, NotificationsModule],
  controllers: [PortalDashboardController],
  providers: [
    PortalScopeService,
    PortalDashboardService,
    PortalDocumentsService,
    PortalMessagesService,
    PortalProfileService,
    PortalSupportService,
  ],
  exports: [PortalScopeService],
})
export class PortalModule {}
