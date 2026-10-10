import { BadRequestException } from '@nestjs/common'
import { createHash } from 'crypto'
import { normaliseIsraeliPhone } from '../messaging/phone'

/**
 * The digital forms carried by signature packages, and the rules for what
 * goes into them. Pure functions: the staff endpoints (FormsService), the
 * signing flow (SigningSessionService) and the portal all read form data
 * through here, so there is one definition of a valid form and of a valid row.
 *
 * ── WHY THE WORDING ARRIVES FROM THE CRM ───────────────────────────────────
 *
 * The protocol's wording lives in @urban-renewal/api-contracts, a TypeScript
 * source package this CommonJS build cannot import. So the CRM sends it when
 * it creates a form, and the gateway checks its shape, stores it as the
 * form's snapshot and hashes it with the meeting details at sending. From
 * then on the snapshot is the text: owners read it, signed copies print it,
 * and a later change to the wording in code never reaches a form already
 * sent. The CRM is staff-only, and staff are the document's authors.
 */

export const FORM_TYPES = {
  /** "פרוטוקול מינוי נציגות בעלי דירות לקידום פרויקט פינוי-בינוי". */
  REPRESENTATION_PROTOCOL: 'REPRESENTATION_PROTOCOL',
} as const
export type FormType = (typeof FORM_TYPES)[keyof typeof FORM_TYPES]

/** The template id the CRM sends, mapped to the stored form type. */
export const FORM_TEMPLATES: Record<string, FormType> = {
  'representation-protocol': FORM_TYPES.REPRESENTATION_PROTOCOL,
}

/** How long a form's personal link stays valid: forms take weeks, not days. */
export const FORM_SESSION_TTL_DAYS = 30

/** The wording, as the CRM sent it. Its shape is checked, its words are not. */
export interface ProtocolSnapshot {
  id: string
  version: string
  title: string
  [key: string]: unknown
}

export interface FormMeeting {
  compoundName: string
  address: string
  /** yyyy-mm-dd, or empty while the form is a draft. */
  meetingDate: string
  meetingPlace: string
}

/** A representation member: an owner of an apartment in the complex. */
export interface FormRepresentative {
  ownerId: string
  apartmentId: string
}

export interface FormData {
  template: string
  /** Which complex the form is for: its owners are the signers. */
  complexId: string
  text: ProtocolSnapshot
  meeting: FormMeeting
  representatives: FormRepresentative[]
}

/** What a signer filled in on their row, as stored (ID number encrypted). */
export interface StoredSignerData {
  fullName: string
  idNumber: string | null
  phone: string | null
  email: string | null
  /** yyyy-mm-dd: the date column of the owners' table. */
  signedDate: string
  /** LINK: the personal link. PORTAL: signed in to the portal. MANUAL: on paper. */
  channel: 'LINK' | 'PORTAL' | 'MANUAL'
  confirmedRead?: boolean
}

export const MEETING_LIMITS = { compoundName: 120, address: 200, meetingPlace: 160 } as const
export const MAX_REPRESENTATIVES = 15
const MAX_SNAPSHOT_BYTES = 64 * 1024
/** A drawn signature as a PNG data URL: a real one is 10-30KB, and the
 *  request body as a whole is capped at 100KB by the JSON parser. */
const MAX_SIGNATURE_LENGTH = 90 * 1024

export function emptyMeeting(): FormMeeting {
  return { compoundName: '', address: '', meetingDate: '', meetingPlace: '' }
}

/** Checks the snapshot's shape and size. Throws 400 when it is not a form. */
export function validateSnapshot(text: unknown, templateId: string): ProtocolSnapshot {
  const bad = (why: string) => new BadRequestException(`נוסח הטופס אינו תקין (${why})`)
  if (!text || typeof text !== 'object' || Array.isArray(text)) throw bad('not an object')
  const t = text as Record<string, unknown>
  if (t.id !== templateId) throw bad('template mismatch')
  if (typeof t.version !== 'string' || !/^[\w.-]{1,32}$/.test(t.version)) throw bad('version')
  if (typeof t.title !== 'string' || !t.title.trim()) throw bad('title')
  const parts = t.parts
  if (!Array.isArray(parts) || parts.length === 0) throw bad('parts')
  for (const part of parts) {
    const clauses = (part as { clauses?: unknown })?.clauses
    if (!Array.isArray(clauses) || clauses.length === 0) throw bad('clauses')
    for (const clause of clauses) {
      const c = clause as { number?: unknown; blocks?: unknown }
      if (typeof c.number !== 'number' || !Array.isArray(c.blocks)) throw bad('clause')
    }
  }
  const preparedBy = t.preparedBy as { name?: unknown; line?: unknown } | undefined
  if (typeof preparedBy?.name !== 'string' || typeof preparedBy.line !== 'string' || !preparedBy.line.includes('{preparer}')) {
    throw bad('preparedBy')
  }
  if (Buffer.byteLength(JSON.stringify(t), 'utf8') > MAX_SNAPSHOT_BYTES) throw bad('too large')
  return t as ProtocolSnapshot
}

