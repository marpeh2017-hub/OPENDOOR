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
  /** "הסכם לארגון וליווי עסקת פינוי בינוי": signed by each owner, like the protocol. */
  ORGANIZING_AGREEMENT: 'ORGANIZING_AGREEMENT',
  /** "הודעה על כינוס בעלי דירות": sent to each owner, and nothing to sign. */
  ASSEMBLY_NOTICE: 'ASSEMBLY_NOTICE',
} as const
export type FormType = (typeof FORM_TYPES)[keyof typeof FORM_TYPES]

/** The template id the CRM sends, mapped to the stored form type. */
export const FORM_TEMPLATES: Record<string, FormType> = {
  'representation-protocol': FORM_TYPES.REPRESENTATION_PROTOCOL,
  'organizing-agreement': FORM_TYPES.ORGANIZING_AGREEMENT,
  'assembly-notice': FORM_TYPES.ASSEMBLY_NOTICE,
}

/** Whether owners sign it. The notice is only read. */
export function isSignable(formType: string | null | undefined): boolean {
  return formType !== FORM_TYPES.ASSEMBLY_NOTICE
}

/** Whether staff choose representatives from the owners: the protocol names them, the agreement is signed through them. */
export function needsRepresentatives(formType: string | null | undefined): boolean {
  return formType === FORM_TYPES.REPRESENTATION_PROTOCOL || formType === FORM_TYPES.ORGANIZING_AGREEMENT
}

/**
 * The gaps each form fills in for its complex, besides the meeting details
 * the protocol has always had: the agreement's street, city, block and
 * parcel, and the notice's address line and hour (its date and place are
 * the meeting's). Labels are the ones staff see and missing fields are
 * named by.
 */
export const FORM_FIELDS: Record<FormType, readonly { key: string; label: string; max: number }[]> = {
  REPRESENTATION_PROTOCOL: [],
  ORGANIZING_AGREEMENT: [
    { key: 'street', label: 'רחוב', max: 120 },
    { key: 'city', label: 'עיר', max: 60 },
    { key: 'gush', label: 'גוש', max: 20 },
    { key: 'helka', label: 'חלקה', max: 40 },
  ],
  ASSEMBLY_NOTICE: [
    { key: 'compound', label: 'מתחם / כתובת', max: 200 },
    { key: 'meetingTime', label: 'שעת הכינוס', max: 5 },
  ],
}

/** "**bold**" and "__underline__" taken out: a document title as plain words. */
export function plainText(markup: string): string {
  return markup.replace(/\*\*|__/g, '')
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
  /** The form's own gaps (FORM_FIELDS); absent on a protocol. */
  fields?: Record<string, string>
  /** The agreement's "המארגן" line, signed by the company after sending. */
  organizer?: OrganizerSignature
}

export interface OrganizerSignature {
  /** The drawn signature, as a PNG data URL. */
  signatureImage: string
  /** yyyy-mm-dd, the date beside it on the signature line. */
  signedDate: string
  signedAt: string
  signedById: string
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
  /** The typed ID number against the owner's file; null when the file has none. */
  idMatchesFile?: boolean | null
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
  if (Buffer.byteLength(JSON.stringify(t), 'utf8') > MAX_SNAPSHOT_BYTES) throw bad('too large')

