import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PortalDashboardController } from './portal-dashboard.controller'
import { PortalDashboardService } from './portal-dashboard.service'
import { PortalDocumentsService } from './portal-documents.service'
import { PortalMessagesService } from './portal-messages.service'
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
  imports: [AuthModule],
  controllers: [PortalDashboardController],
  providers: [
    PortalScopeService,
    PortalDashboardService,
    PortalDocumentsService,
    PortalMessagesService,
  ],
  exports: [PortalScopeService],
})
export class PortalModule {}
