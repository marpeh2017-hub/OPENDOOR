import { Logger } from '@nestjs/common'
import type { MessageChannel } from '@prisma/client'
import { maskPhone } from '../../sms/sms.service'
import { describeBody } from '../sanitise'
import type { DeliveryProvider, DeliveryResult, OutboundPayload } from './delivery-provider.interface'

/**
 * The development / no-op transport.
 *
 * NOTHING LEAVES THE BUILDING. It records what would have been sent and reports
 * success, so the whole pipeline — claim, provider call, SENT, DELIVERED — is
 * exercised end to end without a single real SMS reaching a resident.
 *
 * Two design points that matter more than the eight lines of code suggest:
 *
 *  1. It marks the result `simulated: true`, which the dispatcher persists to
 *     `Message.isSimulated` and stamps into `providerName` as `dev-noop`. That
 *     is a permanent, queryable fact on the row, not a log line that scrolls
 *     away. The CRM renders it as an explicit "לא נשלח באמת" badge, because the
 *     one thing worse than not sending a message is believing you did.
 *
 *  2. It logs the recipient MASKED and the body only by length. A development
 *     log is still a log, and a signing link or an OTP in it is still a leak.
 */
export class DevNoopProvider implements DeliveryProvider {
  private readonly logger = new Logger('DevNoopProvider')
  readonly name = 'dev-noop'
  readonly isConfigured = true

  constructor(readonly channel: MessageChannel, private readonly reason: string) {}

  async send(payload: OutboundPayload): Promise<DeliveryResult> {
    const to = payload.toPhone
      ? maskPhone(payload.toPhone)
      : payload.toEmail
        ? payload.toEmail.replace(/^(.).*(@.*)$/, '$1***$2')
        : '(no address)'

    this.logger.log(
      `[SIMULATED ${payload.channel}] → ${to} (${describeBody(payload.body)}) — ` +
      `nothing was transmitted (${this.reason})`,
    )

    return {
      // Prefixed so it can never be mistaken for a real provider id, and so a
      // stray webhook correlation lookup finds nothing rather than something.
      providerMessageId: `sim_${payload.messageId}`,
      simulated: true,
    }
  }
}
