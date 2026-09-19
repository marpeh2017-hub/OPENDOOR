import { NextRequest, NextResponse } from 'next/server'
import { sessionResponse } from '@/lib/session'

/**
 * Step 3, when one phone matched more than one resident record: the choice.
 *
 * The gateway checks that the chosen id was actually offered by that challenge,
 * so this route forwards rather than validates — re-implementing the check here
 * would create a second opinion about which one is authoritative.
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  try {
    const { selectionToken, residentId } = await req.json()

    const apiRes = await fetch(`${API_BASE}/api/v1/auth/portal/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectionToken, residentId }),
      cache: 'no-store',
    })

    const data = await apiRes.json().catch(() => ({}))
    if (!apiRes.ok) return NextResponse.json(data, { status: apiRes.status })

    return sessionResponse(data)
  } catch {
    return NextResponse.json({ message: 'שגיאת שרת' }, { status: 500 })
  }
}
