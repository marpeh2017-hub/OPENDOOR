/**
 * Destinations that live outside this app.
 *
 * The portal runs as a separate Next.js app on its own port, so it cannot be
 * reached through the locale-aware Link — it needs an absolute URL.
 *
 * TODO(env): add NEXT_PUBLIC_PORTAL_URL to the deployment environment. It has
 * to be NEXT_PUBLIC_ because the header that links to it is a client component.
 * The fallback below is the local dev port from apps/portal/package.json.
 */
export const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3002'

/**
 * The contact form lives on the home page, not on a route of its own. The
 * leading slash matters: a bare '#contact' resolves against whatever page the
 * header is rendered on, which on a legal page points at nothing.
 */
export const CONTACT_ANCHOR = '/#contact'
