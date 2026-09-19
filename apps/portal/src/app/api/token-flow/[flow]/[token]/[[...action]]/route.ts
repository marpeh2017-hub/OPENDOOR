import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ACCESS_COOKIE } from '@/lib/session'

/**
 * Same-origin proxy for the two tokenised resident flows: signing and RSVP.
 *
 * ── WHY THIS HAD TO EXIST FOR THE ATTRIBUTION TO BE REAL ────────────────────
 *
 * The gateway now records the resident's portal session alongside the token
 * when one is present — a materially stronger record, because it says who was
 * AUTHENTICATED and not merely who held a link.
 *
 * But the signing and invitation pages fetch the gateway CROSS-ORIGIN, and the
 * session cookie is httpOnly and scoped to this origin. The browser will never
 * send it to another origin, and client JavaScript cannot read it to build an
 * `Authorization` header. Without this hop the attribution could never fire
 * from the portal at all: the endpoints would support it and nothing would ever
 * use it.
 *
 * ── AND WHY IT CHANGES NOTHING FOR ANYONE ELSE ──────────────────────────────
 *
 * When there is no cookie the request is forwarded WITHOUT an `Authorization`
 * header, which is byte-for-byte the request the page used to make directly.
 * Somebody who taps the link in their SMS without ever signing in follows the
 * same path they always did.
 *
 * The token in the URL is still what authorises the action. This adds a second
 * fact about who was present; it never substitutes for the first.
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/** The only two flows this proxy will forward, mapped to their gateway paths. */
const FLOWS: Record<string, string> = {
  sign: 'signatures/portal',
  invite: 'meeting-invitations',
}

async function forward(
  req: NextRequest,
  ctx: { params: Promise<{ flow: string; token: string; action?: string[] }> },
) {
  const { flow, token, action } = await ctx.params

  const base = FLOWS[flow]
  if (!base) {
    // An allow-list, not a pass-through: this route must not become a way to
    // reach arbitrary gateway paths with the caller's session attached.
    return NextResponse.json({ message: 'Unknown flow' }, { status: 404 })
  }

  const suffix = (action ?? []).map(encodeURIComponent).join('/')
  const url = `${API_BASE}/api/v1/${base}/${encodeURIComponent(token)}${suffix ? `/${suffix}` : ''}`

  const token_ = (await cookies()).get(ACCESS_COOKIE)?.value
  const body = req.method === 'GET' ? undefined : await req.text()

  const apiRes = await fetch(url, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      // Present only when the resident happens to be signed in. Its absence is
      // the ordinary case and is not an error.
      ...(token_ ? { Authorization: `Bearer ${token_}` } : {}),
    },
    ...(body ? { body } : {}),
    cache: 'no-store',
  })

  const data = await apiRes.json().catch(() => ({}))
  // Status codes pass through untouched: the pages already read 404, 409 and
  // 410 to tell a revoked link from a cancelled meeting, and collapsing them
  // would break messages residents rely on.
  return NextResponse.json(data, { status: apiRes.status })
}

export const GET = forward
export const POST = forward
