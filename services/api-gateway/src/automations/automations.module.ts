import { Module } from '@nestjs/common'
import { AutomationsController } from './automations.controller'
import { AutomationsService } from './automations.service'
import { AutomationRunnerService } from './automation-runner.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { TemplatesModule } from '../templates/templates.module'
import { MessagingModule } from '../messaging/messaging.module'
import { SendCapService } from './send-cap.service'

/**
 * The automations engine.
 *
 * Exports `AutomationRunnerService` so the modules that own domain events
 * (leads, documents, signatures) can call `dispatch()` in-process. It is
 * exported rather than made global so that every module which can fire an
 * automation has to declare that dependency explicitly.
 */
@Module({
  imports: [NotificationsModule, TemplatesModule, MessagingModule],
  controllers: [AutomationsController],
  providers: [AutomationsService, AutomationRunnerService, SendCapService],
  exports: [AutomationRunnerService],
})
export class AutomationsModule {}
