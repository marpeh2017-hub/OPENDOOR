import { localeAlternates } from '@/lib/seo'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { StartProtocolForm } from '@/components/forms/start-protocol-form'

/**
 * Start a representation in your building: the representation-appointment
 * protocol for a building that is not yet a project, filled in and signed by
 * the owner who starts it, with a link for the neighbours at the end. The
 * owner's way (2026-10-10) for the website to bring in new buildings.
 */
async function pageMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.forms' })
  return { title: t('startHeading'), description: t('startStandfirst') }
}

export default async function StartProtocolPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, tNav] = await Promise.all([getTranslations('pages.forms'), getTranslations('nav')])

  return (
    <>
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10 lg:py-12">
          <nav aria-label={tNav('breadcrumb')}>
            <Link href="/forms" className="inline-flex min-h-11 items-center type-small font-semibold">
              {tNav('forms')}
            </Link>
          </nav>
          <h1 className="mt-2 text-balance type-h1 font-extrabold text-gray-900">{t('startHeading')}</h1>
          <p className="mt-4 max-w-2xl text-pretty type-lead text-gray-600">{t('startStandfirst')}</p>
        </div>
      </section>
      <section className="bg-surface-page">
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
          <StartProtocolForm />
        </div>
      </section>
    </>
  )
}

export async function generateMetadata(props: Parameters<typeof pageMetadata>[0]): Promise<Metadata> {
  const { locale } = await props.params
  return { ...(await pageMetadata(props)), alternates: localeAlternates(locale, '/forms/representation-protocol/start') }
}
