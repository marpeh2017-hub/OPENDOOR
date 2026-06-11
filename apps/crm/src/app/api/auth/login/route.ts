import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Forward to NestJS API Gateway
    const apiRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await apiRes.json()

    if (!apiRes.ok) {
      return NextResponse.json(
        { message: data.message ?? 'אימות נכשל' },
        { status: apiRes.status },
      )
    }

    const { accessToken, refreshToken, user } = data

    // Set httpOnly cookie
    const response = NextResponse.json({ user }, { status: 200 })

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,       // 24h
      path: '/',
    })

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,  // 30 days
      path: '/api/auth/refresh',
    })

    return response
  } catch {
    return NextResponse.json({ message: 'שגיאת שרת' }, { status: 500 })
  }
}
