import { BadRequestException } from '@nestjs/common'
import {
  cleanFields,
  cleanMeeting,
  emptyMeeting,
  formHash,
  isIsoDate,
  isValidIsraeliId,
  israelToday,
  maskIdNumber,
  missingForSending,
  plainText,
  validateSignerInput,
  validateSnapshot,
  type FormData,
} from './form-data'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

const snapshot = () => ({
  id: 'representation-protocol',
  version: '2026-10-07',
  title: 'פרוטוקול מינוי נציגות בעלי דירות לקידום פרויקט פינוי-בינוי',
  parts: [{ letter: 'א', title: 'רקע', clauses: [{ number: 1, blocks: [{ kind: 'paragraph', text: 'x' }] }] }],
  preparedBy: { name: 'מכין', line: 'מכין המסמך {preparer}.' },
})

const form = (overrides: Partial<FormData> = {}): FormData => ({
  template: 'representation-protocol',
  complexId: 'c1',
  text: snapshot(),
  meeting: { compoundName: 'מתחם א', address: 'רחוב 1', meetingDate: '2026-10-20', meetingPlace: 'לובי' },
  representatives: [{ ownerId: 'o1', apartmentId: 'a1' }],
  ...overrides,
})

describe('isValidIsraeliId', () => {
  it('accepts numbers whose check digit is right, padded or not', () => {
    expect(isValidIsraeliId('000000018')).toBe(true)
    expect(isValidIsraeliId('18')).toBe(false) // too short to be a real number
    expect(isValidIsraeliId('123456782')).toBe(true)
    expect(isValidIsraeliId('12345678')).toBe(false)
  })

  it('rejects a wrong check digit and anything that is not digits', () => {
    expect(isValidIsraeliId('123456789')).toBe(false)
    expect(isValidIsraeliId('12345678a')).toBe(false)
    expect(isValidIsraeliId('')).toBe(false)
    expect(isValidIsraeliId('1234567890')).toBe(false)
  })
})

