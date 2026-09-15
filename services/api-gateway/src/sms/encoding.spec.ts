/**
 * The alphabet an SMS gets sent in.
 *
 * This exists because of a real message: the first OTP this system delivered
 * arrived as `???` with the digits intact. Vonage had been asked for GSM-7 —
 * its default — and GSM-7 has no Hebrew, so the provider substituted rather
 * than failed.
 */
import { isGsm7, planSmsEncoding } from './encoding'

describe('SMS alphabet selection', () => {
  /** The exact string `SmsService.sendOtp` builds. */
  const OTP_TEXT = 'קוד האימות שלך: 123456'

  describe('the message that actually broke', () => {
    it('sends the Hebrew OTP as unicode, not GSM-7', () => {
      // Had this returned 'text', the recipient would read "???: 123456".
      expect(planSmsEncoding(OTP_TEXT).type).toBe('unicode')
    })

    it('fits the Hebrew OTP in one segment', () => {
      expect(planSmsEncoding(OTP_TEXT).segments).toBe(1)
    })

    it('recognises Hebrew as outside GSM-7 at all', () => {
      expect(isGsm7('קוד האימות שלך')).toBe(false)
      expect(isGsm7('ש')).toBe(false)
    })
  })

  describe('GSM-7 is kept when it is genuinely enough', () => {
    it('does not upgrade a plain English message', () => {
      // UCS-2 halves the allowance, so upgrading unnecessarily doubles cost.
      const plan = planSmsEncoding('Your verification code is 123456')
      expect(plan.type).toBe('text')
      expect(plan.segments).toBe(1)
    })

    it('accepts the accented and Greek characters GSM-7 really contains', () => {
      expect(isGsm7('Éàüñ ΔΦΓΛΩ £¥§¿¡')).toBe(true)
    })

    it('rejects characters that merely look safe', () => {
      expect(isGsm7('curly ’quotes’')).toBe(false)   // not the ASCII apostrophe
      expect(isGsm7('em — dash')).toBe(false)
      expect(isGsm7('emoji 🙂')).toBe(false)
    })
  })

  describe('segment boundaries', () => {
    it('holds 160 GSM-7 characters in one segment and splits at 161', () => {
      expect(planSmsEncoding('a'.repeat(160)).segments).toBe(1)
      // Splitting costs header room, so the allowance drops to 153 per part.
      const plan = planSmsEncoding('a'.repeat(161))
      expect(plan.segments).toBe(2)
      expect(plan.perSegment).toBe(153)
    })

    it('holds 70 Hebrew characters in one segment and splits at 71', () => {
      expect(planSmsEncoding('א'.repeat(70)).segments).toBe(1)
      const plan = planSmsEncoding('א'.repeat(71))
      expect(plan.segments).toBe(2)
      expect(plan.perSegment).toBe(67)
    })

    it('charges two septets for an extension-table character', () => {
      // `€` is reachable only behind an ESC, so 80 of them are 160 septets.
      expect(planSmsEncoding('€'.repeat(80)).segments).toBe(1)
      expect(planSmsEncoding('€'.repeat(81)).segments).toBe(2)
    })

    it('counts an astral character as two UCS-2 units', () => {
      expect(planSmsEncoding('🙂'.repeat(35)).length).toBe(70)
      expect(planSmsEncoding('🙂'.repeat(35)).segments).toBe(1)
      expect(planSmsEncoding('🙂'.repeat(36)).segments).toBe(2)
    })
  })

  describe('the signing reminder, which carries a URL', () => {
    it('reports the real cost of a Hebrew message with a long link', () => {
      const text = `תזכורת לחתימה: https://portal.example.com/sign/${'a'.repeat(60)}`
      const plan = planSmsEncoding(text)
      expect(plan.type).toBe('unicode')
      // Worth knowing: this is billed as more than one message.
      expect(plan.segments).toBeGreaterThan(1)
    })
  })
})
