import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ACCESS_COOKIE } from '@/lib/session'

/**
 * Replies to one of the resident's own tickets.
 *
 * The id is forwarded and checked at the gateway INSIDE a query scoped to the
 * session, so a ticket belonging to a co-resident is a 404 there. Nothing is
 * validated here that would have to be kept in step with it.
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  if (!token) return NextResponse.json({ message: 'לא מחובר' }, { status: 401 })

  try {
    const apiRes = await fetch(
      `${API_BASE}/api/v1/portal/support/${encodeURIComponent(id)}/replies`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(await req.json()),
        cache: 'no-store',
      },
    )
    return NextResponse.json(await apiRes.json().catch(() => ({})), { status: apiRes.status })
  } catch {
    return NextResponse.json({ message: 'שגיאת שרת' }, { status: 500 })
  }
}
