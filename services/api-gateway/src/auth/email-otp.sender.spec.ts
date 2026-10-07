/**
 * The portal's email code sender, without a provider configured: production
 * refuses, development simulates, and no log line ever carries the code.
 */
import { Logger, ServiceUnavailableException } from '@nestjs/common'
import { EmailOtpSender, maskEmail } from './email-otp.sender'

const SAVED = { ...process.env }
beforeEach(() => {
  delete process.env.RESEND_API_KEY
  delete process.env.SENDGRID_API_KEY
  delete process.env.EMAIL_FROM
})
afterEach(() => {
  process.env = { ...SAVED }
  jest.restoreAllMocks()
})

describe('EmailOtpSender without a provider', () => {
  it('refuses in production, before anything is looked up or sent', async () => {
    process.env.NODE_ENV = 'production'
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const sender = new EmailOtpSender()
    expect(() => sender.assertReady()).toThrow(ServiceUnavailableException)
    await expect(sender.send('rachel@example.com', '123456')).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('simulates in development, naming a masked address and never the code', async () => {
    process.env.NODE_ENV = 'development'
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const sender = new EmailOtpSender()
    expect(() => sender.assertReady()).not.toThrow()
    await expect(sender.send('rachel@example.com', '493817')).resolves.toBeUndefined()
    const logged = warn.mock.calls.map((call) => String(call[0])).join('\n')
    expect(logged).toContain('r***@example.com')
    expect(logged).not.toContain('493817')
    expect(logged).not.toContain('rachel@')
  })
})

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('michael@example.com')).toBe('m***@example.com')
  })

  it('masks what is not an address at all', () => {
    expect(maskEmail(undefined)).toBe('***')
    expect(maskEmail('@example.com')).toBe('***')
    expect(maskEmail('no-at-sign')).toBe('***')
  })
})
