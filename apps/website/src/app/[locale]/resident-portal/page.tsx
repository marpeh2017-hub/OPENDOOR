import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageShell } from '@/components/layout/page-shell'
import { STUB_ROBOTS } from '@/lib/seo'

/**
 * Resident portal entry point.
 *
 * ── THIS ROUTE DID NOT EXIST ────────────────────────────────────────────────
 *
 * The header (desktop and mobile), the hero's secondary CTA, and `mobile-nav`
 * all link here via `RESIDENT_PORTAL_HREF`. With no route at this path every
 * one of those — the second most prominent control in the header, after
 * eligibility — 404'd. That is the definition of a dead link, on the single
 * highest-traffic entry point on the site (it renders on every page).
 *
 * ── WHY THIS IS A SKELETON AND NOT A LOGIN SCREEN ──────────────────────────
 *
 * Building a sign-in form here would be fake functionality: there is no
 * authentication behind this route, and a form that cannot authenticate
 * anyone is worse than no form. `RESIDENT_PORTAL_HREF`'s own comment already
 * documents the real plan — the Portal runs as a separate app on :3002 today,
 * and a later Phase 2 task cuts this path over to serve it directly. Until
 * that cutover, this is FUTURE INTEGRATION, not a page for this pass to build.
 *
 * The shared placeholder shell is honest about that: it states plainly that
 * the content is not built yet, rather than presenting an empty page that
 * looks broken or a control that does nothing when pressed.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.residentPortal' })
  return { title: t('title'), robots: STUB_ROBOTS }
}

export default async function ResidentPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pages.residentPortal')
  return <PageShell title={t('title')} />
}
