import { getTranslations } from 'next-intl/server'

/**
 * Placeholder shell for Phase 1 route skeletons.
 *
 * Every page below the homepage renders this until its real content is built.
 * It exists so the routes are navigable, the heading hierarchy is already
 * correct, and the layout/landmarks can be tested — without any page pretending
 * to have content it does not have.
 *
 * The notice states plainly that this is a shell. A blank page would be
 * indistinguishable from a broken one during review.
 */
export async function PageShell({ title }: { title: string }) {
  const t = await getTranslations('common')
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-prose text-base text-gray-600">{t('comingSoon')}</p>
      <p className="mt-2 max-w-prose text-sm text-gray-500">{t('placeholderNotice')}</p>
    </div>
  )
}
