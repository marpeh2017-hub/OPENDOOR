import { Injectable, Logger } from '@nestjs/common'
import { SmsProvider, SmsProviderName } from './sms.interface'
import { normaliseIsraeliPhone } from '../messaging/phone'
import { MessagingConfig } from '../messaging/messaging.config'
import { planSmsEncoding } from './encoding'

/** `+972501234567` → `*********567`. Never log a full subscriber number. */
export function maskPhone(phone: string): string {
  if (!phone) return '****'
  return phone.slice(-4).padStart(phone.length, '*')
}

/**
 * SMS transport.
 *
 * Provider detection is by environment variable, in a fixed precedence, and it
 * happens ONCE at construction. This is the pattern the rest of the messaging
 * layer builds on rather than duplicates: `SmsDeliveryProvider` in
 * `src/messaging/providers/` wraps this service instead of re-implementing
 * Vonage/Twilio/Inforu clients.
 *
 * `sendText` is now the primitive and `sendOtp` is a wrapper over it. The OTP
 * path keeps its own guarantee — the code value is never logged, never put in
 * an error message, and in development nothing is transmitted at all.
 *
 * ── TWO THINGS `sendText` DOES BEFORE ANY PROVIDER SEES A NUMBER ────────────
 *
 * Both were missing, and both were found by tracing the OTP path rather than
 * the messaging pipeline — the pipeline had them and the OTP path did not,
 * because the OTP callers reach this service DIRECTLY instead of going through
 * `ProviderRegistryService`.
 *
 *   1. NORMALISATION. `sendOtp('0548018613', …)` handed a provider a local
 *      Israeli number with a leading zero. Vonage wants E.164. The messaging
 *      pipeline was fine because `ResidentContactService` normalises on the way
 *      in; nothing normalised for OTP, so the one message that matters most
 *      would have been the one that failed.
 *
 *   2. SIMULATION. This service never read `MESSAGING_SIMULATE`. Only the
 *      provider registry did, and the OTP callers bypass it — so the flag that
 *      everyone treats as "nothing leaves the building" did not cover portal
 *      login, signature OTPs or signing reminders. Nothing had gone out only
 *      because no provider was configured; the day credentials were added,
 *      every one of those would have become a real, charged message.
 *
 * That second one is the same shape as the incident that sent 24 real messages
 * during the 2026-09-09 audit. The fix made then covered the pipeline. This
 * covers the rest.
 */
/**
 * The Vonage rejection codes worth explaining rather than echoing.
 *
 * Only the ones whose fix is not obvious from the text Vonage returns. `29`
 * in particular reads as a permissions error and is really an account state:
 * a trial account may only message numbers you have verified with Vonage.
 */
const VONAGE_STATUS_HINTS: Record<string, string> = {
  '4':  ' — check VONAGE_API_KEY and VONAGE_API_SECRET.',
  '9':  ' — the account is out of credit.',
  '11': ' — SMS is not enabled on this Vonage account.',
  '12': ' — the message is longer than the provider accepts.',
  '15': ' — VONAGE_FROM is not a sender ID this destination accepts. Israeli' +
        ' networks reject most alphanumeric sender IDs.',
  '29': ' — the destination is not on the allow-list of a TRIAL account.' +
        ' Verify the number in the Vonage dashboard, or upgrade the account.',
  '33': ' — the number is deactivated.',
}

@Injectable()
export class SmsService implements SmsProvider {
  private readonly logger = new Logger(SmsService.name)
  private readonly provider: SmsProviderName

  constructor() {
    if (process.env.VONAGE_API_KEY) this.provider = 'vonage'
    else if (process.env.TWILIO_ACCOUNT_SID) this.provider = 'twilio'
    else if (process.env.INFORU_USERNAME) this.provider = 'inforu'
    else {
      this.provider = 'none'
      this.logger.warn('No SMS provider configured — OTP will not be delivered')
    }
  }

  /** Which provider was selected. Read by the messaging provider registry. */
  get providerName(): SmsProviderName { return this.provider }

  /** True when a real transport exists. */
  get isConfigured(): boolean { return this.provider !== 'none' }

