import { Logger } from '@nestjs/common'
import type { MessageChannel } from '@prisma/client'
import { MessagingConfig } from '../messaging.config'
import { sanitiseProviderDetail } from '../sanitise'
import { DeliveryError } from './delivery-provider.interface'
import type { DeliveryProvider, DeliveryResult, OutboundPayload } from './delivery-provider.interface'

/**
 * WhatsApp via the Meta Cloud API.
 *
 * Detection follows the same shape as `SmsService`: presence of the credential
 * pair decides whether this provider is usable, and the registry falls back to
 * the no-op provider when it is not.
 *
 * PRODUCT NOTE (needs a decision — see the report): outside a 24-hour customer
 * service window Meta only permits pre-approved TEMPLATE messages, not free
 * text. This implementation sends free text, which is correct for a reply
 * inside an open window and will be rejected by Meta otherwise. Template
 * registration and a template-vs-freeform selector are not built here because
 * the template catalogue is a business artefact that does not exist yet.
 */
export class WhatsAppDeliveryProvider implements DeliveryProvider {
  private readonly logger = new Logger('WhatsAppDeliveryProvider')
  readonly name = 'whatsapp:meta-cloud'
  readonly channel: MessageChannel = 'WHATSAPP'

  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v21.0'

  get isConfigured(): boolean {
    return Boolean(this.phoneNumberId && this.accessToken)
  }

  async send(payload: OutboundPayload): Promise<DeliveryResult> {
    if (!this.isConfigured) {
      throw DeliveryError.permanent('WhatsApp provider is not configured')
    }
    if (!payload.toPhone) {
      throw DeliveryError.permanent('WhatsApp message has no destination phone number')
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MessagingConfig.providerTimeoutMs)

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          // The token is in a header and nowhere else — never in a log, never
          // in the URL, never in the error path (see the catch below).
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: payload.toPhone.replace(/[^\d]/g, ''),
          type: 'text',
          text: { preview_url: false, body: payload.body },
        }),
        signal: controller.signal,
      })

      // The response body is read but never logged raw — it echoes the
      // recipient number and, on error, sometimes the request payload.
      const json = (await resp.json().catch(() => ({}))) as any

      if (!resp.ok) {
        const detail = sanitiseProviderDetail({
          status: resp.status,
          code: json?.error?.code,
          message: json?.error?.message,
        })
        // 4xx other than 429 is Meta telling us the request is wrong; retrying
        // an identical wrong request cannot help.
        if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
          throw DeliveryError.permanent(detail, String(resp.status))
        }
        throw DeliveryError.transient(detail, String(resp.status))
      }

      const providerMessageId: string | null = json?.messages?.[0]?.id ?? null
      return { providerMessageId, simulated: false }
    } catch (err) {
      if (err instanceof DeliveryError) throw err
      // Network failure or timeout — transient by definition.
      throw DeliveryError.transient(sanitiseProviderDetail(err))
    } finally {
      clearTimeout(timer)
    }
  }
}
