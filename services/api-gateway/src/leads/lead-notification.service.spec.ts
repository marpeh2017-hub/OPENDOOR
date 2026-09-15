/**
 * The alert that tells the office a lead arrived.
 *
 * The behaviour worth pinning here is mostly about what must NOT happen: the
 * alert must not ring twice for one enquiry, must not take the lead down with
 * it when it fails, and must not leave the lead's details in a metadata field
 * that ends up in exports.
 */
import { Logger } from '@nestjs/common'
import { LeadNotificationService, type LeadAlert } from './lead-notification.service'

describe('LeadNotificationService', () => {
  const ORIGINAL_ENV = { ...process.env }

  let enqueued: any[]
  let logged: string[]
  let outbound: any

  const LEAD: LeadAlert = {
    id: 'lead_1',
    firstName: 'דנה',
    lastName: 'כהן',
    phone: '0521234567',
    email: 'dana@example.com',
    city: 'ירושלים',
    address: 'הרצל 10',
    notes: 'יש לנו נציגות ורוצים לבדוק היתכנות.',
    formType: 'ELIGIBILITY',
  }

  beforeEach(() => {
    enqueued = []
    logged = []
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((m) => { logged.push(String(m)) })
    jest.spyOn(Logger.prototype, 'error').mockImplementation((m) => { logged.push(String(m)) })

    outbound = { enqueue: jest.fn(async (input: any) => { enqueued.push(input); return { id: 'm1' } }) }

    process.env.LEAD_NOTIFY_PHONE = '0548018613'
    delete process.env.LEAD_NOTIFY_CHANNEL
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  const service = () => new LeadNotificationService(outbound)

  describe('the message that reaches the office', () => {
    it('carries the name, the phone and the notes', async () => {
      await service().notify('tnt_1', LEAD)

      expect(enqueued).toHaveLength(1)
      const body = enqueued[0].body
      expect(body).toContain('דנה כהן')
      expect(body).toContain('0521234567')
      expect(body).toContain('יש לנו נציגות')
    })

    it('puts the name and number above the notes, for a lock screen', async () => {
      await service().notify('tnt_1', LEAD)
      const body: string = enqueued[0].body
      expect(body.indexOf('טלפון')).toBeLessThan(body.indexOf('הערות'))
    })

    it('survives a lead with nothing but a name and a number', async () => {
      await service().notify('tnt_1', {
        id: 'lead_2', firstName: 'יוסי', lastName: '', phone: '0501112222',
      })
      const body: string = enqueued[0].body
      expect(body).toContain('יוסי')
      expect(body).toContain('0501112222')
      expect(body).not.toContain('undefined')
      expect(body).not.toContain('null')
    })

    it('truncates a very long message rather than paying for five segments', async () => {
      await service().notify('tnt_1', { ...LEAD, notes: 'א'.repeat(900) })
      expect(enqueued[0].body.length).toBeLessThan(500)
      expect(enqueued[0].body).toContain('…')
    })
  })

  describe('the office is told once', () => {
    it('keys the send on the lead id, so a retry cannot ring twice', async () => {
      await service().notify('tnt_1', LEAD)
      expect(enqueued[0].idempotencyKey).toBe('lead-notify:lead_1')
    })

    it('normalises the office number to E.164', async () => {
      process.env.LEAD_NOTIFY_PHONE = '054-801-8613'
      await service().notify('tnt_1', LEAD)
      expect(enqueued[0].toPhone).toBe('+972548018613')
    })
  })

  describe('the channel', () => {
    it('defaults to WhatsApp', async () => {
      await service().notify('tnt_1', LEAD)
      expect(enqueued[0].channel).toBe('WHATSAPP')
    })

    it('can be set to SMS, which is the one that works today', async () => {
      process.env.LEAD_NOTIFY_CHANNEL = 'sms'
      await service().notify('tnt_1', LEAD)
      expect(enqueued[0].channel).toBe('SMS')
    })

    it('falls back to WhatsApp and says so when the value is nonsense', async () => {
      process.env.LEAD_NOTIFY_CHANNEL = 'CARRIER_PIGEON'
      await service().notify('tnt_1', LEAD)
      expect(enqueued[0].channel).toBe('WHATSAPP')
      expect(logged.join(' ')).toContain('CARRIER_PIGEON')
    })
  })

  describe('it never takes the lead down with it', () => {
    it('does not throw when the outbox rejects the message', async () => {
      // The lead is already committed by the time this runs. Throwing here
      // would report a failure to a visitor whose enquiry was saved.
      outbound.enqueue = jest.fn(async () => { throw new Error('outbox is down') })
      await expect(service().notify('tnt_1', LEAD)).resolves.toBeUndefined()
      expect(logged.join(' ')).toContain('lead_1')
    })

    it('does not put the lead details in the failure log', async () => {
      outbound.enqueue = jest.fn(async () => { throw new Error('outbox is down') })
      await service().notify('tnt_1', LEAD)
      const output = logged.join(' ')
      expect(output).not.toContain('דנה')
      expect(output).not.toContain('0521234567')
    })

    it('skips quietly-but-audibly when no office number is configured', async () => {
      delete process.env.LEAD_NOTIFY_PHONE
      await service().notify('tnt_1', LEAD)
      expect(enqueued).toHaveLength(0)
      expect(logged.join(' ')).toContain('LEAD_NOTIFY_PHONE')
    })

    it('refuses a landline as the office number rather than queueing a dead send', async () => {
      process.env.LEAD_NOTIFY_PHONE = '03-5098264'
      await service().notify('tnt_1', LEAD)
      expect(enqueued).toHaveLength(0)
      expect(logged.join(' ')).toContain('not a usable Israeli mobile')
    })
  })

  describe('what is stored alongside the message', () => {
    it('keeps ids in metadata and the personal details only in the body', async () => {
      await service().notify('tnt_1', LEAD)
      const metadata = JSON.stringify(enqueued[0].metadata)
      expect(metadata).toContain('lead_1')
      expect(metadata).not.toContain('דנה')
      expect(metadata).not.toContain('0521234567')
    })

    it('gives up after a few attempts — a late alert helps nobody', async () => {
      await service().notify('tnt_1', LEAD)
      expect(enqueued[0].maxAttempts).toBe(3)
    })
  })
})
