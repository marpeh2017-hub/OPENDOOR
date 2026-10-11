import { redirect } from 'next/navigation'
import { PORTAL_URL } from '@/lib/site-config'
import { RESIDENT_PORTAL_HREF } from '@/lib/navigation'

/**
 * `/portal/register`: the way to the personal area's registration, for
 * someone whose phone and email are not on a resident file yet.
 *
 * Like `/portal`, it owns no content: it forwards to the portal app's
 * registration page when the portal is configured, and to the explanatory
 * page when it is not, so no link points at an address that does not
 * resolve. Temporary redirect, for the same reason as `/portal`'s.
 */
export default async function PortalRegisterRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(PORTAL_URL ? `${PORTAL_URL}/${locale}/register` : `/${locale}${RESIDENT_PORTAL_HREF}`)
}
