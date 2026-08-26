import { Injectable, Logger } from '@nestjs/common'
import { SmsProvider, SmsProviderName } from './sms.interface'

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
 */
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
    switch (this.provider) {
      case 'vonage':  return this.sendVonage(phone, text)
      case 'twilio':  return this.sendTwilio(phone, text)
      case 'inforu':  return this.sendInforu(phone, text)
      default:
        if (process.env.NODE_ENV === 'production') {
          throw new Error('No SMS provider configured in production — cannot send SMS')
        }
        // Development mode — never log the message body when it carries an OTP,
        // and never log the full number in either case.
        this.logger.warn(
          opts?.isOtp
            ? `[DEV] SMS not sent to ${maskPhone(phone)} — configure SMS provider`
            : `[DEV] SMS not sent to ${maskPhone(phone)} (${text.length} chars) — configure SMS provider`,
        )
        return
    }
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
    await vonage.sms.send({
      to:   phone,
      from: process.env.VONAGE_FROM ?? 'OpenDoor',
      text,
    })
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
