import type { IsoDate, IsoDateTime, Visibility } from './common'
import type { ProjectStage } from './public'
import type { ResidentDocument, ResidentMeeting } from './resident'

/**
 * The resident representative's working environment (§24, §66).
 *
 * ── WHAT THIS IS ───────────────────────────────────────────────────────────
 *
 * A representative is a RESIDENT with extra permissions, not a staff member.
 * Everything here is therefore a superset of the resident view, never a subset
 * of the CRM. The distinction matters: it is tempting to implement this by
 * exposing CRM screens to a wider audience, and that is exactly how internal
 * commentary reaches the people it was written about.
 *
 * ── HARD EXCLUSIONS ────────────────────────────────────────────────────────
 *
 * Never, at any visibility level:
 *   - internal OpenDoor notes or staff commentary
 *   - other residents' national ids, or contact details beyond what the
 *     representation role legitimately needs
 *   - commercial terms under negotiation with developers
 *   - CRM lead pipeline, health scores, or data-quality findings
 *   - any `s3Key` / storage path
 */

/**
 * §66's six questions in one payload, in the order the screen answers them.
 *
 * One call, for the same reason as the resident dashboard: a representative
 * opening this screen is asking "what needs me?", and six independent requests
 * produce a screen that answers that question in pieces.
 */
export interface RepresentationOverview {
  projectId: string
  projectName: string
  currentStage: ProjectStage
  openDecisionCount: number
  tasksNeedingAttention: number
  nextMeeting: ResidentMeeting | null
  nextMilestone: RepresentationMilestone | null
  recentChanges: RepresentationChange[]
}

/* ── Tasks ─────────────────────────────────────────────────────────────── */

export type RepTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'
export type RepTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

/**
 * A task belonging to the REPRESENTATION, not an internal OpenDoor task.
 *
 * `assignedToName` is a representation member's display name — the committee is
 * a small group who know each other. It is never a staff member's name.
 */
export interface RepresentationTask {
  id: string
  title: string
  description?: string
  status: RepTaskStatus
  priority: RepTaskPriority
  dueDate?: IsoDate
  assignedToName?: string
  updatedAt: IsoDateTime
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

export type DecisionStatus = 'OPEN' | 'DECIDED' | 'DEFERRED'

/**
 * A decision the representation must make.
 *
 * ⚠ NOT A VOTE. `Vote` / `VoteResponse` exist in the schema but have no service
 * behind them, so nothing here may imply a binding tally. This records that a
 * decision is open, what the options are, and what was decided — the mechanism
 * by which residents actually vote is a separate, unbuilt feature.
 */
export interface RepresentationDecision {
  id: string
  title: string
  context: string
  options?: string[]
  status: DecisionStatus
  /** Present when status is DECIDED. Free text, recorded by OpenDoor. */
  outcome?: string
  decidedAt?: IsoDateTime
  /** Advisory only — a target, not a deadline with legal effect. */
  targetDate?: IsoDate
}

/* ── Milestones ────────────────────────────────────────────────────────── */

export interface RepresentationMilestone {
  id: string
  title: string
  description?: string
  stage: ProjectStage
  targetDate?: IsoDate
  completedAt?: IsoDate
  state: 'completed' | 'current' | 'upcoming'
}

/* ── Open items ────────────────────────────────────────────────────────── */

/** Something unresolved that is not yet a task or a decision. */
export interface RepresentationOpenItem {
  id: string
  title: string
  raisedBy: string
  raisedAt: IsoDateTime
  notes?: string
  status: 'OPEN' | 'RESOLVED'
}

/* ── Change feed ───────────────────────────────────────────────────────── */

export type RepresentationChangeKind =
  | 'STAGE_CHANGED' | 'DOCUMENT_ADDED' | 'MEETING_SCHEDULED'
  | 'DECISION_OPENED' | 'DECISION_MADE' | 'MILESTONE_REACHED' | 'UPDATE_PUBLISHED'

/** "What changed in the project" — §66 question 4. */
export interface RepresentationChange {
  id: string
  kind: RepresentationChangeKind
  summary: string
  occurredAt: IsoDateTime
  href?: string
}

/* ── Documents ─────────────────────────────────────────────────────────── */

/**
 * Representatives see the resident document set plus documents scoped to the
 * representation. The shape is the resident one on purpose — a second document
 * type would drift, and the only real difference is which rows are returned.
 */
export interface RepresentationDocument extends ResidentDocument {
  visibility: Extract<Visibility, 'residents_only' | 'representatives_only'>
}

/* ── Professional team (§24) ───────────────────────────────────────────── */

/**
 * The professional parties engaged on the project.
 *
 * Populated only where the appointment is settled and the party has agreed to
 * be named. Nothing is inferred from a CRM record, and an empty list is a
 * normal state for an early-stage project.
 */
export interface ProfessionalTeamMember {
  role: 'LAWYER' | 'APPRAISER' | 'ARCHITECT' | 'ENGINEER' | 'SUPERVISOR' | 'OTHER'
  name: string
  organisation?: string
  appointedAt?: IsoDate
}