  const strings = (value: unknown) => Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string')
  if (templateId === 'organizing-agreement') {
    const clauses = t.clauses
    if (!Array.isArray(clauses) || clauses.length === 0) throw bad('clauses')
    for (const clause of clauses) {
      const c = clause as { number?: unknown; text?: unknown }
      if (typeof c.number !== 'number' || typeof c.text !== 'string') throw bad('clause')
    }
    if (!strings(t.signatureRow)) throw bad('signatureRow')
    const tables = [t.representativesTable, t.ownersTable] as { columns?: unknown }[]
    if (tables.some((table) => !Array.isArray(table?.columns) || table.columns.length === 0)) throw bad('tables')
    if (typeof t.parties !== 'string' || typeof t.organizer !== 'string') throw bad('parties')
    return t as ProtocolSnapshot
  }
  if (templateId === 'assembly-notice') {
    if (!Array.isArray(t.fields) || t.fields.length === 0) throw bad('fields')
    const agenda = t.agenda
    if (!Array.isArray(agenda) || agenda.length === 0) throw bad('agenda')
    for (const item of agenda) {
      const a = item as { lead?: unknown; text?: unknown }
      if (typeof a.lead !== 'string' || typeof a.text !== 'string') throw bad('agenda item')
    }
    if (!strings(t.intro) || !Array.isArray(t.contacts)) throw bad('letter')
    return t as ProtocolSnapshot
  }

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
  return t as ProtocolSnapshot
}

/**
 * Trims and bounds a form's own gaps, keeping only the keys its type has.
 * Empty values are allowed in a draft; the notice's hour, when given, is
 * HH:MM.
 */
export function cleanFields(
  formType: string,
  input: Record<string, unknown> | undefined,
  current: Record<string, string> = {},
): Record<string, string> {
  const fields = FORM_FIELDS[formType as FormType] ?? []
  const out: Record<string, string> = {}
  for (const field of fields) {
    const value = input?.[field.key]
    out[field.key] = typeof value === 'string' ? value.trim().slice(0, field.max) : (current[field.key] ?? '')
  }
  if (out.meetingTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(out.meetingTime)) {
    throw new BadRequestException('שעת הכינוס אינה תקינה')
  }
  return out
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

/** What is still missing before a form can go out, in each document's words. */
export function missingForSending(form: FormData, formType: string = FORM_TYPES.REPRESENTATION_PROTOCOL): string[] {
  const missing: string[] = []
  const fields = form.fields ?? {}
  if (formType === FORM_TYPES.ORGANIZING_AGREEMENT) {
    for (const field of FORM_FIELDS.ORGANIZING_AGREEMENT) if (!fields[field.key]) missing.push(field.label)
    if (form.representatives.length === 0) missing.push('הנציגים')
    return missing
  }
  if (formType === FORM_TYPES.ASSEMBLY_NOTICE) {
    if (!fields.compound) missing.push('מתחם / כתובת')
    if (!form.meeting.meetingDate) missing.push('תאריך הכינוס')
    if (!fields.meetingTime) missing.push('שעת הכינוס')
    if (!form.meeting.meetingPlace) missing.push('מקום הכינוס')
    return missing
  }
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
  // `fields` only when the form has them, so a protocol hashes as it always has.
  return createHash('sha256')
    .update(
      canonicalJson({ text: form.text, meeting: form.meeting, representatives: form.representatives, fields: form.fields }),
    )
    .digest('hex')
}

/** The SHA-256 of a wording snapshot on its own, keys sorted. */
export function snapshotHash(text: unknown): string {
  return createHash('sha256').update(canonicalJson(text)).digest('hex')
}

/**
 * The wordings the PUBLIC endpoints accept, by hash. A protocol started on
 * the website is shown to neighbours through a shared link, so a stranger
 * must not be able to put words of their own in front of them: the website
 * sends the wording from @urban-renewal/api-contracts, and the gateway keeps
 * it only if it is one of these. When the wording changes there, add the new
 * hash here; the forms e2e suite fails until you do.
 */
export const APPROVED_SNAPSHOT_HASHES: Record<string, readonly string[]> = {
  // REPRESENTATION_PROTOCOL, version 2026-10-07 (clause 10 approved 2026-10-10).
  'representation-protocol': ['e5add53189ba7b61b86abd4c7be31b57dde1fb8c6c72804d22683936402a9489'],
}

export function isApprovedSnapshot(text: unknown, templateId: string): boolean {
  return (APPROVED_SNAPSHOT_HASHES[templateId] ?? []).includes(snapshotHash(text))
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
