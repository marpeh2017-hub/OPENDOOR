import type { IsoDate, IsoDateTime } from './common'
import type { ProjectSourceType } from './project-internal'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE PERSISTENT VERIFICATION RECORD
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `VerifiedFact` (in `verification.ts`) is the shape a verified value takes
 * when it is READ — value, date, who. This is the shape it takes when it is
 * STORED, and it carries three things the read model does not need:
 *
 *   1. The value that was actually checked, so a later edit can be detected.
 *   2. Who edited, as well as who verified.
 *   3. A status that distinguishes independent verification from
 *      self-verification.
 *
 * Nothing here is ever sent to the website. The public projection strips it to
 * `PublicVerifiedFact`, which has neither a verifier nor a source.
 */

/**
 * Where a fact came from.
 *
 * Reuses `ProjectSourceType` rather than defining a second list: a source is a
 * source whether it is described in the audit document or attached to a value,
 * and two lists would drift.
 */
export type VerificationSource = ProjectSourceType

/**
 * ── THE FOUR STATES ────────────────────────────────────────────────────────
 *
 * `SELF_VERIFIED` is an AUDIT OUTCOME, not an error and not a lesser grade. A
 * self-verified value is publishable exactly like a verified one.
 *
 * It exists because the alternative — forbidding it — fails in practice. A
 * two-person company would be unable to publish anything, so the rule would be
 * worked around by sharing a login, which destroys the audit trail entirely
 * rather than merely marking it. Recording the fact honestly is worth more than
 * a prohibition that is certain to be evaded.
 *
 * `SECOND_REVIEW_REQUIRED` is the escape hatch for the small set of claims
 * where one signature genuinely is not enough. The state exists in the model
 * now so that turning it on later for a category of fact is configuration
 * rather than a schema change. Nothing sets it in V1.
 */
export type VerificationStatus =
  /** Nobody has signed for this value. It does not reach the website. */
  | 'UNVERIFIED'
  /** Verified by somebody other than the last editor. */
  | 'VERIFIED'
  /** Verified by the same person who last edited it. Publishable. */
  | 'SELF_VERIFIED'
  /** Held pending a second signature. Not publishable. Unused in V1. */
  | 'SECOND_REVIEW_REQUIRED'

/**
 * One stored fact, with everything needed to answer "who said so, and is it
 * still the thing they said it about".
 *
 * ── WHY `verifiedValue` IS SEPARATE FROM `value` ───────────────────────────
 *
 * This is the field the whole model turns on. `value` is what the record holds
 * now; `verifiedValue` is what somebody actually checked. Comparing them is
 * what makes "editing invalidates verification" a MECHANISM rather than an
 * intention — without it, the rule depends on every write path remembering to
 * clear a flag, and the one that forgets is the one that publishes a corrected
 * number under someone else's signature.
 */
export interface VerificationRecord<T> {
  /** The current value. */
  value: T
  /** The value that was verified. Compared against `value` to detect drift. */
  verifiedValue?: T

  status: VerificationStatus

  /** Who last changed `value`, and when. Always present. */
  editedByUserId: string
  editedAt: IsoDateTime

  /** Who signed, and when. Absent while `UNVERIFIED`. */
  verifiedByUserId?: string
  verifiedAt?: IsoDate

  /** What it was checked against. */
  source?: VerificationSource
  /** A document number, sheet reference, decision number or clause. */
  sourceReference?: string
}

/**
 * The status a record should hold, derived from its own contents.
 *
 * ── DERIVED, NOT SET ───────────────────────────────────────────────────────
 *
 * Callers do not assign a status; they record who did what and ask for the
 * consequence. A status that can be set directly is a status that can be set
 * wrongly, and "mark as verified" is exactly the API call somebody eventually
 * makes from a script.
 *
 * `requiresSecondReview` is the hook for the future capability: a category of
 * fact can demand a second signature without any of this logic changing.
 */
export function deriveVerificationStatus<T>(
  record: Pick<
    VerificationRecord<T>,
    'value' | 'verifiedValue' | 'editedByUserId' | 'verifiedByUserId'
  >,
  options: { requiresSecondReview?: boolean; equals?: (a: T, b: T) => boolean } = {},
): VerificationStatus {
  const { verifiedByUserId, editedByUserId, value, verifiedValue } = record
  if (!verifiedByUserId || verifiedValue === undefined) return 'UNVERIFIED'

  // The value moved after it was signed for. The signature does not travel
  // with it: this is the invalidation rule, and it is checked rather than
  // trusted to whoever performed the write.
  const same = options.equals
    ? options.equals(value, verifiedValue)
    : JSON.stringify(value) === JSON.stringify(verifiedValue)
  if (!same) return 'UNVERIFIED'

  if (verifiedByUserId === editedByUserId) {
    return options.requiresSecondReview ? 'SECOND_REVIEW_REQUIRED' : 'SELF_VERIFIED'
  }
  return 'VERIFIED'
}

/**
 * May this value appear on the public website?
 *
 * The single question the website's read path cares about. `SELF_VERIFIED`
 * passes; `SECOND_REVIEW_REQUIRED` does not, which is what makes the future
 * capability meaningful rather than decorative.
 */
export function isPublishable(status: VerificationStatus): boolean {
  return status === 'VERIFIED' || status === 'SELF_VERIFIED'
}

/**
 * An immutable line in the audit trail.
 *
 * ── APPEND ONLY ────────────────────────────────────────────────────────────
 *
 * Entries are never updated and never deleted, including when a value is later
 * corrected, a verification is invalidated, or a revision is restored. The
 * record of who signed for what, and when, is the only durable answer to a
 * question asked months later, and it is worthless if it can be tidied.
 *
 * Restoring an old revision restores CONTENT. It does not restore
 * verifications: a value that was signed for, changed, and then restored is
 * still a value nobody has re-checked since it moved.
 */
export interface VerificationAuditEntry {
  id: string
  /** Which item and which field, e.g. `project:hida-26` + `existingUnits`. */
  itemId: string
  field: string

  event: 'EDITED' | 'VERIFIED' | 'INVALIDATED' | 'REVIEW_REQUESTED'
  /** Status after this event. */
  status: VerificationStatus

  actorUserId: string
  occurredAt: IsoDateTime

  /** Rendered for the history view. Never parsed, never public. */
  previousValueLabel?: string
  newValueLabel?: string

  source?: VerificationSource
  sourceReference?: string
  note?: string
}
