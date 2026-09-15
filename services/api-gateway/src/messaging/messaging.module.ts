import { Module } from '@nestjs/common'
import { OutboundMessageService } from './outbound-message.service'
import { MessageDispatcherService } from './message-dispatcher.service'
import { DispatchWorkerService } from './dispatch-worker.service'
import { ProviderRegistryService } from './provider-registry.service'
import { ResidentContactService } from './resident-contact.service'

/**
 * The communications pipeline: Message → Queue → Dispatcher → Provider → Status.
 *
 * `SmsModule` is `@Global()`, so `SmsService` is injectable here without an
 * explicit import — that is how `SmsDeliveryProvider` reuses the existing
 * provider detection rather than duplicating it.
 *
 * EXPORTS are deliberately narrow. Other modules get:
 *   - `OutboundMessageService` — the only sanctioned way to enqueue a message;
 *   - `ResidentContactService` — consent-aware routing for a resident;
 *   - `MessageDispatcherService` — exported for tests and for an eventual admin
 *     "retry now" endpoint, NOT so feature code can push a message through
 *     synchronously. Bypassing the queue re-couples a business transaction to a
 *     third-party HTTP call, which is the thing this module exists to stop.
 *
 * `DispatchWorkerService` is NOT exported: nothing should be able to start,
 * stop or re-enter the polling loop from outside.
 */
@Module({
  providers: [
    ProviderRegistryService,
    OutboundMessageService,
    MessageDispatcherService,
    DispatchWorkerService,
    ResidentContactService,
  ],
  exports: [
    OutboundMessageService,
    ResidentContactService,
    MessageDispatcherService,
    ProviderRegistryService,
  ],
})
export class MessagingModule {}
