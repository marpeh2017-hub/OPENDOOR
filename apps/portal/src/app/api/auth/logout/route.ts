import { NextRequest, NextResponse } from 'next/server'
import { ACCESS_COOKIE, clearSession } from '@/lib/session'

/**
 * Sign out.
 *
 * Revoking upstream is best-effort; clearing the cookies is not. If the gateway
 * is unreachable the person in front of the screen must still end up logged
 * out locally, rather than being told sign-out failed and left holding a live
 * session.
 */
const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value

  if (accessToken) {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
    } catch {
      // Swallow — never block sign-out on upstream availability.
    }
  }

  return clearSession(NextResponse.json({ success: true }))
}
