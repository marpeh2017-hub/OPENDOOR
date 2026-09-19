import type {
  ContactSubmission,
  ContactSubmissionResult,
  EligibilitySubmission,
  EligibilitySubmissionResult,
} from '@urban-renewal/api-contracts'
import type { LeadSubmissionService, SubmissionOutcome } from './types'

const REQUEST_TIMEOUT_MS = 12_000

function publicPayload(
  kind: 'CONTACT' | 'ELIGIBILITY',
  submission: ContactSubmission | EligibilitySubmission,
) {
  const metadata = submission.metadata
  return {
    kind,
    submissionId: metadata.submissionId,
    fullName: submission.fullName,
    phone: submission.phone,
    email: submission.email,
    message: 'message' in submission ? submission.message : submission.notes,
    ...('address' in submission
      ? {
          address: submission.address,
          city: submission.city,
          estimatedUnits: submission.approximateApartmentCount,
          leadType: submission.leadType,
          projectType: submission.projectType,
          organizingStatus: submission.organizingStatus,
        }
      : {}),
    consentContact: submission.consentContact,
    consentPrivacy: submission.consentPrivacy,
    privacyPolicyVersion: metadata.privacyPolicyVersion,
    sourcePage: metadata.sourcePage,
    locale: metadata.locale,
    submittedAt: metadata.submittedAt,
    renderedAt: metadata.formRenderedAt,
    utmSource: metadata.utmSource,
    utmMedium: metadata.utmMedium,
    utmCampaign: metadata.utmCampaign,
    company: submission.company,
  }
}

async function post<T>(endpoint: string, body: unknown): Promise<SubmissionOutcome<T>> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
    })

    if (response.status === 429) return { ok: false, reason: 'RATE_LIMITED' }
    if (response.status >= 400 && response.status < 500) {
      return { ok: false, reason: 'REJECTED' }
    }
    if (!response.ok) return { ok: false, reason: 'UNKNOWN' }

    return { ok: true, result: { received: true } as T }
  } catch (error) {
    return {
      ok: false,
      reason: 'NETWORK',
      detail: error instanceof Error ? error.name : 'Network request failed',
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

export function createApiAdapter(endpoint: string): LeadSubmissionService {
  return {
    submitContact(submission) {
      return post<ContactSubmissionResult>(endpoint, publicPayload('CONTACT', submission))
    },
    submitEligibility(submission) {
      return post<EligibilitySubmissionResult>(
        endpoint,
        publicPayload('ELIGIBILITY', submission),
      )
    },
  }
}
