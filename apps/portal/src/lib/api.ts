import { cookies } from 'next/headers'
import { ACCESS_COOKIE } from './session'

/**
 * Server-side reads from the API Gateway, for React Server Components.
 *
 * ── WHY THERE IS NO CLIENT-SIDE FETCH HERE ──────────────────────────────────
 *
 * The session cookie is httpOnly and scoped to this origin, so the browser
 * cannot send it cross-origin to the gateway and client JavaScript cannot read
 * it to attach a header. The CRM solves that with a same-origin proxy route
 * because it fetches from the client.
 *
 * The portal's pages are server components: they can read the cookie directly
 * through `next/headers` and call the gateway from the server, so the token
 * never travels to the browser at all and there is no proxy hop to secure. A
 * proxy becomes worth building when a portal page needs to fetch after render —
 * not before.
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/** A caller with no valid session. The page turns this into a redirect to sign-in. */
export class NotAuthenticated extends Error {
  constructor(readonly code?: string) {
    super('Not authenticated')
    this.name = 'NotAuthenticated'
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  if (!token) throw new NotAuthenticated()

  const res = await fetch(`${API_BASE}/api/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    // A dashboard is per-resident and changes as the project moves. Caching it
    // is how one resident ends up looking at another's page.
    cache: 'no-store',
  })

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    // The gateway distinguishes "expired" from "your placement changed"; both
    // end the session, and the code is what lets the sign-in page say which.
    throw new NotAuthenticated(body?.code)
  }
  if (!res.ok) {
    throw new Error(`Gateway responded ${res.status} for ${path}`)
  }

  return res.json() as Promise<T>
}
