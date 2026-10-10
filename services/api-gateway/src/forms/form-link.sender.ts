import { Injectable, Logger } from '@nestjs/common'
import { SmsService, maskPhone } from '../sms/sms.service'
import { normaliseIsraeliPhone } from '../messaging/phone'
import { SigningEmailSender } from '../signatures/signing-email.sender'
import { maskEmail } from '../auth/email-otp.sender'

/**
 * How a personal link went out.
 *   SMS / EMAIL  sent by the system.
 *   WHATSAPP     staff sent it from the CRM on WhatsApp.
 *   UNSENT       the owner has a mobile, but there is no SMS provider and no
 *                email: waiting for staff to send it on WhatsApp.
 *   NONE         no mobile and no email: signing on paper.
 *   FAILED       a transport existed and failed.
 */
export type DeliveryChannel = 'SMS' | 'EMAIL' | 'WHATSAPP' | 'UNSENT' | 'NONE' | 'FAILED'

export interface LinkTarget {
  fullName: string
  phone: string | null
  email: string | null
}

/** The signing page for a token, on the portal. */
export function signingUrl(token: string): string {
  const base = (process.env.PORTAL_URL ?? 'http://localhost:3002').replace(/\/+$/, '')
  return `${base}/he/sign/${token}`
}

/**
 * Sends an owner the personal link to sign a form: by SMS to a mobile
 * number when an SMS provider is configured, else by email, else not at
 * all. Without a provider an owner with a mobile is UNSENT, for staff to
 * send on WhatsApp from the CRM (no provider needed for that), and one with
 * no contact at all is NONE, "להחתמה ידנית". A transport that fails falls
 * through to the next channel; an owner whose every channel failed is
 * FAILED, so "has no phone" and "the SMS did not go" stay different.
 *
 * Both transports honour MESSAGING_SIMULATE. The texts are short on
 * purpose: a Hebrew SMS is billed per 70 characters.
 */
@Injectable()
export class FormLinkSender {
  private readonly logger = new Logger(FormLinkSender.name)

  constructor(
    private readonly sms: SmsService,
    private readonly email: SigningEmailSender,
  ) {}

  async send(
    target: LinkTarget,
    link: { url: string; compoundName: string; reminder: boolean },
  ): Promise<DeliveryChannel> {
    let attempted = false

    const phone = normaliseIsraeliPhone(target.phone)
    const mobile = Boolean(target.phone && phone.e164 && phone.isMobile)
    if (target.phone && mobile && this.sms.isConfigured) {
      attempted = true
      try {
        await this.sms.sendText(target.phone, smsText(link))
        return 'SMS'
      } catch (err) {
        this.logger.warn(`Form link SMS to ${maskPhone(target.phone)} failed: ${(err as Error).message}`)
      }
    }

    if (target.email) {
      attempted = true
      try {
        await this.email.sendText(target.email, emailSubject(link), emailLines(target, link))
        return 'EMAIL'
      } catch (err) {
        this.logger.warn(`Form link email to ${maskEmail(target.email)} failed: ${(err as Error).message}`)
      }
    }

    if (attempted) return 'FAILED'
    return mobile ? 'UNSENT' : 'NONE'
  }

  /**
   * The same invitation as a WhatsApp message, for staff to send from their
   * own phone: the text, and a wa.me address that opens WhatsApp on the
   * owner's number with it written in. No provider and no cost; staff press
   * send. Null address when the owner has no mobile (the text can still be
   * copied).
   */
  whatsApp(target: LinkTarget, link: { url: string; compoundName: string }): { text: string; url: string | null } {
    const text = `שלום ${target.fullName}, פרוטוקול מינוי הנציגות של ${link.compoundName} ממתין לחתימתכם. לקריאה ולחתימה: ${link.url}`
    const phone = normaliseIsraeliPhone(target.phone)
    const url = phone.e164 && phone.isMobile
      ? `https://wa.me/${phone.e164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
      : null
    return { text, url }
  }
}

function smsText(link: { url: string; compoundName: string; reminder: boolean }): string {
  return link.reminder
    ? `OpenDoor: תזכורת: פרוטוקול מינוי הנציגות של ${link.compoundName} עדיין ממתין לחתימתכם: ${link.url}`
    : `OpenDoor: פרוטוקול מינוי הנציגות של ${link.compoundName} ממתין לחתימתכם. לקריאה ולחתימה: ${link.url}`
}

function emailSubject(link: { compoundName: string; reminder: boolean }): string {
  return `${link.reminder ? 'תזכורת: ' : ''}פרוטוקול מינוי נציגות לחתימה: ${link.compoundName}`
}

function emailLines(target: LinkTarget, link: { url: string; compoundName: string; reminder: boolean }): string[] {
  return [
    `שלום ${target.fullName},`,
    '',
    link.reminder
      ? `זו תזכורת: פרוטוקול מינוי נציגות בעלי הדירות של ${link.compoundName} עדיין ממתין לחתימתכם.`
      : `נשלח אליכם לחתימה פרוטוקול מינוי נציגות בעלי הדירות של ${link.compoundName}.`,
    '',
    `לקריאה ולחתימה: ${link.url}`,
    '',
    'הקישור אישי, ואין להעבירו לאחרים. בכל שאלה: 054-8018613.',
    '',
    'OpenDoor Group',
  ]
}
