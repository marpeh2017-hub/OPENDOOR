export interface SmsProvider {
  sendOtp(phone: string, otp: string): Promise<void>
  /**
   * Sends arbitrary text. `sendOtp` is a thin wrapper over this that adds the
   * Hebrew OTP framing — the two are kept separate so the OTP path keeps its
   * "never log the value" guarantee even as general messaging grows around it.
   */
  sendText(phone: string, text: string): Promise<void>
}

/** Which provider `SmsService` selected. `'none'` means nothing can be sent. */
export type SmsProviderName = 'vonage' | 'twilio' | 'inforu' | 'none'
