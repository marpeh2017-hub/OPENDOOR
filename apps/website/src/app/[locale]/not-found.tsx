import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

/**
 * 404.
 *
 * Calm and helpful (§49): says what happened, offers a way onward, and does not
 * blame the visitor or expose a path. Inside `[locale]` so it keeps the header,
 * footer and correct text direction rather than dropping to a bare page.
 */
export default async function NotFound() {
  const t = await getTranslations('errors')
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center lg:px-8">
      <p className="text-sm font-semibold text-teal-700">404</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">{t('notFoundTitle')}</h1>
      <p className="mt-3 max-w-prose text-gray-600">{t('notFoundBody')}</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center rounded-md bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
      >
        {t('backHome')}
      </Link>
    </div>
  )
}
