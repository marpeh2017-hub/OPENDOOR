import type {
  ContactSubmission,
  ContactSubmissionResult,
  EligibilitySubmission,
  EligibilitySubmissionResult,
} from '@urban-renewal/api-contracts'
import type { LeadSubmissionService, SubmissionOutcome } from './types'

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  THE DEVELOPMENT ADAPTER — IT ALWAYS FAILS, ON PURPOSE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * No production endpoint exists yet. This adapter stands in until one does,
 * and it returns `NOT_CONFIGURED` every single time.
 *
 * ── WHY IT DOES NOT FAKE SUCCESS ───────────────────────────────────────────
 *
 * The obvious shortcut is a mock that waits 800ms and returns `ok: true` so
 * the confirmation screen can be demonstrated. That shortcut is exactly how a
 * form ships to production still wired to a mock: it looks correct in every
 * review, every screenshot and every demo, and the only symptom is that
 * nobody ever calls the people who filled it in.
 *
 * Here, the success screen is UNREACHABLE until a real adapter genuinely
 * delivers a submission. That is not a limitation to work around — it is the
 * safety property. If you are reading this because the success state cannot be
 * demonstrated: that is the design working.
 *
 * ── WHAT IT DOES INSTEAD ───────────────────────────────────────────────────
 *
 * It logs the payload it WOULD have sent, so the shape can be verified during
 * development, and returns a failure the form renders as a recoverable error.
 * The visitor sees an honest "this did not go through" rather than a false
 * confirmation.
 *
 * ── NOTHING IS PERSISTED ───────────────────────────────────────────────────
 *
 * Not to localStorage, not to sessionStorage, not to an email endpoint, not
 * anywhere. The CRM is the system of record, and a lead sitting in a browser
 * is a lead that is already lost.
 */

function logIntent(kind: string): void {
  // Development only. Production never reaches this adapter — see `index.ts`,
  // which refuses to construct it outside development.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.info(
      `[LeadSubmission:development] ${kind} was NOT sent. No API is configured.`,
    )
  }
}

const NOT_CONFIGURED = {
  ok: false as const,
  reason: 'NOT_CONFIGURED' as const,
  detail:
    'No lead submission endpoint is configured. The development adapter never ' +
    'reports success; see src/lib/submission/development.adapter.ts.',
}

export function createDevelopmentAdapter(): LeadSubmissionService {
  return {
    async submitContact(
      submission: ContactSubmission,
    ): Promise<SubmissionOutcome<ContactSubmissionResult>> {
      logIntent('Contact submission')
      return NOT_CONFIGURED
    },

    async submitEligibility(
      submission: EligibilitySubmission,
    ): Promise<SubmissionOutcome<EligibilitySubmissionResult>> {
      logIntent('Eligibility submission')
      return NOT_CONFIGURED
    },
  }
}
