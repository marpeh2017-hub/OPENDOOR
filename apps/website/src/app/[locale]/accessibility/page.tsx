import { localeAlternates } from '@/lib/seo'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { AccessibilityContent } from '@/components/legal/legal-sections'

async function pageMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
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

/**
 * Canonical and hreflang, added around the page's own metadata so each page
 * keeps owning its title and description.
 */
export async function generateMetadata(
  props: Parameters<typeof pageMetadata>[0],
): Promise<Metadata> {
  const { locale } = await props.params
  return { ...(await pageMetadata(props)), alternates: localeAlternates(locale, '/accessibility') }
}
