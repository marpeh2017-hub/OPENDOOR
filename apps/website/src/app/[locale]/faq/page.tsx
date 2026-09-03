import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { getCmsFaqItems } from '@/lib/cms-source'
import { makeLocalizer } from '@/lib/localize'

/**
 * Frequently asked questions — real content, managed in the Site Manager.
 *
 * ── REPLACES A DEVELOPER PLACEHOLDER ────────────────────────────────────────
 *
 * Until Pass 4G this rendered `PageShell`'s "Page shell. Content is built in
 * later tasks..." to every visitor. It now reads published questions from
 * the CMS and renders an honest, designed empty state when there are none —
 * never the placeholder, and never a blank page indistinguishable from a
 * broken one.
 *
 * The homepage's own FAQ teaser block is untouched and still reads its five
 * questions from the code fixture (`MOCK_FAQ`) — that fixture is explicitly
 * marked as mock data pending real review, so Pass 4G did not promote it into
 * the live CMS as if it were approved copy. This page and that block will say
 * different things until an editor either publishes real questions here or
 * the fixture is reviewed and migrated; noted in the pass report.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.faq' })
  return { title: t('title') }
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, items] = await Promise.all([
    getTranslations('pages.faq'),
    getCmsFaqItems(),
  ])
  const loc = makeLocalizer(locale as Locale)

  return (
    <>
      <PageHeader title={t('title')} />
      <Section size="md">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-surface-sunken px-6 py-14 text-center">
            <p className="text-base text-gray-700">{t('empty')}</p>
          </div>
        ) : (
          <dl className="divide-y divide-gray-200">
            {items.map((item) => (
              <div key={item.id} className="py-6 first:pt-0 last:pb-0">
                <dt className="text-[17px] font-semibold text-gray-900">
                  {loc.text(item.question)}
                </dt>
                <dd className="mt-2 max-w-prose text-[15px] leading-relaxed text-gray-600">
                  {loc.text(item.answer)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>
    </>
  )
}
