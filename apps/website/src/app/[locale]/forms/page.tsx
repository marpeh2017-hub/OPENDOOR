import { localeAlternates } from '@/lib/seo'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PROTOCOL_CLAUSE_COUNT } from '@urban-renewal/api-contracts'
import { Link } from '@/i18n/navigation'
import { LineIcon } from '@/components/brand/line-icon'
import { PERSONAL_AREA_HREF, REPRESENTATION_PROTOCOL_HREF } from '@/lib/navigation'
import { CONTACT } from '@/lib/site-config'

/**
 * Forms for apartment owners. It took the knowledge centre's place in the
 * menus (2026-10-07), at the owner's request.
 *
 * Each form is a card: what it is, three facts about it, and two ways in, the
 * full text or straight to the print dialog (also how a visitor saves a PDF).
 * Under the forms, how signing works; beside them, the same dark help card as
 * the FAQ, for an owner who did not get a link.
 *
 * Signing never happens here. An owner signs through the personal link we
 * send, or in the personal area, so the page explains and links, and collects
 * nothing.
 */
async function pageMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.forms' })
  return { title: t('heading'), description: t('standfirst') }
}

export default async function FormsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pages.forms')

  const facts = [t('clauses', { count: PROTOCOL_CLAUSE_COUNT }), t('signsSeparately'), t('notBinding')]
  const steps = [1, 2, 3].map((step) => ({
    title: t(`step${step}Title`),
    body: t(`step${step}Body`),
  }))

  return (
    <>
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-14">
          <p className="flex items-center gap-3 type-small font-bold text-teal-600">
            <span aria-hidden="true" className="h-0.5 w-8 bg-teal-500" />
            {t('title')}
          </p>
          <h1 className="mt-5 max-w-[22ch] text-balance type-h1 font-extrabold text-gray-900">
            {t('heading')}
          </h1>
          <p className="mt-5 max-w-2xl text-pretty type-lead text-gray-600">{t('standfirst')}</p>
        </div>
      </section>

      <section className="bg-surface-page">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:px-8 lg:pt-12">
          <div className="space-y-10">
            <article
              aria-labelledby="form-representation-protocol"
              className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8"
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"
                >
                  <LineIcon name="document" size={26} />
                </span>
                <div>
                  <h2
                    id="form-representation-protocol"
                    className="text-balance type-h3 font-bold text-gray-900"
                  >
                    {t('protocolTitle')}
                  </h2>
                  <p className="mt-2 max-w-prose type-body text-gray-600">{t('protocolSummary')}</p>
                </div>
              </div>

              <ul className="mt-6 flex flex-wrap gap-2">
                {facts.map((fact) => (
                  <li
                    key={fact}
                    className="rounded-full bg-surface-sunken px-3.5 py-1.5 type-small font-semibold text-gray-700"
                  >
                    {fact}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={REPRESENTATION_PROTOCOL_HREF}
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-teal-600 px-6 py-2.5 type-body font-bold text-white transition-colors hover:bg-teal-700 hover:text-white"
                >
                  {t('read')}
                </Link>
                <Link
                  href={`${REPRESENTATION_PROTOCOL_HREF}?print=1`}
                  className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-md border border-teal-600 bg-white px-5 py-2.5 type-body font-bold text-teal-700 transition-colors hover:bg-teal-50"
                >
                  <LineIcon name="printer" size={20} />
                  {t('print')}
                </Link>
              </div>
            </article>

            <section aria-labelledby="how-signing-works">
              <h2 id="how-signing-works" className="type-h3 font-bold text-gray-900">
                {t('howHeading')}
              </h2>
              <ol className="mt-5 grid gap-4 sm:grid-cols-3">
                {steps.map((step, index) => (
                  <li key={step.title} className="rounded-[0.875rem] border border-gray-200 bg-white p-5">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 type-body font-bold text-teal-700"
                    >
                      {index + 1}
                    </span>
                    <p className="mt-3 type-body font-bold text-gray-900">{step.title}</p>
                    <p className="mt-1 type-small text-gray-600">{step.body}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside
            aria-labelledby="forms-help-heading"
            className="flex flex-col gap-4 rounded-2xl bg-surface-inverse p-6 text-white sm:p-7 lg:sticky lg:top-24"
          >
            <span
              aria-hidden="true"
              className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full bg-white/[0.08] text-teal-300"
            >
              <LineIcon name="chat" size={26} />
            </span>
            <h2 id="forms-help-heading" className="type-h3 font-bold text-white">
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
              href={PERSONAL_AREA_HREF}
              className="mt-1 flex min-h-[52px] items-center justify-center rounded-md bg-white px-4 py-2.5 text-center type-body font-bold text-teal-700 transition-colors hover:bg-teal-50 hover:text-teal-700"
            >
              {t('personalArea')}
            </Link>
          </aside>
        </div>
      </section>
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
  return { ...(await pageMetadata(props)), alternates: localeAlternates(locale, '/forms') }
}