describe('validateSignerInput', () => {
  const valid = {
    fullName: '  ישראל   ישראלי ',
    idNumber: '12345678-2',
    phone: '050-1234567',
    email: 'owner@example.com',
    signatureImage: PNG,
    confirmedRead: true,
  }

  it('cleans a valid row: one space between names, the ID padded to nine digits', () => {
    expect(validateSignerInput(valid)).toEqual({
      fullName: 'ישראל ישראלי',
      idNumber: '123456782',
      phone: '050-1234567',
      email: 'owner@example.com',
      signatureImage: PNG,
    })
  })

  it('treats phone and email as optional', () => {
    const row = validateSignerInput({ ...valid, phone: '', email: undefined })
    expect(row.phone).toBeNull()
    expect(row.email).toBeNull()
  })

  it('names every problem, in Hebrew, in one answer', () => {
    let error: unknown
    try {
      validateSignerInput({ fullName: 'א', idNumber: '123456789', email: 'not-an-email', signatureImage: 'x' })
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(BadRequestException)
    const body = (error as BadRequestException).getResponse() as { code: string; fields: string[] }
    expect(body.code).toBe('FORM_ROW_INVALID')
    expect(body.fields).toEqual(['שם מלא', 'מספר תעודת זהות', 'אימייל', 'חתימה', 'אישור קריאת הנוסח'])
  })

  it('refuses a signature that is not a PNG, or too large to be one', () => {
    expect(() => validateSignerInput({ ...valid, signatureImage: 'data:image/svg+xml;base64,PHN2Zz4=' })).toThrow(
      BadRequestException,
    )
    expect(() => validateSignerInput({ ...valid, signatureImage: PNG + 'A'.repeat(100 * 1024) })).toThrow(
      BadRequestException,
    )
  })

  it('requires the reading confirmation to be exactly true', () => {
    expect(() => validateSignerInput({ ...valid, confirmedRead: false })).toThrow(BadRequestException)
    expect(() => validateSignerInput({ ...valid, confirmedRead: 'true' as unknown as boolean })).toThrow(
      BadRequestException,
    )
  })
})

describe('validateSnapshot', () => {
  it('accepts the protocol shape the CRM sends', () => {
    expect(validateSnapshot(snapshot(), 'representation-protocol').version).toBe('2026-10-07')
  })

  it('refuses another template, a missing version, empty parts and clauses without numbers', () => {
    expect(() => validateSnapshot({ ...snapshot(), id: 'other' }, 'representation-protocol')).toThrow()
    expect(() => validateSnapshot({ ...snapshot(), version: '' }, 'representation-protocol')).toThrow()
    expect(() => validateSnapshot({ ...snapshot(), parts: [] }, 'representation-protocol')).toThrow()
    expect(() =>
      validateSnapshot({ ...snapshot(), parts: [{ clauses: [{ blocks: [] }] }] }, 'representation-protocol'),
    ).toThrow()
    expect(() => validateSnapshot('text', 'representation-protocol')).toThrow()
    expect(() => validateSnapshot({ ...snapshot(), preparedBy: undefined }, 'representation-protocol')).toThrow()
  })

  it('refuses a snapshot too large to be the protocol', () => {
    const big = { ...snapshot(), padding: 'א'.repeat(40_000) }
    expect(() => validateSnapshot(big, 'representation-protocol')).toThrow()
  })
})

describe('meeting details', () => {
  it('trims, keeps what was not sent, and refuses a date that does not exist', () => {
    const current = { ...emptyMeeting(), compoundName: 'מתחם א' }
    expect(cleanMeeting({ address: '  רחוב 1 ' }, current)).toEqual({
      compoundName: 'מתחם א',
      address: 'רחוב 1',
      meetingDate: '',
      meetingPlace: '',
    })
    expect(() => cleanMeeting({ meetingDate: '2026-02-30' }, current)).toThrow(BadRequestException)
    expect(cleanMeeting({ meetingDate: '2026-10-20' }, current).meetingDate).toBe('2026-10-20')
  })

  it('lists, in the protocol’s words, what is missing before sending', () => {
    expect(missingForSending(form())).toEqual([])
    expect(
      missingForSending(form({ meeting: { ...emptyMeeting(), compoundName: 'מתחם א' }, representatives: [] })),
    ).toEqual(['כתובת', 'תאריך', 'מקום הישיבה', 'חברי הנציגות'])
  })
})

describe('formHash', () => {
  it('is the same for the same form, whatever the key order', () => {
    const a = form()
    const b: FormData = JSON.parse(JSON.stringify(a))
    b.meeting = { meetingPlace: a.meeting.meetingPlace, meetingDate: a.meeting.meetingDate, address: a.meeting.address, compoundName: a.meeting.compoundName }
    expect(formHash(a)).toBe(formHash(b))
    expect(formHash(a)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes when a word or a member changes', () => {
    expect(formHash(form())).not.toBe(formHash(form({ meeting: { ...form().meeting, meetingPlace: 'מקלט' } })))
    expect(formHash(form())).not.toBe(formHash(form({ representatives: [] })))
  })
})

describe('small helpers', () => {
  it('israelToday answers in Israel time', () => {
    // 22:30 UTC on 19 October is already 20 October in Israel (UTC+3).
    expect(israelToday(new Date('2026-10-19T22:30:00Z'))).toBe('2026-10-20')
  })

  it('isIsoDate accepts real calendar dates only', () => {
    expect(isIsoDate('2026-10-20')).toBe(true)
    expect(isIsoDate('20/10/2026')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
  })

  it('maskIdNumber keeps the last four digits', () => {
    expect(maskIdNumber('123456782')).toBe('•••••6782')
    expect(maskIdNumber(null)).toBeNull()
  })
})

describe('the agreement and the notice', () => {
  // The real wordings, as the CRM sends them.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ORGANIZING_AGREEMENT } = require('../../../../packages/api-contracts/src/organizing-agreement')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ASSEMBLY_NOTICE } = require('../../../../packages/api-contracts/src/assembly-notice')

  it('accepts each wording under its own template only', () => {
    expect(() => validateSnapshot(ORGANIZING_AGREEMENT, 'organizing-agreement')).not.toThrow()
    expect(() => validateSnapshot(ASSEMBLY_NOTICE, 'assembly-notice')).not.toThrow()
    expect(() => validateSnapshot(ORGANIZING_AGREEMENT, 'assembly-notice')).toThrow(BadRequestException)
    expect(() => validateSnapshot({ ...ORGANIZING_AGREEMENT, clauses: [] }, 'organizing-agreement')).toThrow(BadRequestException)
    expect(() => validateSnapshot({ ...ASSEMBLY_NOTICE, agenda: [{ lead: 1 }] }, 'assembly-notice')).toThrow(BadRequestException)
  })

  it('keeps only a type’s own fields, bounded, and checks the notice’s hour', () => {
    expect(cleanFields('ORGANIZING_AGREEMENT', { street: '  הרצל 5 ', gush: '30000', extra: 'x' })).toEqual({
      street: 'הרצל 5',
      city: '',
      gush: '30000',
      helka: '',
    })
    expect(cleanFields('ASSEMBLY_NOTICE', { meetingTime: '19:30' }, { compound: 'מתחם א' })).toEqual({
      compound: 'מתחם א',
      meetingTime: '19:30',
    })
    expect(() => cleanFields('ASSEMBLY_NOTICE', { meetingTime: '7pm' })).toThrow(BadRequestException)
  })

  it('names what each still needs before sending', () => {
    const agreement = form({ text: ORGANIZING_AGREEMENT, fields: { street: 'הרצל 5', city: '', gush: '', helka: '1' }, representatives: [] })
    expect(missingForSending(agreement, 'ORGANIZING_AGREEMENT')).toEqual(['עיר', 'גוש', 'הנציגים'])
    const notice = form({ text: ASSEMBLY_NOTICE, fields: { compound: 'מתחם א', meetingTime: '' }, representatives: [] })
    expect(missingForSending(notice, 'ASSEMBLY_NOTICE')).toEqual(['שעת הכינוס'])
  })

  it('hashes a protocol as before, and an agreement with its fields', () => {
    const protocol = form()
    expect(formHash(protocol)).toBe(formHash({ ...protocol, fields: undefined }))
    const a = form({ fields: { street: 'הרצל 5' } })
    const b = form({ fields: { street: 'הרצל 7' } })
    expect(formHash(a)).not.toBe(formHash(b))
  })

  it('reads a title without its markup', () => {
    expect(plainText(ORGANIZING_AGREEMENT.title)).toBe('הסכם לארגון וליווי עסקת פינוי בינוי')
  })
})
