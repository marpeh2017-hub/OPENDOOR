import { Module } from '@nestjs/common'
import { AutomationsModule } from '../automations/automations.module'
import { MeetingsController } from './meetings.controller'
import { MeetingInviteController } from './meeting-invite.controller'
import { MeetingsService } from './meetings.service'
import { MeetingAccessService } from './meeting-access.service'
import { MeetingResidentNotifierService } from './meeting-resident-notifier.service'
import { MeetingReminderService } from './meeting-reminder.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { MessagingModule } from '../messaging/messaging.module'

/**
 * Meetings depends on Notifications (staff, in-app) and Messaging (residents,
 * SMS/WhatsApp/email/portal). Both dependencies point one way — neither of
 * those modules knows meetings exist, which is what keeps them reusable by
 * Tasks, Signatures and Automations later.
 *
 * `MeetingInviteController` is the PUBLIC, tokenised resident surface. It lives
 * in this module because it operates on meeting data, but it shares no
 * authentication with `MeetingsController`: see the class comment there.
 *
 * `MeetingReminderService` owns the scan timer. It is provided but NOT exported
 * — nothing outside should be able to trigger a reminder sweep.
 */
@Module({
  imports: [AutomationsModule, NotificationsModule, MessagingModule],
  controllers: [MeetingsController, MeetingInviteController],
  providers: [
    MeetingsService,
    MeetingAccessService,
    MeetingResidentNotifierService,
    MeetingReminderService,
  ],
  exports: [MeetingsService, MeetingAccessService],
})
export class MeetingsModule {}
