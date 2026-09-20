import type { SubmissionOutcome } from './types'

/** Configuration and unexpected adapter failures must not strand the form. */
export async function submitSafely<T>(
  operation: () => Promise<SubmissionOutcome<T>>,
): Promise<SubmissionOutcome<T>> {
  try {
    return await operation()
  } catch {
    // Never return exception text: it can contain endpoint or personal data.
    return { ok: false, reason: 'UNKNOWN' }
  }
}
