import { NextRequest, NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
]

function isPublicPath(pathname: string): boolean {
  // Remove locale prefix (e.g. /he/login -> /login)
  const withoutLocale = pathname.replace(/^\/(he|en|ru|ar)/, '') || '/'
  return PUBLIC_PATHS.some(p => withoutLocale.startsWith(p))
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip API routes and static files
  if (pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Apply intl routing first
  const intlResponse = intlMiddleware(req)

  // Check auth for protected routes
  const accessToken = req.cookies.get('access_token')?.value

  if (!accessToken && !isPublicPath(pathname)) {
    const LOCALES = ['he', 'en', 'ru', 'ar']
    const segment = pathname.split('/')[1] ?? ''
    const locale = LOCALES.includes(segment) ? segment : 'he'
    const loginUrl = new URL(`/${locale}/login`, req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return intlResponse
}

export const config = {
  matcher: ['/((?!_next|_vercel|favicon.ico|.*\\..*).*)',],
}
