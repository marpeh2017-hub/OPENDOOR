import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

/**
 * Homepage.
 *
 * Phase 1 shell: the hero's positioning statement and the two persistent CTAs
 * only. The remaining sections (Why Organizer, How We Work, Projects,
 * Transparency, Trust, Knowledge, FAQ) are built in later tasks as CMS blocks.
 *
 * NO statistics, testimonials, partner names, project counts or years of
 * experience appear here, and none are placeholdered — per the specification
 * those must not exist until verified data is supplied.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const [tBrand, tCta] = await Promise.all([
    getTranslations('brand'),
    getTranslations('cta'),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-8">
      <section className="py-20 lg:py-28">
        <div className="max-w-3xl">
          <h1 className="text-display-sm font-bold text-gray-900 sm:text-display-md">
            {tBrand('name')}
          </h1>
          <p className="mt-6 max-w-prose text-lg text-gray-700 sm:text-xl">
            {tBrand('tagline')}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/eligibility"
              className="inline-flex items-center justify-center rounded-md bg-teal-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-teal-700"
            >
              {tCta('eligibility')}
            </Link>
            <Link
              href="/why-organizer"
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-800 transition-colors hover:bg-gray-50"
            >
              {tCta('residentPortal')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
