import { randomUUID } from 'crypto'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { EmailDeliveryProvider } from '../messaging/providers/email-delivery.provider'

/**
 * Sends a resident's portal sign-in code by email.
 *
 * The email counterpart of `SmsService.sendOtp`, with the same three rules:
 *
 *   - The code is handed to the transport and nothing else: no log line, in
 *     any environment, carries it. A development machine logs that a code
 *     was not sent, to a masked address, and that is all.
 *   - Without a provider, production refuses (503) instead of answering
 *     "sent" for a message that never left. Development simulates.
 *   - It sends directly, not through the messaging queue: a sign-in code is
 *     needed in the next minute, and the dispatcher polls on an interval.
 *
 * The provider is the messaging one (`EmailDeliveryProvider`: Resend or
 * SendGrid by whichever key is set, from `EMAIL_FROM`), so the portal needs no
 * email configuration of its own.
 */
@Injectable()
export class EmailOtpSender {
  private readonly logger = new Logger(EmailOtpSender.name)
  private readonly provider = new EmailDeliveryProvider()

  /**
   * Refuses up front when nothing could be sent. Called before the resident
   * lookup, so a missing provider answers the same for every address and the
   * failure cannot tell a registered one from an unknown one.
   */
  assertReady(): void {
    if (this.provider.isConfigured || process.env.NODE_ENV !== 'production') return
    this.logger.error('No email provider configured in production: portal sign-in by email is unavailable')
    throw new ServiceUnavailableException({
      code: 'EMAIL_UNAVAILABLE',
      message: 'כניסה עם אימייל אינה זמינה כרגע. אפשר להיכנס עם מספר הטלפון.',
    })
  }

  async send(email: string, code: string): Promise<void> {
    if (!this.provider.isConfigured) {
      this.assertReady()
      this.logger.warn(`[DEV] Sign-in code not emailed to ${maskEmail(email)}: configure an email provider`)
      return
    }
    await this.provider.send({
      messageId: randomUUID(),
      channel: 'EMAIL',
      toEmail: email,
      subject: 'קוד הכניסה שלכם לאזור האישי',
      body:
        `קוד הכניסה שלכם לאזור האישי של OpenDoor: ${code}\n\n` +
        'הקוד תקף לחמש דקות. אם לא ביקשתם להיכנס, אפשר להתעלם מההודעה.',
    })
  }
}

/** `michael@example.com` → `m***@example.com`. Enough to recognise, not to read. */
export function maskEmail(email: string | undefined): string {
  if (!email) return '***'
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email[0]}***${email.slice(at)}`
}
