import { randomUUID } from 'crypto'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { EmailDeliveryProvider } from '../messaging/providers/email-delivery.provider'
import { MessagingConfig } from '../messaging/messaging.config'
import { maskEmail } from '../auth/email-otp.sender'

/**
 * Email for the signing flow: the one-time code when an owner has an email
 * address but no mobile number, and a form's personal link.
 *
 * The rules are the portal sign-in sender's (EmailOtpSender): a code is
 * handed to the transport and to nothing else, production without a
 * provider refuses rather than answering "sent", and development without
 * one logs that nothing went out, to a masked address. It also honours
 * MESSAGING_SIMULATE, as SmsService does, so a development machine with a
 * real key configured still sends nothing while simulation is on.
 */
@Injectable()
export class SigningEmailSender {
  private readonly logger = new Logger(SigningEmailSender.name)
  private readonly provider = new EmailDeliveryProvider()

  get isConfigured(): boolean {
    return this.provider.isConfigured
  }

  async sendCode(email: string, code: string): Promise<void> {
    await this.deliver(email, 'קוד אימות לחתימה', [
      `קוד האימות שלכם לחתימה: ${code}`,
      '',
      'הקוד תקף לחמש דקות. אם לא ביקשתם לחתום, אפשר להתעלם מההודעה.',
    ], { isCode: true })
  }

  async sendText(email: string, subject: string, lines: string[]): Promise<void> {
    await this.deliver(email, subject, lines, { isCode: false })
  }

  private async deliver(email: string, subject: string, lines: string[], opts: { isCode: boolean }) {
    if (MessagingConfig.forceSimulation) {
      this.logger.log(`[SIMULATED EMAIL] → ${maskEmail(email)}: nothing was transmitted (MESSAGING_SIMULATE is on)`)
      return
    }
    if (!this.provider.isConfigured) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException({
          code: 'EMAIL_UNAVAILABLE',
          message: 'שליחת אימייל אינה זמינה כרגע. פנו אלינו בטלפון 054-8018613.',
        })
      }
      this.logger.warn(
        opts.isCode
          ? `[DEV] Signing code not emailed to ${maskEmail(email)}: configure an email provider`
          : `[DEV] Email not sent to ${maskEmail(email)}: configure an email provider`,
      )
      return
    }
    await this.provider.send({
      messageId: randomUUID(),
      channel: 'EMAIL',
      toEmail: email,
      subject,
      body: lines.join('\n'),
    })
  }
}
