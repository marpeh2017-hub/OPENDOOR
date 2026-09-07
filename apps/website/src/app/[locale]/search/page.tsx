import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { Link } from '@/i18n/navigation'
import { search } from '@/mock'
export const metadata: Metadata = { title: 'חיפוש', robots: { index: false, follow: true } }
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const he = locale === 'he'
  const raw = (await searchParams).q
  const query = typeof raw === 'string' ? raw.trim().slice(0, 200) : ''
  const results = await search(query, 20, locale as Locale)
  return (
    <>
      <PageHeader title={he ? 'חיפוש באתר' : 'Search the site'} />
      <Section size="md">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-2" htmlFor="site-search">
            {he ? 'מה תרצו למצוא?' : 'What are you looking for?'}
            <input
              id="site-search"
              type="search"
              name="q"
              defaultValue={query}
              maxLength={200}
              className="min-h-11 min-w-0 border border-gray-500 bg-white px-3"
            />
          </label>
          <button type="submit" className="min-h-11 bg-teal-800 px-6 text-white">
            {he ? 'חיפוש' : 'Search'}
          </button>
        </form>
        <div className="mt-8" aria-live="polite">
          {query ? (
            results.items.length ? (
              <ul className="divide-y divide-gray-200">
                {results.items.map((item, i) => (
                  <li key={`${item.href}-${i}`} className="py-5">
                    <Link
                      href={item.href}
                      className="text-lg font-semibold text-teal-900 underline"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-2 text-gray-700">{item.excerpt}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {he
                  ? 'לא נמצאו תוצאות. נסו מילים אחרות או פנו אלינו.'
                  : 'No results found. Try other words or contact us.'}
              </p>
            )
          ) : (
            <p>
              {he
                ? 'חפשו פרויקט, מאמר או שאלה מתוך התוכן שפורסם באתר.'
                : 'Search published projects, articles and questions.'}
            </p>
          )}
          <Link href="/contact" className="mt-6 inline-block py-2 text-teal-900 underline">
            {he ? 'יצירת קשר' : 'Contact us'}
          </Link>
        </div>
      </Section>
    </>
  )
}
