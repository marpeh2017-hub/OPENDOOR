import { redirect } from 'next/navigation'
import { websiteTermsUrl } from '@/lib/legal-links'

/**
 * The login page links here (`/terms`) before a visitor has any session, so
 * this route must not sit behind the (portal) group's auth check — it
 * doesn't; see `src/lib/legal-links.ts` for why the text itself lives on
 * the marketing site rather than being duplicated into the Portal.
 */
export default async function TermsRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(websiteTermsUrl(locale))
}
