import type { Locale, SubmissionMetadata } from '@urban-renewal/api-contracts'
import { createDevelopmentAdapter } from './development.adapter'
import type { LeadSubmissionService } from './types'

export type {
  LeadSubmissionService,
  SubmissionOutcome,
  SubmissionFailure,
  SubmissionFailureReason,
  SubmissionSuccess,
} from './types'

/**
 * Resolves the adapter the forms will use.
 *
 * ── HOW THE REAL API GETS WIRED IN ─────────────────────────────────────────
 *
 * When the endpoint exists, add `api.adapter.ts` implementing
 * `LeadSubmissionService` over `fetch`, and return it here when
 * `NEXT_PUBLIC_LEADS_ENDPOINT` is set. That is the whole change: no form
 * component is touched, because no form component knows this function exists
 * beyond calling `getLeadSubmissionService()`.
 *
 * ── WHY PRODUCTION REFUSES THE DEVELOPMENT ADAPTER ─────────────────────────
 *
 * A build with no endpoint configured must not quietly ship a form wired to a
 * stand-in. Today that cannot happen silently: the development adapter always
 * fails, so a misconfigured production deploy produces a visible error on
 * every submission rather than a form that appears to work.
 *
 * The `throw` below is the second line of defence, and it fires at the moment
 * of use rather than at import, so a page that merely renders a form still
 * builds. It is deliberately loud: a production site that cannot receive a
 * lead is broken, and it should be obvious immediately rather than discovered
 * from a quiet week of no enquiries.
 */
export function getLeadSubmissionService(): LeadSubmissionService {
  const endpoint = process.env['NEXT_PUBLIC_LEADS_ENDPOINT']

  if (!endpoint) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'No lead submission endpoint is configured (NEXT_PUBLIC_LEADS_ENDPOINT). ' +
          'The development adapter must never be used in production: it cannot ' +
          'deliver a submission, and using it here would drop real enquiries.',
      )
    }
    return createDevelopmentAdapter()
  }

  // The API adapter is built in a later pass, when the endpoint exists. Until
  // then, a configured endpoint with no adapter is a configuration mistake
  // worth failing loudly on rather than silently ignoring.
  throw new Error(
    `NEXT_PUBLIC_LEADS_ENDPOINT is set to "${endpoint}" but no API adapter is ` +
      'implemented yet. Add src/lib/submission/api.adapter.ts before setting it.',
  )
}

/**
 * Builds the attribution that travels with a submission.
 *
 * Collected here, once, so no form can forget it and no form can quietly add
 * to it. Everything in `SubmissionMetadata` is either already known to the
 * page or read from the current URL; nothing is derived from the visitor.
 */
export function buildSubmissionMetadata(
  sourcePage: string,
  locale: Locale,
): SubmissionMetadata {
  const campaign =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('utm_campaign')
      : null

  return {
    sourcePage,
    locale,
    submittedAt: new Date().toISOString(),
    // Only when a campaign parameter is genuinely present. Absent stays absent
    // rather than becoming "direct" or "none", which would make every organic
    // lead look like it came from somewhere.
    ...(campaign ? { campaign } : {}),
  }
}
