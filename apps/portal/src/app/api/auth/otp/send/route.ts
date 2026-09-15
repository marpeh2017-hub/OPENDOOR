import { NextRequest, NextResponse } from 'next/server'

/**
 * Step 1 of resident sign-in: ask for a code.
 *
 * A thin same-origin forwarder. It exists so the browser never talks to the API
 * Gateway directly — the session cookie set in the verify step is httpOnly and
 * scoped to this origin, and keeping both halves of the flow on one origin is
 * what lets that cookie stay SameSite=Lax with no CORS credentials.
 *
 * The upstream status is passed through unchanged. A 400 rate-limit and a 401
 * invalid-invitation mean different things to the person holding the phone.
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  try {
    const { phone, invitationToken } = await req.json()

    const apiRes = await fetch(`${API_BASE}/api/v1/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, ...(invitationToken ? { invitationToken } : {}) }),
      cache: 'no-store',
    })

    const data = await apiRes.json().catch(() => ({}))
    return NextResponse.json(data, { status: apiRes.status })
  } catch {
    return NextResponse.json({ message: 'שגיאת שרת' }, { status: 500 })
  }
}
