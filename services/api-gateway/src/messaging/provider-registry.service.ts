import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import type { MessageChannel } from '@prisma/client'
import { SmsService } from '../sms/sms.service'
import { MessagingConfig } from './messaging.config'
import type { DeliveryProvider } from './providers/delivery-provider.interface'
import { DevNoopProvider } from './providers/dev-noop.provider'
import { SmsDeliveryProvider } from './providers/sms-delivery.provider'
import { EmailDeliveryProvider } from './providers/email-delivery.provider'
import { WhatsAppDeliveryProvider } from './providers/whatsapp-delivery.provider'
import { PortalDeliveryProvider } from './providers/portal-delivery.provider'

/**
 * Channel → transport resolution. The ONLY place a concrete provider is named.
 *
 * The selection rule, in order:
 *
 *   1. `MESSAGING_SIMULATE=true` (the default off production) → dev/no-op.
 *      This wins over configured credentials deliberately. A developer who has
 *      a real TWILIO_ACCOUNT_SID in their `.env` — copied from staging, or left
 *      over from debugging — must not start texting residents the moment they
 *      run the API locally. Sending for real is opt-IN, never a side effect of
 *      a stray variable.
 *   2. The channel's real provider, if its credentials are present.
 *   3. Dev/no-op, with the reason recorded — EXCEPT in production, where an
 *      unconfigured channel is a hard failure rather than a silent black hole.
 *      Quietly simulating in production is exactly the "we thought we sent it"
 *      bug this whole module exists to prevent.
 *
 * PORTAL and IN_APP are never simulated: their "provider" is our own database.
 */
@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name)
  private readonly cache = new Map<MessageChannel, DeliveryProvider>()

  constructor(private readonly sms: SmsService) {}

  onModuleInit(): void {
    // Resolve every channel once at boot so a misconfiguration is visible in
    // the startup log rather than at 02:00 when the first reminder fires.
    for (const channel of ['SMS', 'WHATSAPP', 'EMAIL', 'PORTAL', 'IN_APP'] as MessageChannel[]) {
      const p = this.resolve(channel)
      this.logger.log(
        `channel ${channel} → ${p.name}${p instanceof DevNoopProvider ? ' (SIMULATED — nothing is transmitted)' : ''}`,
      )
    }
  }

  /** Never throws. An unroutable channel still gets a provider that fails loudly. */
  resolve(channel: MessageChannel): DeliveryProvider {
    const cached = this.cache.get(channel)
    if (cached) return cached
    const provider = this.build(channel)
    this.cache.set(channel, provider)
    return provider
  }

  private build(channel: MessageChannel): DeliveryProvider {
    // Our own inbox — no external transport, so simulation is meaningless.
    if (channel === 'PORTAL' || channel === 'IN_APP') {
      return new PortalDeliveryProvider(channel)
    }

    if (MessagingConfig.forceSimulation) {
      return new DevNoopProvider(channel, 'MESSAGING_SIMULATE is on')
    }

    const real = this.realProviderFor(channel)
    if (real?.isConfigured) return real

    if (process.env.NODE_ENV === 'production') {
      // Return a provider that throws on every send rather than one that lies.
      // The message goes to FAILED with a clear reason, which is a signal;
      // silently "sending" nothing is not.
      return new UnconfiguredProvider(channel)
    }

    return new DevNoopProvider(channel, `no ${channel} provider configured`)
  }

  private realProviderFor(channel: MessageChannel): DeliveryProvider | null {
    switch (channel) {
      case 'SMS':      return new SmsDeliveryProvider(this.sms)
      case 'WHATSAPP': return new WhatsAppDeliveryProvider()
      case 'EMAIL':    return new EmailDeliveryProvider()
      default:         return null
    }
  }
}

/** Production stand-in for a channel with no credentials. Always fails. */
class UnconfiguredProvider implements DeliveryProvider {
  readonly isConfigured = false
  constructor(readonly channel: MessageChannel) {}
  get name(): string { return `unconfigured:${this.channel}` }
  async send(): Promise<never> {
    // Permanent: retrying will not conjure credentials, and five retries per
    // message would turn a config mistake into a queue flood.
    const { DeliveryError } = await import('./providers/delivery-provider.interface')
    throw DeliveryError.permanent(`No provider configured for channel ${this.channel}`)
  }
}