  async sendOtp(phone: string, otp: string): Promise<void> {
    // The OTP value is passed straight to the transport and never touched by
    // any logging path on the way.
    return this.sendText(phone, `קוד האימות שלך: ${otp}`, { isOtp: true })
  }

  async sendText(phone: string, text: string, opts?: { isOtp?: boolean }): Promise<void> {
    /*
     * ── E.164, or a loud refusal ────────────────────────────────────────────
     *
     * Every provider below wants an international number. A local `05…` is not
     * a smaller problem than a missing one: the provider may accept it, charge
     * for it, and report success for a message nobody receives.
     *
     * A LANDLINE is refused for the same reason and is worth calling out
     * separately — an SMS to a landline is a charge with a guaranteed silence
     * at the other end, and `normaliseIsraeliPhone` already knows the
     * difference.
     */
    const normalised = normaliseIsraeliPhone(phone)
    if (!normalised.e164) {
      throw new Error(
        `Cannot send SMS: ${maskPhone(phone)} is not a usable Israeli number (${normalised.reason ?? 'unparseable'})`,
      )
    }
    if (!normalised.isMobile) {
      throw new Error(`Cannot send SMS: ${maskPhone(phone)} is not a mobile number`)
    }
    const to = normalised.e164

    /*
     * ── The simulation flag now means what it says ──────────────────────────
     *
     * Checked HERE rather than only in the provider registry, because the OTP
     * callers never reach the registry. `MESSAGING_SIMULATE=true` now stops
     * every outbound message this process can produce, including the ones that
     * carry a login code.
     */
    if (this.shouldSimulate(to)) {
      this.logger.log(
        `[SIMULATED SMS] → ${maskPhone(to)} (${text.length} chars) — nothing was transmitted ` +
        '(MESSAGING_SIMULATE is on)',
      )
      return
    }

    switch (this.provider) {
      case 'vonage':  return this.sendVonage(to, text)
      case 'twilio':  return this.sendTwilio(to, text)
      case 'inforu':  return this.sendInforu(to, text)
      default:
        if (process.env.NODE_ENV === 'production') {
          throw new Error('No SMS provider configured in production — cannot send SMS')
        }
        // Development mode — never log the message body when it carries an OTP,
        // and never log the full number in either case.
        this.logger.warn(
          opts?.isOtp
            ? `[DEV] SMS not sent to ${maskPhone(to)} — configure SMS provider`
            : `[DEV] SMS not sent to ${maskPhone(to)} (${text.length} chars) — configure SMS provider`,
        )
        return
    }
  }

  /**
   * Whether this particular message should be simulated.
   *
   * ── WHY THERE IS AN EXCEPTION LIST AT ALL ────────────────────────────────
   *
   * Verifying that SMS actually works needs exactly one real message. The
   * obvious way to get it — switch `MESSAGING_SIMULATE` off for a minute — is
   * the way that produced the 2026-09-09 incident: the flag is global, the
   * outbox worker polls every five seconds, and everything queued goes out
   * with it. Twenty-four messages, no window to cancel.
   *
   * `MESSAGING_SIMULATE_EXCEPT` names the numbers that may receive a real
   * message WHILE simulation stays on for everything else. It is deliberately
   * an allow-list of specific numbers rather than a boolean: you have to write
   * down whose phone is about to ring.
   *
   * It does not open the outbox worker. When simulation is on, the dispatcher
   * resolves `DevNoopProvider` through the provider registry and never reaches
   * this service at all — so this affects only the direct callers, which are
   * the OTP paths, which is exactly the thing worth testing.
   *
   * IGNORED IN PRODUCTION, loudly. In production `MESSAGING_SIMULATE` is false
   * and required to be set explicitly, so an exception list there could only
   * mean somebody had copied a development `.env`.
   */
  private shouldSimulate(e164: string): boolean {
    if (!MessagingConfig.forceSimulation) return false

    const exceptions = (process.env.MESSAGING_SIMULATE_EXCEPT ?? '')
      .split(',')
      .map((raw) => normaliseIsraeliPhone(raw.trim()).e164)
      .filter((v): v is string => Boolean(v))

    if (exceptions.length === 0) return true

    if (process.env.NODE_ENV === 'production') {
      this.logger.error(
        'MESSAGING_SIMULATE_EXCEPT is set in production and is being ignored. ' +
        'It exists so a development machine can send one deliberate test message.',
      )
      return true
    }

    if (!exceptions.includes(e164)) return true

    this.logger.warn(
      `SENDING A REAL SMS to ${maskPhone(e164)} — this number is listed in ` +
      'MESSAGING_SIMULATE_EXCEPT. Everything else is still simulated.',
    )
    return false
  }

