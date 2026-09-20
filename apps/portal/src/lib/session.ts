import { NextResponse } from 'next/server'

/**
 * How a resident session is stored, in one place.
 *
 * Both sign-in endings — a straight OTP verify, and a verify that needed the
 * resident to choose between two of their own records — finish here, so there
 * is a single answer to "where does the token live" rather than two that drift.
 *
 * The tokens never reach client-side JavaScript. They are set as httpOnly
 * cookies on this origin and read back server-side, which is the same
 * arrangement the CRM uses and the reason an XSS on the portal cannot walk away
 * with a thirty-day session.
 */

/** Matches ACCESS_TOKEN_TTL in the gateway's PortalAuthService. */
const ACCESS_MAX_AGE = 60 * 60 * 12
/** Matches REFRESH_TOKEN_TTL. */
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30

export const ACCESS_COOKIE = 'access_token'
export const REFRESH_COOKIE = 'refresh_token'
/** The refresh token is scoped to the only route allowed to spend it. */
export const REFRESH_COOKIE_PATH = '/api/auth/refresh'

export function sessionResponse(data: {
  accessToken: string
  refreshToken: string
  resident?: unknown
}) {
  const response = NextResponse.json({ resident: data.resident }, { status: 200 })

  response.cookies.set(ACCESS_COOKIE, data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ACCESS_MAX_AGE,
    path: '/',
  })

  // A refresh token readable on every request is a second access token with a
  // thirty-day life, so it is confined to the route that redeems it.
  response.cookies.set(REFRESH_COOKIE, data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_MAX_AGE,
    path: REFRESH_COOKIE_PATH,
  })

  return response
}

/** Clears both cookies. `path` must match how each was set or the browser keeps it. */
export function clearSession(response: NextResponse) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
  }
  response.cookies.set(ACCESS_COOKIE, '', { ...base, path: '/' })
  response.cookies.set(REFRESH_COOKIE, '', { ...base, path: REFRESH_COOKIE_PATH })
  return response
}
