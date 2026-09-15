import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value

  // Revoke the session server-side (writes jwt:revoked:{sessionId} in Redis).
  // Best-effort: cookies are cleared regardless so the user is always logged
  // out locally even if the API Gateway is unreachable.
  if (accessToken) {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
    } catch {
      // Swallow — never block logout on upstream availability.
    }
  }

  const response = NextResponse.json({ success: true })

  // `path` MUST match the path the cookie was set with, otherwise the browser
  // keeps the cookie. refresh_token is scoped to /api/auth/refresh.
  response.cookies.set('access_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })

  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/api/auth/refresh',
  })

  return response
}
