import type {
  ContactSubmission,
  ContactSubmissionResult,
  EligibilitySubmission,
  EligibilitySubmissionResult,
} from '@urban-renewal/api-contracts'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE INTEGRATION BOUNDARY
 * ══════════════════════════════════════════════════════════════════════════
 *
 *     form component  ->  LeadSubmissionService  ->  API  ->  CRM  ->  automation
 *                                  ^
 *                          this file defines it
 *
 * The form components know this interface and nothing else. They do not know
 * whether a submission travels over HTTP, which endpoint it hits, what the CRM
 * calls a lead, or that a CRM exists at all. That is the entire point: when the
 * real endpoint is built, ONE file changes (`api.adapter.ts`, which does not
 * exist yet) and no form is touched.
 *
 * ── WHAT THIS BOUNDARY FORBIDS ─────────────────────────────────────────────
 *
 * No adapter may write to browser storage, a third-party form service, an
 * email endpoint, or any other durable location. The CRM is the system of
 * record; a lead that exists anywhere else is a lead somebody will eventually
 * have to reconcile by hand. An adapter either reaches the API or it fails.
 *
 * ── WHY RESULTS ARE RETURNED RATHER THAN THROWN ────────────────────────────
 *
 * A failed submission is an ordinary outcome the form must handle gracefully,
 * not an exception. Returning a discriminated union forces the caller to deal
 * with failure — a `try/catch` around an async call is very easy to forget,
 * and forgetting it here is what produces a form that silently appears to
 * succeed.
 */

/** A submission the adapter genuinely delivered. */
export interface SubmissionSuccess<T> {
  ok: true
  result: T
}

/**
 * A submission that did not arrive.
 *
 * `reason` drives which message the form shows. It never reaches the visitor
 * directly: raw technical text in a form error is both unhelpful and a small
 * information leak.
 */
export interface SubmissionFailure {
  ok: false
  reason: SubmissionFailureReason
  /** For the console and future error monitoring. Never rendered. */
  detail?: string
}

export type SubmissionFailureReason =
  /** No endpoint is configured. The expected state until the API is built. */
  | 'NOT_CONFIGURED'
  /** Reached the network but the request failed or timed out. Retryable. */
  | 'NETWORK'
  /** The server rejected the payload. Not retryable without a change. */
  | 'REJECTED'
  /** Too many attempts. Retryable after a wait. */
  | 'RATE_LIMITED'
  /** Anything else. Retryable, because we cannot rule it out. */
  | 'UNKNOWN'

export type SubmissionOutcome<T> = SubmissionSuccess<T> | SubmissionFailure

/**
 * The one interface the forms depend on.
 *
 * Both methods are async and both return an outcome rather than throwing.
 * Implementations must never return `ok: true` for a submission they did not
 * actually deliver — see `development.adapter.ts` for why that rule needed
 * writing down.
 */
export interface LeadSubmissionService {
  submitContact(
    submission: ContactSubmission,
  ): Promise<SubmissionOutcome<ContactSubmissionResult>>

  submitEligibility(
    submission: EligibilitySubmission,
  ): Promise<SubmissionOutcome<EligibilitySubmissionResult>>
}