/** Trims and bounds the meeting details. Empty values are allowed in a draft. */
export function cleanMeeting(input: Partial<FormMeeting> | undefined, current: FormMeeting): FormMeeting {
  const text = (value: unknown, max: number, fallback: string) =>
    typeof value === 'string' ? value.trim().slice(0, max) : fallback
  const date = input?.meetingDate
  if (date !== undefined && date !== '' && !isIsoDate(date)) {
    throw new BadRequestException('תאריך האסיפה אינו תקין')
  }
  return {
    compoundName: text(input?.compoundName, MEETING_LIMITS.compoundName, current.compoundName),
    address: text(input?.address, MEETING_LIMITS.address, current.address),
    meetingDate: date === undefined ? current.meetingDate : date,
    meetingPlace: text(input?.meetingPlace, MEETING_LIMITS.meetingPlace, current.meetingPlace),
  }
}

/** What is still missing before a form can go out, in the protocol's words. */
export function missingForSending(form: FormData): string[] {
  const missing: string[] = []
  if (!form.meeting.compoundName) missing.push('שם המתחם')
  if (!form.meeting.address) missing.push('כתובת')
  if (!form.meeting.meetingDate) missing.push('תאריך')
  if (!form.meeting.meetingPlace) missing.push('מקום הישיבה')
  if (form.representatives.length === 0) missing.push('חברי הנציגות')
  return missing
}

export function parseFormData(raw: string | null | undefined): FormData | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as FormData
    return parsed && typeof parsed === 'object' && parsed.text ? parsed : null
  } catch {
    return null
  }
}

export function parseSignerData(raw: string | null | undefined): StoredSignerData | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredSignerData
  } catch {
    return null
  }
}

/**
 * The SHA-256 of what is being signed: the wording and this meeting's
 * details and members. Keys are sorted, so the same form always hashes the
 * same.
 */
export function formHash(form: FormData): string {
  return createHash('sha256')
    .update(canonicalJson({ text: form.text, meeting: form.meeting, representatives: form.representatives }))
    .digest('hex')
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Today in Israel, as yyyy-mm-dd: the date a signer writes on their row. */
export function israelToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now)
}

/**
 * The Israeli ID number check digit. Up to nine digits, padded with leading
 * zeros; each digit is weighted 1, 2, 1, 2…, a two-digit product counts as
 * the sum of its digits, and a valid number's total divides by ten.
 */
export function isValidIsraeliId(raw: string): boolean {
  const digits = raw.trim()
  if (!/^\d{5,9}$/.test(digits)) return false
  const padded = digits.padStart(9, '0')
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const product = Number(padded[i]) * ((i % 2) + 1)
    sum += product > 9 ? product - 9 : product
  }
  return sum % 10 === 0
}

export interface SignerInput {
  fullName?: string
  idNumber?: string
  phone?: string
  email?: string
  signatureImage?: string
  confirmedRead?: boolean
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/

/**
 * Validates a signer's own row. Each problem is named in Hebrew, because
 * the message reaches the owner as it is.
 */
export function validateSignerInput(input: SignerInput): {
  fullName: string
  idNumber: string
  phone: string | null
  email: string | null
  signatureImage: string
} {
  const problems: string[] = []
  const fullName = (input.fullName ?? '').trim().replace(/\s+/g, ' ')
  if (fullName.length < 2 || fullName.length > 80) problems.push('שם מלא')

  const idNumber = (input.idNumber ?? '').replace(/\D/g, '')
  if (!isValidIsraeliId(idNumber)) problems.push('מספר תעודת זהות')

  let phone: string | null = null
  if (input.phone && input.phone.trim()) {
    const normalised = normaliseIsraeliPhone(input.phone)
    if (!normalised.e164) problems.push('טלפון')
    else phone = input.phone.trim()
  }

  let email: string | null = null
  if (input.email && input.email.trim()) {
    const value = input.email.trim()
    if (!EMAIL.test(value) || value.length > 254) problems.push('אימייל')
    else email = value
  }

  const signatureImage = input.signatureImage ?? ''
  if (!signatureImage.startsWith('data:image/png;base64,') || signatureImage.length > MAX_SIGNATURE_LENGTH) {
    problems.push('חתימה')
  }

  if (input.confirmedRead !== true) problems.push('אישור קריאת הנוסח')

  if (problems.length) {
    throw new BadRequestException({
      code: 'FORM_ROW_INVALID',
      fields: problems,
      message: `יש לבדוק: ${problems.join(', ')}`,
    })
  }
  return { fullName, idNumber: idNumber.padStart(9, '0'), phone, email, signatureImage }
}

/** `123456789` → `•••••6789`: enough for a signer to recognise their own. */
export function maskIdNumber(id: string | null | undefined): string | null {
  if (!id) return null
  return `${'•'.repeat(Math.max(0, id.length - 4))}${id.slice(-4)}`
}
