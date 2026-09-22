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

  // maplibre-gl is ESM-only and spawns its renderer in a web worker via
  // `new Worker(new URL('./maplibre-gl-worker.mjs', import.meta.url))`. Left
  // untranspiled, the bundler does not rewrite that URL, the worker request
  // falls through to the Next router and returns HTML — the map then renders
  // an empty canvas with no tiles, no attribution and no markers, and fails
  // silently because `load` never fires. Transpiling it makes webpack emit the
  // worker as a real asset.
  transpilePackages: ['@urban-renewal/design-system', '@urban-renewal/db', 'maplibre-gl'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'odg.co.il' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
}

export default withNextIntl(config)
