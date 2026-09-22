import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

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
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },

  transpilePackages: ['@urban-renewal/design-system'],
}

export default withNextIntl(config)
