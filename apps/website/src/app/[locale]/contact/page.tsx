import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { DirectContact } from '@/components/forms/direct-contact'

/**
 * General contact.
 *
 * ── QUIETER THAN ELIGIBILITY, ON PURPOSE ───────────────────────────────────
 *
 * Eligibility is the primary conversion. This page shares its primitives and
 * its honesty but deliberately carries less weight: a smaller heading, one
 * narrower column, no sticky reassurance panel, no threshold frame around the
 * form, and no cost claim.
 *
 * The pointer back to eligibility is a TEXT LINK, not a button. Two buttons on
 * one screen is two primary actions, which is none — and the visitor who
 * actually wants the suitability check is better served by a sentence that
 * explains the difference than by a second control competing for the same
 * attention as the one they are already filling in.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'contactPage' })
  return { title: t('title'), description: t('standfirst') }
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, tCta] = await Promise.all([getTranslations('contactPage'), getTranslations('cta')])

  return (
    <>
      <PageHeader title={t('heading')} standfirst={t('standfirst')} />

      <Section size="md">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,640px)_1fr] lg:gap-16">
          <DirectContact />

          <aside className="lg:pt-1">
            <div className="border-s-2 border-teal-200 ps-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
                {t('asideEyebrow')}
              </p>
              <h2 className="mt-3 text-lg font-semibold leading-snug text-gray-900">
                {t('asideTitle')}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{t('asideBody')}</p>
              <Link
                href="/eligibility"
                className="group mt-4 inline-flex items-center gap-2 text-[15px] font-semibold text-teal-700"
              >
                <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-teal-700">
                  {tCta('eligibility')}
                </span>
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
                >
                  →
                </span>
              </Link>
            </div>
          </aside>
        </div>
      </Section>
    </>
  )
}
