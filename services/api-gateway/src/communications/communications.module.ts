import { Module } from '@nestjs/common'
import { CommunicationsController } from './communications.controller'
import { MessagingModule } from '../messaging/messaging.module'

/**
 * The CRM-facing communications surface. All actual sending lives in
 * `MessagingModule`; this module is the authenticated, RBAC'd, tenant-scoped
 * door onto it.
 */
@Module({
  imports: [MessagingModule],
  controllers: [CommunicationsController],
})
export class CommunicationsModule {}
