import type { MessageChannel } from '@prisma/client'

/**
 * What the dispatcher hands a provider. Deliberately NOT a `Message` row — a
 * provider must not be able to read or mutate dispatch bookkeeping, and keeping
 * the payload flat makes it obvious that `tenantId`, `attemptCount` and friends
 * never cross this boundary.
 */
export interface OutboundPayload {
  /** Opaque, for correlation in provider dashboards. Not a secret. */
  readonly messageId: string
  readonly channel: MessageChannel
  /** E.164 phone, for SMS/WhatsApp. */
  readonly toPhone?: string | null
  readonly toEmail?: string | null
  readonly subject?: string | null
  readonly body: string
}

/**
 * A provider's answer.
 *
 * There is no "maybe" here on purpose. Either the provider ACCEPTED the message
 * (resolve) or it did not (throw). `Message.status = SENT` is written on the
 * resolve path only, so a provider that cannot honestly say it accepted the
 * message must throw — see `DeliveryError`.
 */
export interface DeliveryResult {
  /** The provider's id for the message, used to match delivery webhooks. */
  readonly providerMessageId?: string | null
  /**
   * TRUE when nothing actually left the building. Copied to
   * `Message.isSimulated` so a simulated send is distinguishable from a real
   * one in the database, the API, and the CRM — forever, not just in the logs.
   */
  readonly simulated: boolean
}

/**
 * Thrown by a provider when the send did not happen.
 *
 * `retryable` is the whole point of the type. A 500 from Twilio is worth
 * retrying; "this phone number is not a valid mobile" never will be, and
 * retrying it five times just burns quota and delays the FAILED status that
 * tells a human to fix the number.
 */
export class DeliveryError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    /** Provider status/error code, if it gave one. Already sanitised. */
    readonly providerCode?: string | null,
  ) {
    super(message)
    this.name = 'DeliveryError'
  }

  static permanent(message: string, code?: string | null): DeliveryError {
    return new DeliveryError(message, false, code ?? null)
  }

  static transient(message: string, code?: string | null): DeliveryError {
    return new DeliveryError(message, true, code ?? null)
  }
}

/**
 * The one interface every transport implements.
 *
 * Business logic NEVER names a provider. It picks a `MessageChannel`; the
 * registry picks the implementation from configuration. That is what makes
 * "swap Twilio for Inforu" an env-var change rather than a code change, and
 * what makes the dev/no-op provider a first-class citizen rather than an `if
 * (dev)` scattered through the dispatcher.
 */
export interface DeliveryProvider {
  /** Stable identifier persisted to `Message.providerName`. */
  readonly name: string
  readonly channel: MessageChannel
  /** False when credentials are missing; the registry falls back accordingly. */
  readonly isConfigured: boolean
  send(payload: OutboundPayload): Promise<DeliveryResult>
}
