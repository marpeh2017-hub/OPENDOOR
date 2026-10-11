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

/**
 * What a message says about the form behind the link. The protocol's texts
 * are the ones owners have had since 2026-10-10; the agreement asks for a
 * signature the same way; the notice invites, with the date and the hour.
 */
export interface LinkCopy {
  compoundName: string
  /** The stored form type; absent means the protocol. */
  formType?: string | null
  /** The notice's assembly, as it prints: dd.mm.yyyy and HH:MM. */
  when?: { date: string; time: string; place: string }
  /** The apartment a signing link is for ("דירה 5"), set only for an owner
   *  of several apartments, who gets a link for each. */
  unit?: string
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
    link: LinkCopy & { url: string; reminder: boolean },
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
  whatsApp(target: LinkTarget, link: LinkCopy & { url: string }): { text: string; url: string | null } {
    const text = `שלום ${target.fullName}, ${invitation(link, false)} ${action(link)}: ${link.url}`
    const phone = normaliseIsraeliPhone(target.phone)
    const url = phone.e164 && phone.isMobile
      ? `https://wa.me/${phone.e164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
      : null
    return { text, url }
  }
}

/** One sentence on what is waiting: the protocol's, the agreement's, or the notice's invitation. */
function invitation(link: LinkCopy, reminder: boolean): string {
  if (link.formType === 'ASSEMBLY_NOTICE') {
    const when = link.when ? ` ב־${link.when.date} בשעה ${link.when.time}` : ''
    return reminder
      ? `תזכורת: כינוס בעלי הדירות של ${link.compoundName}${when}.`
      : `הוזמנתם לכינוס בעלי הדירות של ${link.compoundName}${when}.`
  }
  const what = link.formType === 'ORGANIZING_AGREEMENT' ? 'ההסכם לארגון וליווי' : 'פרוטוקול מינוי הנציגות'
  return reminder
    ? `תזכורת: ${what} של ${link.compoundName} עדיין ממתין לחתימתכם${unitOf(link)}.`
    : `${what} של ${link.compoundName} ממתין לחתימתכם${unitOf(link)}.`
}

/** " (דירה 5)" after "ממתין לחתימתכם", for an owner with a link per apartment. */
function unitOf(link: LinkCopy): string {
  return link.unit ? ` (${link.unit})` : ''
}

function action(link: LinkCopy): string {
  return link.formType === 'ASSEMBLY_NOTICE' ? 'ההודעה המלאה וסדר היום' : 'לקריאה ולחתימה'
}

function smsText(link: LinkCopy & { url: string; reminder: boolean }): string {
  if (!link.formType || link.formType === 'REPRESENTATION_PROTOCOL') {
    return link.reminder
      ? `OpenDoor: תזכורת: פרוטוקול מינוי הנציגות של ${link.compoundName} עדיין ממתין לחתימתכם${unitOf(link)}: ${link.url}`
      : `OpenDoor: פרוטוקול מינוי הנציגות של ${link.compoundName} ממתין לחתימתכם${unitOf(link)}. לקריאה ולחתימה: ${link.url}`
  }
  return `OpenDoor: ${invitation(link, link.reminder)} ${action(link)}: ${link.url}`
}

function emailSubject(link: LinkCopy & { reminder: boolean }): string {
  const what =
    link.formType === 'ASSEMBLY_NOTICE'
      ? 'הודעה על כינוס בעלי דירות'
      : link.formType === 'ORGANIZING_AGREEMENT'
        ? 'הסכם לארגון וליווי לחתימה'
        : 'פרוטוקול מינוי נציגות לחתימה'
  return `${link.reminder ? 'תזכורת: ' : ''}${what}: ${link.compoundName}`
}

function emailLines(target: LinkTarget, link: LinkCopy & { url: string; reminder: boolean }): string[] {
  let opening: string
  if (link.formType === 'ASSEMBLY_NOTICE') {
    opening = invitation(link, link.reminder)
  } else if (link.formType === 'ORGANIZING_AGREEMENT') {
    opening = link.reminder
      ? `זו תזכורת: ההסכם לארגון וליווי עסקת פינוי בינוי של ${link.compoundName} עדיין ממתין לחתימתכם.`
      : `נשלח אליכם לחתימה ההסכם לארגון וליווי עסקת פינוי בינוי של ${link.compoundName}.`
  } else {
    opening = link.reminder
      ? `זו תזכורת: פרוטוקול מינוי נציגות בעלי הדירות של ${link.compoundName} עדיין ממתין לחתימתכם.`
      : `נשלח אליכם לחתימה פרוטוקול מינוי נציגות בעלי הדירות של ${link.compoundName}.`
  }
  return [
    `שלום ${target.fullName},`,
    '',
    opening,
    ...(link.formType === 'ASSEMBLY_NOTICE' && link.when?.place ? [`מקום הכינוס: ${link.when.place}`] : []),
    ...(link.unit ? [`הקישור הזה הוא לחתימתכם כבעלים של ${link.unit}. על כל דירה שבבעלותכם נשלח קישור נפרד.`] : []),
    '',
    `${action(link)}: ${link.url}`,
    '',
    'הקישור אישי, ואין להעבירו לאחרים. בכל שאלה: 054-8018613.',
    '',
    'OpenDoor Group',
  ]
}
