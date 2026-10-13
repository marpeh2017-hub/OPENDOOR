import type { NextConfig } from 'next'
import path from 'node:path'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/**
 * Fly.io images build with NEXT_OUTPUT=standalone (apps/Dockerfile.next). See
 * apps/website/next.config.ts. Local and Vercel builds are unchanged.
 */
const standalone: Partial<NextConfig> =
  process.env.NEXT_OUTPUT === 'standalone'
    ? { output: 'standalone', outputFileTracingRoot: path.join(process.cwd(), '..', '..') }
    : {}

/**
 * Security headers. Next sets none of its own, so without this every response
 * goes out with no clickjacking protection, no MIME-sniffing protection and no
 * HSTS. `source` covers API route handlers in this app as well as pages.
 *
 * No Content-Security-Policy and no X-XSS-Protection here, for the reasons set
 * out in apps/website/next.config.ts: a naive CSP blanks a Next app, and
 * X-XSS-Protection is deprecated and ignored.
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()' },
]

const config: NextConfig = {
  ...standalone,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },

  transpilePackages: ['@urban-renewal/design-system', '@urban-renewal/api-contracts'],
}

export default withNextIntl(config)
