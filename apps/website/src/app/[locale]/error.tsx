'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

/**
 * Route-level error boundary.
 *
 * The error OBJECT is never rendered. Its message routinely carries internal
 * detail — identifiers, table names, stack frames — and a public marketing site
 * is the last place that should appear. The user gets a sentence and a retry;
 * the real error goes to the console now and to error monitoring later (§47).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')

  useEffect(() => {
    // Replaced by the monitoring provider in a later task. Deliberately not
    // wired to a third-party service during Phase 1.
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">{t('genericTitle')}</h1>
      <p className="mt-3 max-w-prose text-gray-600">{t('genericBody')}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex items-center rounded-md bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
      >
        {t('retry')}
      </button>
    </div>
  )
}