  private async sendVonage(phone: string, text: string): Promise<void> {
    let Vonage: any
    try {
      ({ Vonage } = await import('@vonage/server-sdk' as any))
    } catch {
      throw new Error('Install @vonage/server-sdk to use Vonage SMS')
    }
    const vonage = new Vonage({
      apiKey:    process.env.VONAGE_API_KEY!,
      apiSecret: process.env.VONAGE_API_SECRET!,
    })
    /*
     * ── THE ALPHABET IS NOT OPTIONAL ────────────────────────────────────────
     *
     * Vonage defaults `type` to `text`, which means GSM 03.38 — an alphabet
     * with no Hebrew in it. It does not reject a Hebrew message typed that
     * way; it substitutes, and every character lands as `?`. The first real
     * OTP this system sent arrived exactly like that: the digits survived,
     * the Hebrew around them did not.
     *
     * `planSmsEncoding` picks the alphabet from the message itself rather
     * than pinning `unicode` on, because UCS-2 halves the segment allowance
     * (70 instead of 160) and would make every English message cost double.
     */
    const plan = planSmsEncoding(text)

    if (plan.segments > 1) {
      // Worth saying out loud: this is billed per part, and a Hebrew message
      // crosses the line at 70 characters rather than 160.
      this.logger.warn(
        `SMS to ${maskPhone(phone)} is ${plan.length} ${plan.type === 'unicode' ? 'characters' : 'septets'} ` +
        `and will be sent as ${plan.segments} segments (${plan.perSegment} per segment, ${plan.type}) — billed as ${plan.segments} messages`,
      )
    }

    const result = await vonage.sms.send({
      to:   phone,
      from: process.env.VONAGE_FROM ?? 'OpenDoor',
      text,
      type: plan.type,
    })

    /*
     * ── AND THE RESULT IS NOT OPTIONAL EITHER ───────────────────────────────
     *
     * This call used to be awaited and discarded. Vonage does not throw on a
     * rejected message — it resolves with `messages[0].status`, where '0' is
     * the only success. Every message this repository sent before today was
     * REJECTED, and the only reason anybody found out was that someone opened
     * the Vonage dashboard and looked.
     *
     * A send that cannot fail is a send that cannot be trusted to have worked,
     * which also means the encoding fix above could not be verified without
     * this one.
     */
    const outcome = result?.messages?.[0]
    if (!outcome || outcome.status !== '0') {
      const status = outcome?.status ?? 'no response'
      const detail = outcome?.errorText ?? 'no detail returned'
      // The message body never enters this error: on the OTP path it carries
      // the code, and errors travel into logs and trackers.
      throw new Error(
        `Vonage rejected the SMS to ${maskPhone(phone)} — status ${status}: ${detail}` +
        (VONAGE_STATUS_HINTS[status] ?? ''),
      )
    }
  }

  private async sendTwilio(phone: string, text: string): Promise<void> {
    let twilio: any
    try {
      twilio = await import('twilio' as any)
    } catch {
      throw new Error('Install twilio to use Twilio SMS')
    }
    const client = twilio.default(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    )
    await client.messages.create({
      to:   phone,
      from: process.env.TWILIO_FROM!,
      body: text,
    })
  }

  private async sendInforu(phone: string, text: string): Promise<void> {
    const url = 'https://api.inforu.co.il/SendMessageXml.ashx'
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Inforu><User><Username>${process.env.INFORU_USERNAME}</Username><ApiKey>${process.env.INFORU_API_KEY}</ApiKey></User><Content Type="sms"><Message>${text}</Message></Content><Recipients><PhoneNumber>${phone}</PhoneNumber></Recipients></Inforu>`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `InforuXML=${encodeURIComponent(xml)}`,
    })
    if (!resp.ok) throw new Error(`Inforu error: ${resp.status}`)
  }
}
