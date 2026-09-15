import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ACCESS_COOKIE } from '@/lib/session'

/**
 * Forwards a chat turn to the gateway's resident AI assistant.
 *
 * The body is passed through untouched — same reasoning as the other portal
 * proxy routes: `PortalChatDto` on the gateway is the allow-list.
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  if (!token) return NextResponse.json({ message: 'לא מחובר' }, { status: 401 })

  try {
    const apiRes = await fetch(`${API_BASE}/api/v1/portal/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(await req.json()),
      cache: 'no-store',
    })
    return NextResponse.json(await apiRes.json().catch(() => ({})), { status: apiRes.status })
  } catch {
    return NextResponse.json({ message: 'שגיאת שרת' }, { status: 500 })
  }
}
