import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageShell } from '@/components/layout/page-shell'

/**
 * Projects
 *
 * Phase 1 route skeleton. Content is built in a later task and will be editable
 * through the CMS, so nothing here hardcodes copy beyond the page title.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.projects' })
  return { title: t('title') }
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pages.projects')
  return <PageShell title={t('title')} />
}
