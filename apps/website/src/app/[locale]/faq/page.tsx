import { localeAlternates } from '@/lib/seo'
import { Link } from '@/i18n/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { LineIcon } from '@/components/brand/line-icon'
import { Section } from '@/components/blocks/section'
import { getCmsFaqItems, type CmsFaqEntry } from '@/lib/cms-source'
import { FAQ_SEED, type FaqSeedEntry, type FaqTopic } from '@/mock/fixtures/faq'
import { CONTACT } from '@/lib/site-config'
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
 *
 * ── SEED CONTENT BEHIND THE CMS ─────────────────────────────────────────────
 *
 * When the CMS has nothing published, the page now falls back to the approved
 * questions in `FAQ_SEED` rather than the empty state, and groups them under
 * the topics the copy was written with. CMS items carry no topic and render
 * as one list. The empty state stays for the case where both are empty.
 *
 * ── TOPICS FIRST, ANSWERS FOLDED ───────────────────────────────────────────
 *
 * The 2026-10 review found the page all text and no picture: every answer
 * printed in full, one after another. The approved design opens on the topics
 * as cards, each with its icon and how many questions it holds, linking to
 * its list; the questions are rows that open one at a time, the first one
 * open to show how; and beside them, a dark card with the phone, the email
 * and the action, for a visitor whose question is not here. The answers
 * themselves are unchanged: folding them shortens the page, not the copy.
 *
 * The rows are native <details>: they open without JavaScript, by keyboard,
 * and the browser's find-in-page reaches the folded answers.
 */
