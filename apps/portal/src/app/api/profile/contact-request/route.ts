import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ACCESS_COOKIE } from '@/lib/session'

/**
 * Files a request for staff to change contact details.
 *
 * The 400 for "you already have one open" is forwarded as-is: it carries the
 * existing ticket id, and the page uses it to say "we already have your
 * request" rather than reporting a failure.
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  if (!token) return NextResponse.json({ message: 'לא מחובר' }, { status: 401 })

  try {
    const body = await req.json()
    const apiRes = await fetch(`${API_BASE}/api/v1/portal/profile/contact-update-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await apiRes.json().catch(() => ({}))
    return NextResponse.json(data, { status: apiRes.status })
  } catch {
    return NextResponse.json({ message: 'שגיאת שרת' }, { status: 500 })
  }
}
