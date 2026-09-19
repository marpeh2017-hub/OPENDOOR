import { Module } from '@nestjs/common'
import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'
import { NotificationRetentionService } from './notification-retention.service'

/**
 * `NotificationsService` is EXPORTED because it is the delivery substrate other
 * feature modules call — Meetings emits invitations through it, and Automations
 * will. Any module that needs to notify someone imports NotificationsModule and
 * injects the service; nothing else should write to `prisma.notification`
 * directly, or the tenant/recipient checks and the link sanitiser get bypassed.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationRetentionService],
  // The retention sweeper is provided but NOT exported: nothing outside this
  // module should be able to trigger a deletion sweep.
  exports: [NotificationsService],
})
export class NotificationsModule {}
