import { Logger } from '@nestjs/common'
import type { MessageChannel } from '@prisma/client'
import { SmsService } from '../../sms/sms.service'
import { sanitiseProviderDetail } from '../sanitise'
import { DeliveryError } from './delivery-provider.interface'
import type { DeliveryProvider, DeliveryResult, OutboundPayload } from './delivery-provider.interface'

/**
 * SMS transport, delegating to the EXISTING `SmsService`.
 *
 * Deliberately a wrapper and not a reimplementation. `SmsService` already owns
 * Vonage/Twilio/Inforu detection, the credential precedence, and the
 * "production without a provider is an error" rule; duplicating that here would
 * create two places to configure SMS and one of them would drift. What this
 * class adds is the dispatcher's contract: a `DeliveryError` with a retryable
 * flag, and a sanitised failure string.
 */
export class SmsDeliveryProvider implements DeliveryProvider {
  private readonly logger = new Logger('SmsDeliveryProvider')
  readonly channel: MessageChannel = 'SMS'

  constructor(private readonly sms: SmsService) {}

  get name(): string { return `sms:${this.sms.providerName}` }
  get isConfigured(): boolean { return this.sms.isConfigured }

  async send(payload: OutboundPayload): Promise<DeliveryResult> {
    if (!payload.toPhone) {
      throw DeliveryError.permanent('SMS message has no destination phone number')
    }

    try {
      await this.sms.sendText(payload.toPhone, payload.body)
    } catch (err) {
      const detail = sanitiseProviderDetail(err)
      // Conservative classification. Anything we cannot positively identify as
      // a permanent rejection is treated as transient, because giving up on a
      // deliverable message is worse than one extra retry — and the attempt cap
      // bounds the cost of being wrong.
      throw this.classify(err, detail)
    }

    // `SmsService` returns void; it does not surface a provider message id.
    // Recording `null` is honest. Inventing one would break webhook correlation
    // in a way that only shows up months later.
    return { providerMessageId: null, simulated: false }
  }

  private classify(err: unknown, detail: string): DeliveryError {
    const status = (err as { status?: number; statusCode?: number })?.status
      ?? (err as { statusCode?: number })?.statusCode
    if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
      return DeliveryError.permanent(detail, String(status))
    }
    if (/invalid (phone|number|recipient)|unsubscrib|blacklist|not a mobile/i.test(detail)) {
      return DeliveryError.permanent(detail)
    }
    return DeliveryError.transient(detail, status ? String(status) : null)
  }
}
