import { Injectable, Logger } from '@nestjs/common'
import { SmsService, maskPhone } from '../sms/sms.service'
import { normaliseIsraeliPhone } from '../messaging/phone'
import { SigningEmailSender } from '../signatures/signing-email.sender'
import { maskEmail } from '../auth/email-otp.sender'

/** How a personal link went out. NONE: no mobile and no email, so paper. */
export type DeliveryChannel = 'SMS' | 'EMAIL' | 'NONE' | 'FAILED'

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
 * number, else by email, else not at all (NONE), which the tracking screen
 * shows as "להחתמה ידנית". A transport that fails falls through to the next
 * channel; an owner whose every channel failed is FAILED, not NONE, so the
 * difference between "has no phone" and "the SMS did not go" stays visible.
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
    if (target.phone && phone.e164 && phone.isMobile) {
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

    return attempted ? 'FAILED' : 'NONE'
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
