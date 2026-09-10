import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ACCESS_COOKIE } from '@/lib/session'

/**
 * Forwards a preferences change to the gateway.
 *
 * The body is passed through UNTOUCHED rather than being filtered here. The
 * gateway's DTO is the allow-list — a field a resident may not set is a 400
 * there — and re-implementing that list in the browser-facing layer would
 * create a second opinion about which one is authoritative. A filter here would
 * also quietly hide the 400, turning "you may not change that" into "nothing
 * happened".
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function PATCH(req: NextRequest) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  if (!token) return NextResponse.json({ message: 'לא מחובר' }, { status: 401 })

  try {
    const body = await req.json()
    const apiRes = await fetch(`${API_BASE}/api/v1/portal/profile`, {
      method: 'PATCH',
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
