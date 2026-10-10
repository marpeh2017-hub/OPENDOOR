import type { RepresentationProtocol } from '@urban-renewal/api-contracts'

/**
 * The digital forms as the gateway serves them to residents: the signing
 * link's form view (GET /signatures/portal/:token, `form`), the personal
 * area's list (GET /portal/forms) and a resident's copy (GET
 * /portal/forms/:packageId). The wording is the snapshot the form was sent
 * with, never the current code's.
 */

export interface FormMeeting {
  compoundName: string
  address: string
  meetingDate: string
  meetingPlace: string
}

/** What the signing link shows for a form. */
export interface SigningFormView {
  type: string
  version: string
  text: RepresentationProtocol
  meeting: FormMeeting
  representatives: { fullName: string; apartmentNumber: string }[]
  signer: {
    fullName: string
    apartmentNumber: string
    isRepresentative: boolean
    /** Present only for the owner signed in to the personal area. */
    phone?: string
    email?: string
  }
  /** Today in Israel, yyyy-mm-dd: the date on the signer's row. */
  today: string
  signed: { signedAt: string; fullName: string; idNumber: string | null; signedDate: string | null } | null
}

export interface PortalFormItem {
  packageId: string
  title: string
  compoundName: string
  apartmentNumber: string
  status: 'PENDING' | 'SIGNED' | 'CLOSED'
  signedAt: string | null
  sentAt: string | null
  /** `/sign/<token>`, while the form waits for this resident's signature. */
  signPath: string | null
  isRepresentative: boolean
}

export interface CopyRow {
  apartmentNumber: string
  fullName: string
  idNumber: string | null
  signedDate: string | null
  phone: string | null
  email: string | null
  signatureImage: string | null
  method: string
}

interface CopyBase {
  packageId: string
  formVersion: string
  documentHash: string | null
  status: string
  text: RepresentationProtocol
  meeting: FormMeeting
  rows: CopyRow[]
  preparerIdNumber: string | null
}

/** An owner's copy: their own rows, the members by name only. */
export interface OwnCopy extends CopyBase {
  kind: 'OWN'
  representatives: { fullName: string; apartmentNumber: string; signed: boolean }[]
}

/** A representation member's copy: the combined document. */
export interface CombinedCopy extends CopyBase {
  kind: 'COMBINED'
  representatives: {
    fullName: string
    idNumber: string | null
    apartmentNumber: string
    signatureImage: string | null
    signed: boolean
    method: string | null
  }[]
  totals: { owners: number; signed: number }
}

export type PortalFormCopy = OwnCopy | CombinedCopy

/** 2026-10-20 → 20.10.2026, the way the protocol's date line is written. */
export function formatFormDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}.${m}.${y}` : ''
}
