import type { Locale, SubmissionMetadata } from '@urban-renewal/api-contracts'
import { createApiAdapter } from './api.adapter'
import { createDevelopmentAdapter } from './development.adapter'
import type { LeadSubmissionService } from './types'
export { submitSafely } from './safe-submit'

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
  const explicitEndpoint = process.env['NEXT_PUBLIC_LEADS_ENDPOINT']?.trim()
  const apiOrigin = process.env['NEXT_PUBLIC_API_URL']?.trim().replace(/\/$/, '')
  const endpoint = explicitEndpoint || (apiOrigin ? `${apiOrigin}/api/v1/public/leads` : '')

  if (!endpoint) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'No lead submission endpoint is configured. Set NEXT_PUBLIC_LEADS_ENDPOINT ' +
          'or NEXT_PUBLIC_API_URL. ' +
          'The development adapter must never be used in production: it cannot ' +
          'deliver a submission, and using it here would drop real enquiries.',
      )
    }
    return createDevelopmentAdapter()
  }

  return createApiAdapter(endpoint)
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
  form: { submissionId: string; renderedAt: string },
): SubmissionMetadata {
  const params = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()

  const utmSource = params.get('utm_source')?.trim()
  const utmMedium = params.get('utm_medium')?.trim()
  const utmCampaign = params.get('utm_campaign')?.trim()

  return {
    submissionId: form.submissionId,
    sourcePage,
    locale,
    formRenderedAt: form.renderedAt,
    submittedAt: new Date().toISOString(),
    privacyPolicyVersion: '2026-09-08',
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
  }
}
