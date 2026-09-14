'use client'

import { useEffect, useRef, useState } from 'react'

/** How often the open form refreshes its rendered-at stamp. */
const REFRESH_INTERVAL_MS = 30 * 60 * 1_000

/**
 * How far back each refreshed stamp is dated.
 *
 * The server rejects a submission that arrives less than 3 seconds after the
 * stamp, as a bot signal. Refreshing to exactly "now" would therefore create a
 * new failure mode: a visitor who submits within 3 seconds of a refresh would
 * be silently discarded. Backdating by a minute keeps every refreshed stamp
 * clear of that floor, and is still honest — the timer only fires after the
 * form has been open for half an hour.
 */
const BACKDATE_MS = 60 * 1_000

export interface FormIdentity {
  /** Stable for the life of the form: the server uses it to reject replays. */
  submissionId: string
  /** Refreshed periodically so a long-open tab does not go stale. */
  renderedAt: string
}

function stamp(): string {
  return new Date(Date.now() - BACKDATE_MS).toISOString()
}

/**
 * Identity for one public form submission.
 *
 * The server discards a submission whose stamp is older than six hours, which
 * a tab left open overnight would otherwise trip — the visitor would be told
 * their enquiry was received while nothing was stored. Refreshing the stamp
 * while the form sits open keeps that from happening.
 *
 * `read()` returns the current value at submit time rather than a value
 * captured in a render, so a submission never carries a stamp the interval has
 * already replaced.
 */
export function useFormIdentity(): { read: () => FormIdentity } {
  const [submissionId] = useState(() => crypto.randomUUID())
  const renderedAt = useRef(new Date().toISOString())

  useEffect(() => {
    const id = setInterval(() => {
      renderedAt.current = stamp()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return {
    read: () => ({ submissionId, renderedAt: renderedAt.current }),
  }
}