async function pageMetadata({
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
  const tCta = await getTranslations('cta')
  const loc = makeLocalizer(locale as Locale)

  const cmsItems = await getCmsFaqItems()
  const items: readonly CmsFaqEntry[] = cmsItems.length > 0 ? cmsItems : FAQ_SEED

  // One list per topic, in the order the questions come.
  const groups: { topic: FaqTopic | null; items: CmsFaqEntry[] }[] = []
  for (const item of items) {
    const topic = 'group' in item ? (item as FaqSeedEntry).group : null
    const last = groups.at(-1)
    if (last && last.topic?.id === topic?.id) last.items.push(item)
    else groups.push({ topic, items: [item] })
  }
  // The cards only when every question has a topic: a card per topic must
  // account for the whole page.
  const topics = groups.flatMap((group) =>
    group.topic ? [{ ...group.topic, count: group.items.length }] : [],
  )
  const showTopics = topics.length > 1 && topics.length === groups.length

  return (
    <>
      <section className="border-b border-gray-200 bg-white">
        <div
          className={`mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 lg:px-8 lg:py-14 ${
            showTopics ? 'lg:grid-cols-2 lg:gap-12' : ''
          }`}
        >
          <div>
            <p className="flex items-center gap-3 type-small font-bold text-teal-600">
              <span aria-hidden="true" className="h-0.5 w-8 bg-teal-500" />
              {t('title')}
            </p>
            <h1 className="mt-5 max-w-[22ch] text-balance type-h1 font-extrabold text-gray-900">
              {t('heading')}
            </h1>
            <p className="mt-5 max-w-xl text-pretty type-lead text-gray-600">{t('standfirst')}</p>
          </div>

          {showTopics && (
            <nav aria-label={t('topics')}>
              <ul className="grid grid-cols-2 gap-3 sm:gap-3.5">
                {topics.map((topic) => (
                  <li key={topic.id}>
                    <a
                      href={`#${topic.id}`}
                      className="flex h-full flex-col items-start gap-2.5 rounded-[0.875rem] bg-teal-50 p-4 transition-colors hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:p-[1.125rem]"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-600">
                        <LineIcon name={topic.icon} size={22} />
                      </span>
                      <span className="type-body font-bold text-gray-900">{loc.text(topic.label)}</span>
                      <span className="type-small text-gray-600">{t('count', { count: topic.count })}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </section>

      {items.length === 0 ? (
        <Section size="md">
          <div className="rounded-xl border border-dashed border-gray-300 bg-surface-sunken px-6 py-14 text-center">
            <p className="text-base text-gray-700">{t('empty')}</p>
            <Link href="/contact" className="mt-4 inline-block py-2 text-teal-900 underline">
              {locale === 'he' ? 'יצירת קשר' : 'Contact us'}
            </Link>
          </div>
        </Section>
      ) : (
        <section className="bg-surface-page">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:px-8 lg:pt-12">
            <div className="space-y-8">
              {groups.map(({ topic, items: questions }, groupIndex) => (
                <section
                  key={topic?.id ?? 'questions'}
                  id={topic?.id}
                  aria-labelledby={topic ? `${topic.id}-heading` : undefined}
                  className="scroll-mt-24"
                >
                  {topic && (
                    <h2
                      id={`${topic.id}-heading`}
                      className="mb-3 flex items-center gap-3 type-h3 font-bold text-gray-900"
                    >
                      <LineIcon name={topic.icon} size={26} className="shrink-0 text-teal-500" />
                      {loc.text(topic.label)}
                    </h2>
                  )}
                  <div className="divide-y divide-gray-200 overflow-hidden rounded-[0.875rem] border border-gray-200 bg-white">
                    {questions.map((item, index) => (
                      <details key={item.id} open={groupIndex === 0 && index === 0} className="odg-faq group">
                        <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-start type-body font-semibold text-gray-900 outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 group-open:font-bold group-open:text-teal-700 sm:px-6 [&::-webkit-details-marker]:hidden">
                          {loc.text(item.question)}
                          {/* A plus whose upright folds away when open: the
                              same in both directions, so nothing mirrors. */}
                          <span
                            aria-hidden="true"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50 text-teal-600 group-open:bg-teal-50 group-open:text-teal-700"
                          >
                            <span className="relative h-3 w-3">
                              <span className="absolute inset-0 m-auto h-0.5 w-full rounded-full bg-current" />
                              <span className="absolute inset-0 m-auto h-full w-0.5 rounded-full bg-current transition-transform duration-200 group-open:scale-y-0 motion-reduce:transition-none" />
                            </span>
                          </span>
                        </summary>
                        <div className="odg-faq-body">
                          <div className="overflow-hidden">
                            <p className="max-w-prose px-5 pb-5 type-body text-gray-600 sm:px-6">
                              {loc.text(item.answer)}
                            </p>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <aside
              aria-labelledby="faq-help-heading"
              className="flex flex-col gap-4 rounded-2xl bg-surface-inverse p-6 text-white sm:p-7 lg:sticky lg:top-24"
            >
              <span
                aria-hidden="true"
                className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full bg-white/[0.08] text-teal-300"
              >
                <LineIcon name="chat" size={26} />
              </span>
              <h2 id="faq-help-heading" className="type-h3 font-bold text-white">
                {t('helpHeading')}
              </h2>
              <p className="type-body text-teal-100">{t('helpBody')}</p>
              <div className="flex flex-col items-start">
                <a
                  href={CONTACT.phoneHref}
                  dir="ltr"
                  className="inline-flex min-h-11 items-center gap-2.5 type-body font-bold text-teal-300 transition-colors hover:text-white"
                >
                  <LineIcon name="phone" size={20} />
                  {CONTACT.phone}
                </a>
                <a
                  href={`mailto:${CONTACT.email}`}
                  dir="ltr"
                  className="inline-flex min-h-11 items-center gap-2.5 type-body font-bold text-teal-300 transition-colors hover:text-white"
                >
                  <LineIcon name="mail" size={20} />
                  {CONTACT.email}
                </a>
              </div>
              <Link
                href="/eligibility"
                className="mt-1 flex min-h-[52px] items-center justify-center rounded-md bg-white px-4 py-2.5 text-center type-body font-bold text-teal-700 transition-colors hover:bg-teal-50 hover:text-teal-700"
              >
                {tCta('eligibility')}
              </Link>
            </aside>
          </div>
        </section>
      )}
    </>
  )
}

/**
 * Canonical and hreflang, added around the page's own metadata so each page
 * keeps owning its title and description.
 */
export async function generateMetadata(
  props: Parameters<typeof pageMetadata>[0],
): Promise<Metadata> {
  const { locale } = await props.params
  return { ...(await pageMetadata(props)), alternates: localeAlternates(locale, '/faq') }
}
