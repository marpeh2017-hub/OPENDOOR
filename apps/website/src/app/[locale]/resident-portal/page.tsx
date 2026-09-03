import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { Link } from '@/i18n/navigation'
import { STROKE } from '@/components/brand/architecture'
import { RESIDENT_ACCESS } from '@/lib/project-presentation'

/**
 * Resident Portal — the informational page, not the application.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THIS REPLACES A DEVELOPER PLACEHOLDER WITH CONTENT THAT ALREADY EXISTED
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Until Pass 4G this route rendered `PageShell`, which told a visitor "Page
 * shell. Content is built in later tasks and will be editable through the
 * CMS" — internal build status, not something a person reaching this page
 * for a real reason should read.
 *
 * The `residentBridge` translation namespace was already written, approved,
 * and used on every project page's own bridge-to-the-portal section
 * (`components/projects/resident-bridge.tsx`) — which LINKS HERE. So the
 * page those links pointed to was showing a development placeholder while
 * the honest, reviewed content sat one file away, unused. Nothing below is
 * new copy: it is the same strings, given a page of their own.
 *
 * ── PUBLIC INFORMATION PAGE, NOT THE AUTHENTICATED APPLICATION ─────────────
 *
 * There is no sign-in form here, no email field, no apartment number. Per
 * `RESIDENT_ACCESS`:
 *
 *   COMING_SOON (today)  states plainly that the environment does not exist
 *                        yet and what happens instead — meetings, written
 *                        summaries, direct contact with the representation.
 *   AVAILABLE            a real sign-in link to the portal, once one exists.
 *   HIDDEN               this route still resolves (so it is never a dead
 *                        link), but shows only the public/private distinction,
 *                        with no portal language at all.
 *
 * This must never claim a login exists when it does not — see
 * `resident-bridge.tsx`'s own note on the same rule.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'residentBridge' })
  // Real, finished content — unlike privacy/terms, this is indexable.
  return { title: t('heading') }
}

export default async function ResidentPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, tLinks] = await Promise.all([
    getTranslations('residentBridge'),
    getTranslations('links'),
  ])

  const available = RESIDENT_ACCESS === 'AVAILABLE'

  return (
    <>
      <PageHeader title={t('heading')} standfirst={t('body')} />

      <Section size="md">
        <div className="grid gap-11 lg:grid-cols-2 lg:gap-14">
          <div>
            {RESIDENT_ACCESS !== 'HIDDEN' && !available && (
              <p className="max-w-prose text-base leading-relaxed text-gray-600">
                {t('comingSoon')}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {available && (
                <span
                  className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-teal-600 px-6 py-3.5 text-[15px] font-semibold text-white"
                >
                  {t('signIn')}
                </span>
              )}
              <Link
                href="/contact"
                className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-400 bg-white px-6 py-3.5 text-[15px] font-semibold text-gray-800 transition-colors hover:border-teal-600 hover:text-teal-800"
              >
                {tLinks('contact')}
              </Link>
            </div>
          </div>

          <div className="relative bg-surface-sunken p-6 sm:p-7">
            <span
              aria-hidden="true"
              className="absolute start-0 top-0 h-[2px] w-[40%]"
              style={{ background: STROKE.teal }}
            />
            <div className="text-xs font-bold tracking-widest text-gray-600">{t('whatIsWhere')}</div>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="text-sm font-bold text-gray-900">{t('publicHeading')}</h2>
                <ul className="mt-2.5 list-disc space-y-1.5 ps-4 text-[13px] leading-relaxed text-gray-600">
                  <li>{t('public1')}</li>
                  <li>{t('public2')}</li>
                  <li>{t('public3')}</li>
                  <li>{t('public4')}</li>
                </ul>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">{t('privateHeading')}</h2>
                <ul className="mt-2.5 list-disc space-y-1.5 ps-4 text-[13px] leading-relaxed text-gray-600">
                  <li>{t('private1')}</li>
                  <li>{t('private2')}</li>
                  <li>{t('private3')}</li>
                  <li>{t('private4')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
