import { redirect } from 'next/navigation'
import { PORTAL_URL } from '@/lib/site-config'
import { RESIDENT_PORTAL_HREF } from '@/lib/navigation'

/**
 * `/portal` — the one address every "personal area" link points at.
 *
 * It owns no content. It forwards to the portal app when one is configured, and
 * to the explanatory page when one is not, so that:
 *
 *   - CMS content can link to `/portal` and stay correct across environments,
 *     instead of carrying a hardcoded URL that is right in production and dead
 *     in development, or the reverse;
 *   - the portal's address changes in exactly one place, `NEXT_PUBLIC_PORTAL_URL`;
 *   - before the portal is deployed, nobody is sent to an address that does not
 *     resolve.
 *
 * The portal serves the same locales as this site (and more), and its root
 * redirects an unauthenticated visitor to `/{locale}/login`, so forwarding to
 * `/{locale}` lands a signed-out owner on sign-in and a signed-in one on their
 * own file.
 *
 * Temporary redirect, not permanent: the destination is configuration, and a
 * cached 308 would outlive a change to it.
 */
export default async function PortalRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(PORTAL_URL ? `${PORTAL_URL}/${locale}` : `/${locale}${RESIDENT_PORTAL_HREF}`)
}
