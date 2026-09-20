import { Logger } from '@nestjs/common'
import type { MessageChannel } from '@prisma/client'
import { MessagingConfig } from '../messaging.config'
import { sanitiseProviderDetail } from '../sanitise'
import { DeliveryError } from './delivery-provider.interface'
import type { DeliveryProvider, DeliveryResult, OutboundPayload } from './delivery-provider.interface'

/**
 * Email via a provider HTTP API.
 *
 * HTTP rather than SMTP on purpose: SMTP would mean a long-lived connection,
 * a new dependency, and a delivery result that is "queued to a relay" rather
 * than "the provider accepted it" — and this dispatcher's central rule is that
 * SENT means a provider actually accepted the message.
 *
 * Detection mirrors `SmsService`: first credential found wins. Only providers
 * whose accept-response carries a message id are implemented; anything else
 * would give us a SENT with no way to correlate a delivery webhook.
 */
type EmailBackend = 'resend' | 'sendgrid' | 'none'

export class EmailDeliveryProvider implements DeliveryProvider {
  private readonly logger = new Logger('EmailDeliveryProvider')
  readonly channel: MessageChannel = 'EMAIL'
  private readonly backend: EmailBackend

  constructor() {
    if (process.env.RESEND_API_KEY) this.backend = 'resend'
    else if (process.env.SENDGRID_API_KEY) this.backend = 'sendgrid'
    else this.backend = 'none'
  }

  get name(): string { return `email:${this.backend}` }
  get isConfigured(): boolean { return this.backend !== 'none' && Boolean(this.from) }

  private get from(): string | undefined { return process.env.EMAIL_FROM }

  async send(payload: OutboundPayload): Promise<DeliveryResult> {
    if (!this.isConfigured) throw DeliveryError.permanent('Email provider is not configured')
    if (!payload.toEmail) throw DeliveryError.permanent('Email message has no destination address')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MessagingConfig.providerTimeoutMs)

    try {
      const { url, headers, body, idPath } = this.backend === 'resend'
        ? {
            url: 'https://api.resend.com/emails',
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: {
              from: this.from,
              to: [payload.toEmail],
              subject: payload.subject ?? '(ללא נושא)',
              text: payload.body,
            },
            idPath: (j: any) => j?.id ?? null,
          }
        : {
            url: 'https://api.sendgrid.com/v3/mail/send',
            headers: {
              Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: {
              personalizations: [{ to: [{ email: payload.toEmail }] }],
              from: { email: this.from },
              subject: payload.subject ?? '(ללא נושא)',
              content: [{ type: 'text/plain', value: payload.body }],
            },
            idPath: (_: any, res?: Response) => res?.headers.get('x-message-id') ?? null,
          }

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!resp.ok) {
        // Body read for its status/code fields only, then discarded — a
        // rejected email payload contains the full recipient list and body.
        const json = (await resp.json().catch(() => ({}))) as any
        const detail = sanitiseProviderDetail({
          status: resp.status,
          message: json?.message ?? json?.errors?.[0]?.message,
        })
        if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
          throw DeliveryError.permanent(detail, String(resp.status))
        }
        throw DeliveryError.transient(detail, String(resp.status))
      }

      const json = this.backend === 'resend'
        ? await resp.json().catch(() => ({}))
        : {}
      return { providerMessageId: idPath(json, resp), simulated: false }
    } catch (err) {
      if (err instanceof DeliveryError) throw err
      throw DeliveryError.transient(sanitiseProviderDetail(err))
    } finally {
      clearTimeout(timer)
    }
  }
}
