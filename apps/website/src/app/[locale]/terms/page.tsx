import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { STUB_ROBOTS } from '@/lib/seo'
import { TermsContent } from '@/components/legal/legal-sections'

/**
 * Terms of use.
 *
 * Same honest-notice treatment as `/privacy` and for the same reason: no
 * approved terms-of-use text exists, none is invented, and the visitor sees
 * an ordinary sentence rather than internal build status. See the longer
 * note in `privacy/page.tsx`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.terms' })
  return { title: t('title'), robots: STUB_ROBOTS }
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pages.terms')

  return (
    <>
      <PageHeader title={t('title')} />
      <Section size="sm">
        <TermsContent english={locale === 'en'} />
      </Section>
    </>
  )
}
