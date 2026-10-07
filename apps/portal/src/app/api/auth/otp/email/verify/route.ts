import { NextRequest, NextResponse } from 'next/server'
import { sessionResponse } from '@/lib/session'

const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/**
 * Verifies an emailed sign-in code: the email counterpart of
 * `../../verify/route.ts`, with the same three outcomes. An error is
 * forwarded; a selection challenge is forwarded with no cookies, since it is
 * not a session; a session is set as httpOnly cookies.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const apiRes = await fetch(`${API_BASE}/api/v1/auth/otp/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const data = await apiRes.json().catch(() => ({}))
    if (!apiRes.ok) {
      return NextResponse.json(data, { status: apiRes.status })
    }

    if (data.selectionRequired) {
      return NextResponse.json(data, { status: 200 })
    }

    return sessionResponse(data)
  } catch {
    return NextResponse.json({ message: 'שגיאת שרת' }, { status: 500 })
  }
}
