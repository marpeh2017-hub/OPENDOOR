import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/**
 * Asks the API to email a sign-in code: the email counterpart of
 * `../../send/route.ts`. The API answers the same for any address, so this
 * forwards its answer as it is.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    const apiRes = await fetch(`${API_BASE}/api/v1/auth/otp/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: typeof email === 'string' ? email.trim() : email }),
      cache: 'no-store',
    })

    const data = await apiRes.json().catch(() => ({}))
    return NextResponse.json(data, { status: apiRes.status })
  } catch {
    return NextResponse.json({ message: 'שגיאת שרת' }, { status: 500 })
  }
}
