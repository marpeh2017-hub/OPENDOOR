import { redirect } from 'next/navigation'
import { websitePrivacyUrl } from '@/lib/legal-links'

/** See `terms/page.tsx` — same reasoning, same redirect pattern. */
export default async function PrivacyRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(websitePrivacyUrl(locale))
}
