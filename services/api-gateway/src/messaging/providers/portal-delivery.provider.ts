import type { MessageChannel } from '@prisma/client'
import type { DeliveryProvider, DeliveryResult, OutboundPayload } from './delivery-provider.interface'

/**
 * The portal inbox "transport".
 *
 * There is no external system: a PORTAL message IS the `Message` row, and a
 * resident reads it through their portal session. It is modelled as a provider
 * anyway so that every channel goes through one dispatcher with one set of
 * status transitions and one audit trail — the alternative, special-casing
 * PORTAL upstream, is how a second, subtly different send path gets born.
 *
 * It is NOT simulated. Nothing left the building because nothing was ever meant
 * to; the message is genuinely delivered the moment the row is durable, which
 * is why the dispatcher marks PORTAL sends DELIVERED immediately rather than
 * waiting for a webhook that will never arrive.
 */
export class PortalDeliveryProvider implements DeliveryProvider {
  readonly name = 'portal-inbox'
  readonly isConfigured = true

  constructor(readonly channel: MessageChannel) {}

  async send(payload: OutboundPayload): Promise<DeliveryResult> {
    return { providerMessageId: `portal_${payload.messageId}`, simulated: false }
  }
}
