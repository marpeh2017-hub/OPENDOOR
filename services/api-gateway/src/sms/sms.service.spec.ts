/**
 * What `SmsService.sendText` does before any provider sees a number.
 *
 * Both behaviours here were missing, and both were found by tracing the OTP
 * path rather than the messaging pipeline: the pipeline normalises and
 * simulates correctly, and the OTP callers bypass it entirely by reaching
 * `SmsService` directly.
 *
 * No provider is configured in these tests, so `provider` is `'none'` and the
 * switch falls through to the development branch. That is deliberate — every
 * assertion here is about what happens BEFORE a provider is chosen, which is
 * precisely where both defects lived.
 */
import { Logger } from '@nestjs/common'
import { SmsService, maskPhone } from './sms.service'

// The service reaches the SDK through a dynamic import; this intercepts it.
jest.mock('@vonage/server-sdk', () => ({ Vonage: jest.fn() }), { virtual: true })

describe('SmsService — normalisation and simulation', () => {
  const ORIGINAL_ENV = { ...process.env }

  /** Captures what the service logged, so simulation can be observed. */
  let logged: string[]

  beforeEach(() => {
    logged = []
    jest.spyOn(Logger.prototype, 'log').mockImplementation((m) => { logged.push(String(m)) })
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((m) => { logged.push(String(m)) })
    jest.spyOn(Logger.prototype, 'error').mockImplementation((m) => { logged.push(String(m)) })

    // No provider, and simulation off unless a test says otherwise.
    for (const key of ['VONAGE_API_KEY', 'TWILIO_ACCOUNT_SID', 'INFORU_USERNAME',
                       'MESSAGING_SIMULATE', 'MESSAGING_SIMULATE_EXCEPT']) {
      delete process.env[key]
    }
    process.env.NODE_ENV = 'test'
    process.env.MESSAGING_SIMULATE = 'false'
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  const service = () => new SmsService()

  // ── Normalisation ────────────────────────────────────────────────────────

  describe('the number handed to a provider', () => {
    it.each([
      ['0548018613', '+972548018613'],
      ['054-801-8613', '+972548018613'],
      ['+972548018613', '+972548018613'],
      ['972548018613', '+972548018613'],
      ['054 801 8613 (בן)', '+972548018613'],
    ])('normalises %s to %s', async (input, expected) => {
      // With no provider configured the development branch logs the number it
      // WOULD have sent to, which is the normalised one.
      await service().sendText(input, 'שלום')
      expect(logged.join(' ')).toContain(maskPhone(expected))
    })

    it('REFUSES a landline rather than paying to text it', async () => {
      // An SMS to a landline is a charge with a guaranteed silence at the other
      // end. The provider would accept it and report success.
      await expect(service().sendText('03-5098264', 'שלום'))
        .rejects.toThrow(/not a mobile number/)
    })

    it('REFUSES an unusable number loudly', async () => {
      await expect(service().sendText('12345', 'שלום')).rejects.toThrow(/not a usable/)
      await expect(service().sendText('', 'שלום')).rejects.toThrow(/not a usable/)
      await expect(service().sendText('not a phone at all', 'שלום')).rejects.toThrow(/not a usable/)
    })

    it('never puts the full number in the error it throws', async () => {
      // The refusal travels into logs and error trackers.
      await expect(service().sendText('03-5098264', 'שלום'))
        .rejects.toThrow(/\*{4,}8264/)
    })
  })

  // ── Simulation ───────────────────────────────────────────────────────────

  describe('MESSAGING_SIMULATE', () => {
    it('stops an OTP, which it previously did not', async () => {
      /*
       * The defect: `SmsService` never read this flag. Only the provider
       * registry did, and the OTP callers bypass the registry — so portal
       * login, signature OTPs and signing reminders were outside the one
       * switch everybody relies on.
       */
      process.env.MESSAGING_SIMULATE = 'true'
      await service().sendOtp('0548018613', '123456')

      const output = logged.join(' ')
      expect(output).toContain('SIMULATED SMS')
      expect(output).toContain('nothing was transmitted')
    })

    it('never logs the code, simulated or not', async () => {
      process.env.MESSAGING_SIMULATE = 'true'
      await service().sendOtp('0548018613', '987654')
      expect(logged.join(' ')).not.toContain('987654')
    })
  })

  // ── The exception list ───────────────────────────────────────────────────

  describe('MESSAGING_SIMULATE_EXCEPT', () => {
    beforeEach(() => { process.env.MESSAGING_SIMULATE = 'true' })

    it('lets exactly the listed number through, and simulates everyone else', async () => {
      /*
       * Why this exists: verifying SMS works needs one real message, and the
       * obvious way to get it — switching the global flag off for a minute — is
       * what sent 24 messages during the audit, because the outbox worker
       * drains everything queued within five seconds.
       */
      process.env.MESSAGING_SIMULATE_EXCEPT = '0548018613'

      // The listed number: no simulation notice, and a warning that names it.
      await service().sendText('0548018613', 'test')
      expect(logged.join(' ')).toContain('SENDING A REAL SMS')

      logged = []
      // Anybody else: still simulated.
      await service().sendText('0529876543', 'test')
      expect(logged.join(' ')).toContain('SIMULATED SMS')
      expect(logged.join(' ')).not.toContain('SENDING A REAL SMS')
    })

    it('matches on the normalised number, however it was written', async () => {
      process.env.MESSAGING_SIMULATE_EXCEPT = '+972548018613'
      await service().sendText('054-801-8613', 'test')
      expect(logged.join(' ')).toContain('SENDING A REAL SMS')
    })

    it('accepts several numbers', async () => {
      process.env.MESSAGING_SIMULATE_EXCEPT = '0548018613, 0529876543'
      await service().sendText('0529876543', 'test')
      expect(logged.join(' ')).toContain('SENDING A REAL SMS')
    })

    it('an empty or junk list simulates everything', async () => {
      process.env.MESSAGING_SIMULATE_EXCEPT = '   ,  , not-a-number'
      await service().sendText('0548018613', 'test')
      expect(logged.join(' ')).toContain('SIMULATED SMS')
    })

    it('is IGNORED in production, and says so', async () => {
      // There it could only mean somebody copied a development .env.
      process.env.NODE_ENV = 'production'
      process.env.MESSAGING_SIMULATE_EXCEPT = '0548018613'

      await service().sendText('0548018613', 'test')
      const output = logged.join(' ')
      expect(output).toContain('being ignored')
      expect(output).toContain('SIMULATED SMS')
      expect(output).not.toContain('SENDING A REAL SMS')
    })

    it('does nothing when simulation is off — everything is real anyway', async () => {
      process.env.MESSAGING_SIMULATE = 'false'
      process.env.MESSAGING_SIMULATE_EXCEPT = '0529876543'
      await service().sendText('0548018613', 'test')
      // No provider configured, so it falls to the development branch rather
      // than transmitting — but it was never simulated on this path.
      expect(logged.join(' ')).not.toContain('SIMULATED SMS')
    })
  })

  // ── What Vonage is actually handed, and what comes back ──────────────────

  describe('the Vonage call itself', () => {
    /** Captures the payload handed to the SDK. */
    let sent: any[]
    let reply: any

    beforeEach(() => {
      sent = []
      reply = { messages: [{ status: '0', messageId: 'abc' }] }

      const mod = require('@vonage/server-sdk')
      mod.Vonage.mockImplementation(() => ({
        sms: { send: jest.fn(async (payload: any) => { sent.push(payload); return reply }) },
      }))

      // The constructor picks the provider, so this must be set before it runs.
      process.env.VONAGE_API_KEY = 'key'
      process.env.VONAGE_API_SECRET = 'secret'
    })

    it('sends Hebrew as unicode — the bug that made an OTP arrive as ???', async () => {
      await service().sendOtp('0548018613', '123456')

      expect(sent).toHaveLength(1)
      expect(sent[0].type).toBe('unicode')
      // And the body is untouched — the fix is the alphabet, not the text.
      expect(sent[0].text).toContain('קוד האימות שלך')
    })

    it('leaves an English message on GSM-7, which costs half as much', async () => {
      await service().sendText('0548018613', 'Your code is 123456')
      expect(sent[0].type).toBe('text')
    })

    it('sends the number in E.164', async () => {
      await service().sendText('054-801-8613', 'hello')
      expect(sent[0].to).toBe('+972548018613')
    })

    it('THROWS when Vonage rejects, instead of reporting success', async () => {
      /*
       * The old code awaited this call and discarded it. Vonage resolves on a
       * rejection rather than throwing, so every rejected message looked like
       * a delivered one — which is why the encoding bug survived until someone
       * opened the dashboard.
       */
      reply = { messages: [{ status: '6', errorText: 'Invalid message' }] }
      await expect(service().sendText('0548018613', 'שלום'))
        .rejects.toThrow(/Vonage rejected .* status 6: Invalid message/)
    })

    it('explains a trial account rather than echoing status 29', async () => {
      reply = { messages: [{ status: '29', errorText: 'Non-whitelisted destination' }] }
      await expect(service().sendText('0548018613', 'שלום'))
        .rejects.toThrow(/TRIAL account/)
    })

    it('never puts the message body in a rejection error', async () => {
      // On the OTP path the body carries the code, and errors reach logs.
      reply = { messages: [{ status: '6', errorText: 'Invalid message' }] }
      await expect(service().sendOtp('0548018613', '987654'))
        .rejects.toThrow(/^(?!.*987654).*$/s)
    })

    it('treats an empty response as a failure, not a success', async () => {
      reply = {}
      await expect(service().sendText('0548018613', 'שלום'))
        .rejects.toThrow(/no response/)
    })
  })
})
