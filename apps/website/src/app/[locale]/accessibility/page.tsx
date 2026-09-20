import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { AccessibilityContent } from '@/components/legal/legal-sections'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.accessibility' })
  return { title: t('title') }
}

export default async function AccessibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pages.accessibility')
  return <><PageHeader title={t('title')} /><Section size="sm"><AccessibilityContent english={locale === 'en'} /></Section></>
}
