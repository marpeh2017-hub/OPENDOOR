import { Link } from '@/i18n/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { getCmsFaqItems } from '@/lib/cms-source'
import { FAQ_SEED } from '@/mock/fixtures/faq'
import { makeLocalizer } from '@/lib/localize'
import { FaqChatWidget } from '@/components/faq/faq-chat-widget'

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
 *
 * ── SEED CONTENT BEHIND THE CMS ─────────────────────────────────────────────
 *
 * When the CMS has nothing published, the page now falls back to the approved
 * questions in `FAQ_SEED` rather than the empty state, and groups them under
 * the headings the copy was written with. CMS items carry no group and render
 * flat, as before. The empty state stays for the case where both are empty.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.faq' })
  return {
    title: t('title'),
    description:
      locale === 'he'
        ? 'תשובות ישרות לשאלות השכיחות ביותר של בעלי דירות על התחדשות עירונית.'
        : 'Straight answers to the questions apartment owners ask most about urban renewal.',
  }
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pages.faq')
  const loc = makeLocalizer(locale as Locale)

  const cmsItems = await getCmsFaqItems()
  const items = cmsItems.length > 0 ? cmsItems : FAQ_SEED

  // Grouped into one list per heading. A heading cannot live inside the <dl>
  // itself: a definition list may only contain dt, dd and div wrappers.
  const groups: { label: string | null; items: typeof items }[] = []
  for (const item of items) {
    const label = 'group' in item ? loc.text(item.group) : null
    const last = groups.at(-1)
    if (last && last.label === label) last.items = [...last.items, item] as typeof items
    else groups.push({ label, items: [item] as unknown as typeof items })
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        standfirst={
          locale === 'he'
            ? 'תשובות ישרות לשאלות השכיחות ביותר של בעלי דירות.'
            : 'Straight answers to the questions apartment owners ask most.'
        }
      />
      <Section size="md">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-surface-sunken px-6 py-14 text-center">
            <p className="text-base text-gray-700">{t('empty')}</p>
            <Link href="/contact" className="mt-4 inline-block py-2 text-teal-900 underline">
              {locale === 'he' ? 'יצירת קשר' : 'Contact us'}
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map((group, i) => (
              <section key={group.label ?? `group-${i}`}>
                {group.label && (
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-teal-900">
                    {group.label}
                  </h2>
                )}
                <dl className="divide-y divide-gray-200">
                  {group.items.map((item) => (
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
              </section>
            ))}
          </div>
        )}
      </Section>
      <Section size="sm">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold text-gray-900">
            {locale === 'he'
              ? 'יש שאלה ספציפית לגבי הבניין שלכם?'
              : 'A specific question about your building?'}
          </h2>
          <p className="mt-2 text-[15px] leading-8 text-gray-700">
            {locale === 'he' ? 'דברו איתנו - נשמח לענות.' : 'Talk to us - we are glad to answer.'}
          </p>
          <Link href="/contact" className="mt-4 inline-block py-2 text-teal-900 underline">
            {locale === 'he' ? 'יצירת קשר' : 'Contact us'}
          </Link>
        </div>
      </Section>
      {locale === 'he' && <FaqChatWidget />}
    </>
  )
}
