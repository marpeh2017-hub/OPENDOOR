import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getProjects } from '@/mock'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/blocks/page-header'
import { Section } from '@/components/blocks/section'
import { JerusalemHillside } from '@/components/brand/jerusalem'
import { STROKE } from '@/components/brand/architecture'
import { STUB_ROBOTS } from '@/lib/seo'

/**
 * Projects index.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THE EMPTY STATE IS THE PRIMARY DESIGNED STATE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * There are currently no published projects, by design: the realistic
 * placeholder names were removed because a real street name under "our
 * projects" is read as a claim, and they were not replaced with invented ones.
 *
 * So this page's empty state is not a fallback that nobody will see — it is
 * what every visitor sees today. It is therefore built to the same standard as
 * the populated state: a real explanation of why the list is empty, the
 * architectural language the rest of the site uses, and the one action that is
 * actually useful to someone who came here interested.
 *
 * It is also, unchanged, the correct behaviour on the day a project is
 * unpublished. Nothing here is temporary.
 *
 * ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────
 *
 * No "0 projects found". No empty grid with dashed outlines. No skeleton rows
 * that never resolve. No apology. Each of those tells the visitor the site is
 * broken; the copy below tells them the company is careful, which is both more
 * useful and true.
 *
 * ── THE LISTING IS NOT BUILT YET ───────────────────────────────────────────
 *
 * Pass 1 ships the empty state and the header. The populated grid, filters and
 * pagination are Pass 4 — there is nothing to list, and building a grid against
 * zero rows would be building it blind. `STUB_ROBOTS` stays until then.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pages.projects' })
  return { title: t('title'), robots: STUB_ROBOTS }
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const [tPages, tProjects, tCta, tLinks, page] = await Promise.all([
    getTranslations('pages.projects'),
    getTranslations('projects'),
    getTranslations('cta'),
    getTranslations('links'),
    getProjects({ limit: 24 }),
  ])

  const isEmpty = page.items.length === 0

  return (
    <>
      <PageHeader title={tPages('title')} />

      {isEmpty ? (
        <Section size="lg">
          {/* The threshold at section scale: head interrupted, sill in teal.
              The same frame the homepage uses for its closing, reused here so
              an empty page still belongs to the site. */}
          <div className="relative bg-white px-6 py-12 sm:px-12 sm:py-14">
            <span aria-hidden="true" className="pointer-events-none absolute inset-0">
              <span
                className="absolute start-0 top-0 h-[2px] w-[18%]"
                style={{ background: STROKE.teal }}
              />
              <span
                className="absolute end-0 top-0 h-[2px] w-[46%]"
                style={{ background: STROKE.teal }}
              />
              <span
                className="absolute bottom-0 start-0 h-px w-full"
                style={{ background: STROKE.faint }}
              />
              <span
                className="absolute bottom-0 start-0 top-0 w-px"
                style={{ background: STROKE.faint }}
              />
              <span
                className="absolute bottom-0 end-0 top-0 w-px"
                style={{ background: STROKE.faint }}
              />
            </span>

            <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
              <div>
                <h2 className="max-w-[20ch] text-2xl font-bold leading-[1.2] tracking-tight text-gray-900 text-balance sm:text-3xl">
                  {tProjects('emptyTitle')}
                </h2>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600">
                  {tProjects('emptyBody')}
                </p>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/eligibility"
                    className="group inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-md bg-teal-600 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-teal-700"
                  >
                    {tCta('eligibility')}
                    <span
                      aria-hidden="true"
                      className="inline-block transition-transform duration-200 group-hover:translate-x-[3px] rtl:rotate-180"
                    >
                      →
                    </span>
                  </Link>
                  <Link
                    href="/how-we-work"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 bg-white px-7 py-4 text-base font-semibold text-gray-800 transition-colors hover:border-teal-600 hover:text-teal-800"
                  >
                    {tLinks('howWeWork')}
                  </Link>
                </div>
              </div>

              {/* Decorative, and deliberately not a photograph: an empty list
                  is not the place to introduce imagery that would need its own
                  provenance caption. */}
              <div className="hidden aspect-[4/3] overflow-hidden bg-surface-sunken lg:block">
                <JerusalemHillside />
              </div>
            </div>
          </div>
        </Section>
      ) : null}
    </>
  )
}
