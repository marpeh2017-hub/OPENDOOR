import { NextRequest, NextResponse } from 'next/server'
import { sessionResponse } from '@/lib/session'

/**
 * Step 2 of resident sign-in: redeem the code.
 *
 * ── WHY THE TOKENS STOP HERE ────────────────────────────────────────────────
 *
 * The gateway answers with an access token and a refresh token. Neither is
 * returned to the browser: they are written as httpOnly cookies and the client
 * receives only the resident's display details. Client-side JavaScript can
 * therefore never read the session, which takes XSS from "steal the session"
 * down to "act inside the current page", and matches how the CRM has held its
 * own token since it was built.
 *
 * ── THE THIRD ANSWER ────────────────────────────────────────────────────────
 *
 * This endpoint has three outcomes, not two. When one phone matches several
 * resident records the gateway replies 200 with a selection challenge and NO
 * session, and that reply must be forwarded as-is: setting a cookie here would
 * mean inventing a session the gateway deliberately refused to issue.
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const apiRes = await fetch(`${API_BASE}/api/v1/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const data = await apiRes.json().catch(() => ({}))
    if (!apiRes.ok) {
      return NextResponse.json(data, { status: apiRes.status })
    }

    // The selection challenge: a half-authenticated state that carries no
    // session. Forwarded untouched, cookies deliberately not set.
    if (data.selectionRequired) {
      return NextResponse.json(data, { status: 200 })
    }

    return sessionResponse(data)
  } catch {
    return NextResponse.json({ message: 'שגיאת שרת' }, { status: 500 })
  }
}
