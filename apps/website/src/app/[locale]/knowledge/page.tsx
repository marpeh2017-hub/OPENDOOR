import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { Link } from '@/i18n/navigation'
import { getCmsArticles } from '@/lib/cms-source'
import { makeLocalizer } from '@/lib/localize'

/**
 * Knowledge Center — real articles, managed in the Site Manager.
 *
 * Replaces the PageShell placeholder with a real listing that reads from
 * `getCmsArticles()`. No articles are invented: `MOCK_ARTICLES` in
 * `mock/fixtures/knowledge.ts` is explicitly marked mock data pending review
 * and was left untouched, so an intentional, designed empty state is what a
 * visitor sees until someone publishes a real article — never a placeholder,
 * never fabricated content.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.knowledge' })
  return {
    title: t('title'),
    description: t('empty'),
    robots: { index: (await getCmsArticles()).length > 0, follow: true },
  }
}

export default async function KnowledgePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, articles] = await Promise.all([getTranslations('pages.knowledge'), getCmsArticles()])
  const loc = makeLocalizer(locale as Locale)

  return (
    <>
      <PageHeader title={t('title')} />
      <Section size="md">
        {articles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-surface-sunken px-6 py-14 text-center">
            <p className="text-base text-gray-700">{t('empty')}</p>
            <Link href="/contact" className="mt-4 inline-block py-2 text-teal-900 underline">
              {locale === 'he' ? 'יצירת קשר' : 'Contact us'}
            </Link>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/knowledge/${a.slug}`}
                  className="block h-full rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-teal-300"
                >
                  {a.category && (
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-teal-800">
                      {loc.text(a.category)}
                    </span>
                  )}
                  <h2 className="mt-2 text-[17px] font-semibold leading-snug text-gray-900">
                    {loc.text(a.title)}
                  </h2>
                  {a.summary && (
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      {loc.text(a.summary)}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
