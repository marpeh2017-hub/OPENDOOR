import type { IsoDate, IsoDateTime, MediaAsset, Visibility } from './common'
import type { ProjectStage, ProjectType, TimelineStage } from './public'

/**
 * The authenticated resident's own view of their project.
 *
 * ── FIRST-PERSON BY CONSTRUCTION ───────────────────────────────────────────
 *
 * No shape in this file takes a resident id. There is no parameter for "whose
 * documents" or "whose apartment" — the server derives that from the session,
 * exactly as `NotificationsController` already does. A contract that accepts an
 * id invites a frontend to pass one, and then the only thing standing between a
 * resident and their neighbour's file is a server-side check nobody re-reads.
 *
 * ── WHAT A RESIDENT NEVER RECEIVES ─────────────────────────────────────────
 *
 * Internal CRM notes, other residents' contact details or national ids, staff
 * commentary, commercial terms under negotiation, and `s3Key` / storage paths
 * of any kind (§23 — the frontend must never hold a direct storage URL).
 */

/* ── Profile ───────────────────────────────────────────────────────────── */

export interface ResidentProfile {
  displayName: string
  phone: string
  email?: string
  /** Their own preference, editable by them. */
  preferredLocale?: 'he' | 'en'
  isRepresentative: boolean
}

/* ── Apartment ─────────────────────────────────────────────────────────── */

/**
 * The resident's own apartment.
 *
 * Ownership share is intentionally a display string rather than a number: the
 * backend holds exact BigInt fractions, and rendering `0.3333` where the record
 * says `1/3` would misstate a legally consequential value.
 */
export interface ResidentApartment {
  buildingName?: string
  address: string
  apartmentNumber: string
  floor?: number
  rooms?: number
  sizeSqm?: number
  /** e.g. "1/3". Formatted server-side from the exact fraction. */
  ownershipShare?: string
  isPrimaryContact: boolean
}

/* ── Project ───────────────────────────────────────────────────────────── */

export interface ResidentProject {
  id: string
  name: string
  type: ProjectType
  address: string
  currentStage: ProjectStage
  /** Resident-level timeline: the public stages plus resident-visible detail. */
  timeline: TimelineStage[]
  heroImage?: MediaAsset
}

/**
 * The dashboard payload — §65's four questions in one response.
 *
 * Deliberately a single call rather than five: the answers to "where is my
 * project", "what happened", "what next" and "what must I do" belong on one
 * screen, and five requests means five loading states and four chances for a
 * partial render that answers three of the four.
 */
export interface ResidentDashboard {
  greetingName: string
  project: ResidentProject
  /** What the resident must do, if anything. Null renders a calm empty state,
   *  which is a legitimate and common answer. */
  nextAction: ResidentAction | null
  recentUpdate: ResidentUpdate | null
  upcomingMeeting: ResidentMeeting | null
  unreadDocumentCount: number
}

export interface ResidentAction {
  id: string
  title: string
  description?: string
  dueDate?: IsoDate
  /** Relative in-app path. Absolute URLs are rejected — the existing
   *  notifications service already strips them. */
  href?: string
  severity: 'info' | 'attention' | 'urgent'
}

/* ── Updates ───────────────────────────────────────────────────────────── */

export interface ResidentUpdate {
  id: string
  title: string
  body: string
  publishedAt: IsoDateTime
  media?: MediaAsset[]
  /** residents_only or public. Never internal — filtered server-side. */
  visibility: Extract<Visibility, 'public' | 'residents_only'>
}

/* ── Documents (§23) ───────────────────────────────────────────────────── */

export type ResidentDocumentCategory =
  | 'AGREEMENT' | 'PLAN' | 'MEETING_SUMMARY' | 'NOTICE' | 'LEGAL' | 'OTHER'

/**
 * A document the resident may see.
 *
 * `downloadUrl` is a short-lived, server-issued URL obtained per request — never
 * a MinIO path and never stored. The storage key is not in this contract at
 * all, so a frontend cannot leak what it was never given.
 */
export interface ResidentDocument {
  id: string
  title: string
  category: ResidentDocumentCategory
  fileName: string
  fileSizeBytes: number
  mimeType: string
  uploadedAt: IsoDateTime
  /** Present only for documents this resident is expected to sign. */
  signatureStatus?: 'NOT_REQUIRED' | 'PENDING' | 'SIGNED'
  /** True until the resident opens it — drives the dashboard count. */
  isNew: boolean
}

/** @phase2 Issued per click, short TTL, audited server-side. */
export interface DocumentAccessGrant {
  downloadUrl: string
  expiresAt: IsoDateTime
}

/* ── Meetings ──────────────────────────────────────────────────────────── */

export type RsvpStatus = 'PENDING' | 'ATTENDING' | 'NOT_ATTENDING' | 'MAYBE'

export interface ResidentMeeting {
  id: string
  title: string
  startsAt: IsoDateTime
  endsAt?: IsoDateTime
  location?: string
  /** Video link, when the meeting is remote. */
  onlineUrl?: string
  description?: string
  myRsvp: RsvpStatus
  summaryAvailable: boolean
}

export interface RsvpInput {
  meetingId: string
  status: Exclude<RsvpStatus, 'PENDING'>
}

/* ── Questions / requests (§21 שאלות ופניות) ───────────────────────────── */

export type ResidentQuestionStatus = 'OPEN' | 'ANSWERED' | 'CLOSED'

export interface ResidentQuestion {
  id: string
  subject: string
  body: string
  status: ResidentQuestionStatus
  createdAt: IsoDateTime
  replies: ResidentQuestionReply[]
}

export interface ResidentQuestionReply {
  id: string
  body: string
  /** The organisation, or the resident themselves. Never a named staff member
   *  unless the business decides otherwise — residents deal with OpenDoor. */
  author: 'opendoor' | 'me'
  createdAt: IsoDateTime
}

export interface CreateQuestionInput {
  subject: string
  body: string
}

/* ── Contacts ──────────────────────────────────────────────────────────── */

/**
 * Who the resident can talk to.
 *
 * A ROLE-level contact, not a staff directory. Residents are given the
 * organisation's contact points; exposing individual staff mobile numbers on a
 * resident-facing screen is a decision the business has not made.
 */
export interface ProjectContact {
  role: string
  organisation: string
  phone?: string
  email?: string
  notes?: string
}
