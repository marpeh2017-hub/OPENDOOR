import { localeAlternates } from '@/lib/seo'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { PrintButton } from '@/components/forms/print-button'
import { AssemblyNoticeDocument } from '@/components/forms/assembly-notice-document'
import { ASSEMBLY_NOTICE_HREF } from '@/lib/navigation'

/**
 * The notice of an owners' assembly, blank, to read and to print or save as a
 * PDF. Nothing to sign: the notice is what owners receive before an assembly,
 * with its date, time and place filled in, and the line above the document
 * says so. On paper only the document prints.
 */
async function pageMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.forms' })
  return { title: t('noticeTitle'), description: t('noticeDescription') }
}

export default async function AssemblyNoticePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const { locale } = await params
  const { print } = await searchParams
  setRequestLocale(locale)
  const [t, tNav] = await Promise.all([getTranslations('pages.forms'), getTranslations('nav')])

  return (
    <>
      <section className="border-b border-gray-200 bg-white print:hidden">
        <div className="mx-auto max-w-[794px] px-4 py-6 sm:px-0 sm:py-8">
          <nav aria-label={tNav('breadcrumb')}>
            <ol className="flex flex-wrap items-center gap-x-2 type-small text-gray-600">
              <li>
                <Link href="/forms" className="inline-flex min-h-11 items-center font-semibold">
                  {tNav('forms')}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">{t('noticeTitle')}</li>
            </ol>
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PrintButton label={t('print')} autoPrint={print === '1'} />
          </div>
          <p className="mt-4 max-w-prose type-small text-gray-600">{t('noticeNote')}</p>
        </div>
      </section>

      <div className="bg-surface-page px-4 py-8 sm:py-12 print:bg-white print:p-0">
        <AssemblyNoticeDocument />
      </div>
    </>
  )
}

export async function generateMetadata(props: Parameters<typeof pageMetadata>[0]): Promise<Metadata> {
  const { locale } = await props.params
  return { ...(await pageMetadata(props)), alternates: localeAlternates(locale, ASSEMBLY_NOTICE_HREF) }
}
