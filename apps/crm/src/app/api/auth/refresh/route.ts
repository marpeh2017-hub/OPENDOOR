import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.API_GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refresh_token')?.value

  if (!refreshToken) {
    return NextResponse.json({ message: 'לא מחובר' }, { status: 401 })
  }

  try {
    const apiRes = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!apiRes.ok) {
      const response = NextResponse.json({ message: 'פג תוקף — יש להתחבר מחדש' }, { status: 401 })
      // `path` must match how each cookie was set, or the browser keeps it.
      response.cookies.set('access_token', '', {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', maxAge: 0, path: '/',
      })
      response.cookies.set('refresh_token', '', {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', maxAge: 0, path: '/api/auth/refresh',
      })
      return response
    }

    const { accessToken } = await apiRes.json()

    const response = NextResponse.json({ success: true })
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json({ message: 'שגיאת שרת' }, { status: 500 })
  }
}
