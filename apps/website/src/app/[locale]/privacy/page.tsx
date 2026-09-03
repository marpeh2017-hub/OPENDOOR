import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { Link } from '@/i18n/navigation'
import { STUB_ROBOTS } from '@/lib/seo'

/**
 * Privacy policy.
 *
 * ── AN HONEST NOTICE, NOT A DEVELOPER PLACEHOLDER ──────────────────────────
 *
 * No approved privacy-policy text exists yet, and none is invented here —
 * legal copy is the one thing this project has been explicit cannot be
 * authored by guessing. The Pass 4A/4B `PageShell` this replaced said
 * "Page shell. Content is built in later tasks and will be editable through
 * the CMS", which is true and also internal build status that a visitor has
 * no reason to read.
 *
 * This says the same underlying fact — the policy is not finished — in one
 * ordinary sentence a company might put on any page while legal text is being
 * finalised, with a way to actually reach someone. `STUB_ROBOTS` (noindex)
 * stays: there is still nothing here worth a search result.
 *
 * A CMS DRAFT row exists for this slug (kind PAGE, "privacy") marked LEGAL
 * CONTENT REQUIRED — see `docs/ODG_CMS_ARCHITECTURE.md` Appendix E — so this
 * is not the only place that gap is recorded, only the public-facing one.
 * The slug is deliberately absent from `CMS_MANAGED_SLUGS`: this route serves
 * from code until real legal text is entered and someone migrates it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.privacy' })
  return { title: t('title'), robots: STUB_ROBOTS }
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pages.privacy')

  return (
    <>
      <PageHeader title={t('title')} />
      <Section size="sm">
        <p className="max-w-prose text-base leading-relaxed text-gray-700">{t('notice')}</p>
        <Link
          href="/contact"
          className="mt-4 inline-flex items-center gap-2 text-[15px] font-semibold text-teal-700 hover:underline"
        >
          {t('contactLink')}
        </Link>
      </Section>
    </>
  )
}
