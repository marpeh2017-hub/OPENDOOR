import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ACCESS_COOKIE } from '@/lib/session'

/**
 * Redirects to a short-lived download URL for one of the resident's documents.
 *
 * ── WHY THE PAGE DOES NOT JUST EMBED THE SIGNED URL ─────────────────────────
 *
 * A signed URL is a bearer capability: anyone holding it can fetch the object
 * until it expires, with no further authentication. Minting one per document
 * while rendering the list would put a working capability for every file into
 * the HTML — including files the resident never opens — where it lands in the
 * page source, the browser cache and any shoulder-surfing screenshot.
 *
 * So the list links here, and the URL is minted only when somebody actually
 * clicks. The gateway re-checks entitlement at that moment, which also means a
 * share revoked between page load and click is correctly refused.
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  if (!token) {
    return NextResponse.redirect(new URL('/he/login', req.url))
  }

  const apiRes = await fetch(
    `${API_BASE}/api/v1/portal/documents/${encodeURIComponent(id)}/download`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  )

  if (!apiRes.ok) {
    // The gateway answers 404 both for "no such document" and "not yours", and
    // that distinction must not be reconstructed here.
    const body = await apiRes.json().catch(() => ({}))
    return NextResponse.json(
      { message: body?.message ?? 'המסמך אינו זמין' },
      { status: apiRes.status },
    )
  }

  const { url } = await apiRes.json()
  // 302, not 307: this is a one-time redirect to a URL that expires, and it
  // must never be cached by the browser or an intermediary.
  return NextResponse.redirect(url, {
    status: 302,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
