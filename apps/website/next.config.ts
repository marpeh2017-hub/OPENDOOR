import type { NextConfig } from 'next'
import path from 'node:path'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/**
 * Fly.io images build with NEXT_OUTPUT=standalone (apps/Dockerfile.next): a
 * self-contained server.js plus only the node_modules it uses. Tracing starts
 * at the repository root, or the workspace packages and pnpm's store would be
 * left out of the image. Local and Vercel builds don't set the variable and are
 * unchanged.
 */
const standalone: Partial<NextConfig> =
  process.env.NEXT_OUTPUT === 'standalone'
    ? { output: 'standalone', outputFileTracingRoot: path.join(process.cwd(), '..', '..') }
    : {}

/**
 * Security headers for the public marketing site.
 *
 * Next sets none of these on its own, so without this block the site ships
 * with no clickjacking protection, no MIME-sniffing protection and no HSTS.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ──────────────────────────────────────────
 *
 * Content-Security-Policy. The obvious `default-src 'self'` breaks Next: the
 * framework injects inline bootstrap scripts and inline styles on every page,
 * so a CSP without either a per-request nonce or `'unsafe-inline'` turns the
 * site blank — and `'unsafe-inline'` on script-src gives away most of what a
 * CSP is for. Doing it properly means generating a nonce in middleware and
 * threading it through, which is a change worth testing on its own rather than
 * smuggling in beside four one-line headers.
 *
 * X-XSS-Protection. Deprecated. The legacy auditor it enabled introduced its
 * own vulnerabilities, every current browser ignores the header, and Chrome
 * removed the feature outright. Setting `1; mode=block` in 2026 signals
 * diligence without providing any.
 */
const securityHeaders = [
  // Only meaningful once TLS terminates in front of this app; harmless before
  // then, because a browser ignores it when it arrives over plain HTTP.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The site asks for none of these, so it should not be able to.
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), payment=()' },
]

const config: NextConfig = {
  ...standalone,

  // Keep a local integration dev preview separate from a running built preview.
  distDir: process.env.WEBSITE_PREVIEW === 'true' ? '.next-preview' : '.next',

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },

  // The knowledge centre was removed on 2026-10-07 and the forms page took its
  // place, so its addresses, and any link or bookmark to them, lead there.
  async redirects() {
    return [
      { source: '/:locale(he|en)/knowledge/:path*', destination: '/:locale/forms', permanent: true },
      { source: '/knowledge/:path*', destination: '/he/forms', permanent: true },
    ]
  },

  // Workspace packages ship TypeScript source rather than build output, so Next
  // must compile them. `api-contracts` is types-only and erases, but it is
  // listed anyway: it exports one runtime constant (PROJECT_STAGE_ORDER).
  transpilePackages: [
    '@urban-renewal/design-system',
    '@urban-renewal/ui',
    '@urban-renewal/api-contracts',
  ],
}

export default withNextIntl(config)
