import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { EligibilityForm } from '@/components/forms/eligibility-form'
import { STROKE } from '@/components/brand/architecture'

/**
 * The eligibility check.
 *
 * ── AN ACTION PAGE, NOT A MARKETING PAGE ───────────────────────────────────
 *
 * Someone here has already decided to make contact. Everything on the page
 * either helps them finish the form or answers the one worry that stops
 * people finishing it: what happens to my details.
 *
 * So: no CTA competing with the submit button, no cards around the fields, no
 * progress bar, no decoration between inputs. The single threshold moment is
 * held back for the confirmation screen, where it marks something actually
 * having happened rather than ornamenting a form.
 *
 * ── THE REASSURANCE COLUMN ORDER ───────────────────────────────────────────
 *
 * Desktop puts it beside the form and sticky. Mobile puts it BELOW the form,
 * never above: someone who reached this page on a phone came to type, and
 * making them scroll past reassurance to reach the first field is the most
 * common way an action page loses the action.
 *
 * `robots` is deliberately absent, unlike the remaining stubs — this page has
 * real content and should be indexable.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'eligibility' })
  return { title: t('title'), description: t('standfirst') }
}

export default async function EligibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('eligibility')

  return (
    <>
      <PageHeader title={t('heading')} standfirst={t('standfirst')} />

      <Section size="md">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_0.7fr] lg:items-start lg:gap-14">
          <EligibilityForm />

          {/* `order-last` on mobile, so the form is the first thing under the
              header regardless of DOM order. DOM order is form-first anyway,
              which keeps the tab sequence correct on every width. */}
          <aside className="flex flex-col gap-6 lg:sticky lg:top-28">
            <div className="relative bg-white p-6">
              <span
                aria-hidden="true"
                className="absolute start-0 top-0 h-[2px] w-[40%]"
                style={{ background: STROKE.teal }}
              />
              <h2 className="text-[17px] font-semibold text-gray-900">{t('asideTitle')}</h2>
              <div className="mt-4 divide-y divide-gray-200">
                <p className="pb-3.5 text-sm leading-relaxed text-gray-600">{t('aside1')}</p>
                <p className="py-3.5 text-sm leading-relaxed text-gray-600">{t('aside2')}</p>
                <p className="pt-3.5 text-sm leading-relaxed text-gray-600">{t('aside3')}</p>
              </div>
            </div>

            <div className="bg-surface-sunken p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
                {t('privacyTitle')}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">{t('privacyBody')}</p>
            </div>
          </aside>
        </div>
      </Section>
    </>
  )
}
