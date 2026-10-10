import { FormLinkSender } from './form-link.sender'
import type { SmsService } from '../sms/sms.service'
import type { SigningEmailSender } from '../signatures/signing-email.sender'

const LINK = { url: 'https://portal.example/he/sign/abc', compoundName: 'מתחם א', reminder: false }

function sender(opts: { smsConfigured: boolean; smsFails?: boolean; emailFails?: boolean }) {
  const sms = {
    isConfigured: opts.smsConfigured,
    sendText: jest.fn(async () => {
      if (opts.smsFails) throw new Error('provider down')
    }),
  }
  const email = {
    sendText: jest.fn(async () => {
      if (opts.emailFails) throw new Error('provider down')
    }),
  }
  return {
    links: new FormLinkSender(sms as unknown as SmsService, email as unknown as SigningEmailSender),
    sms,
    email,
  }
}

describe('FormLinkSender', () => {
  it('sends an SMS to a mobile when there is an SMS provider', async () => {
    const { links, sms, email } = sender({ smsConfigured: true })
    await expect(links.send({ fullName: 'א', phone: '050-1234567', email: 'a@example.com' }, LINK)).resolves.toBe('SMS')
    expect(sms.sendText).toHaveBeenCalledWith('050-1234567', expect.stringContaining(LINK.url))
    expect(email.sendText).not.toHaveBeenCalled()
  })

  it('uses email when there is no SMS provider', async () => {
    const { links, sms } = sender({ smsConfigured: false })
    await expect(links.send({ fullName: 'א', phone: '050-1234567', email: 'a@example.com' }, LINK)).resolves.toBe('EMAIL')
    expect(sms.sendText).not.toHaveBeenCalled()
  })

  it('leaves a mobile-only owner for WhatsApp when there is no SMS provider', async () => {
    const { links } = sender({ smsConfigured: false })
    await expect(links.send({ fullName: 'א', phone: '050-1234567', email: null }, LINK)).resolves.toBe('UNSENT')
  })

  it('marks an owner with no mobile and no email for signing on paper', async () => {
    const { links } = sender({ smsConfigured: true })
    await expect(links.send({ fullName: 'א', phone: '02-6234567', email: null }, LINK)).resolves.toBe('NONE')
  })

  it('falls back from a failed SMS to email, and is FAILED when nothing went', async () => {
    const both = sender({ smsConfigured: true, smsFails: true })
    await expect(both.links.send({ fullName: 'א', phone: '050-1234567', email: 'a@example.com' }, LINK)).resolves.toBe('EMAIL')
    const none = sender({ smsConfigured: true, smsFails: true })
    await expect(none.links.send({ fullName: 'א', phone: '050-1234567', email: null }, LINK)).resolves.toBe('FAILED')
  })

  it('writes the WhatsApp message and opens it on the owner’s number', () => {
    const { links } = sender({ smsConfigured: false })
    const message = links.whatsApp({ fullName: 'ישראל', phone: '050-1234567', email: null }, LINK)
    expect(message.text).toContain('שלום ישראל')
    expect(message.text).toContain(LINK.url)
    expect(message.url).toBe(`https://wa.me/972501234567?text=${encodeURIComponent(message.text)}`)
    expect(links.whatsApp({ fullName: 'ישראל', phone: null, email: null }, LINK).url).toBeNull()
  })
})
