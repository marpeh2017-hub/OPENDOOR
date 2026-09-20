import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { getProjectForPreview } from '@/mock'
import { makeLocalizer } from '@/lib/localize'
import { ProjectBody } from '@/components/projects/project-body'

/**
 * Development-only project preview.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHY THIS ROUTE EXISTS AT ALL
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The QA brief requires the populated detail page to be exercised — rich data,
 * sparse data, no photography — and separately requires that the fixtures used
 * to do it NEVER become public website content. Those two demands are only
 * compatible if there is a way to render an internal record outside the public
 * filter.
 *
 * The alternative is worse in every direction: publishing a fixture to look at
 * it (which is exactly the thing the brief forbids, and which someone will
 * forget to undo), or shipping a populated page nobody ever saw rendered.
 *
 * ── THE THREE THINGS THAT KEEP IT SAFE ─────────────────────────────────────
 *
 *   1. It 404s in production before touching data. Not a redirect, not a
 *      warning banner — the route does not exist in a production build, so
 *      there is nothing to find and nothing to leak.
 *   2. `noindex, nofollow` on the metadata, for the development and preview
 *      deployments where it does resolve.
 *   3. It is absent from `sitemap.ts`, and nothing on the site links to it.
 *
 * The bypass itself lives in `getProjectForPreview`, whose comment points back
 * here: this route is the only permitted caller.
 *
 * ── IT SHARES THE PUBLIC PAGE'S BODY, ON PURPOSE ───────────────────────────
 *
 * `ProjectBody` is the same component the public route renders. A preview that
 * reimplemented the layout would be testing the preview, which is the standard
 * way this kind of route stops being evidence of anything.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function ProjectPreviewPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  // First statement in the component. Before the data call, before anything.
  if (process.env.NODE_ENV === 'production') notFound()

  const { locale, slug } = await params
  setRequestLocale(locale)

  const project = await getProjectForPreview(slug)
  if (!project) notFound()

  const t = makeLocalizer(locale as Locale)
  const tPreview = await getTranslations('projectPreview')

  return (
    <>
      {/* Unmistakable, and not dismissible. A preview banner that can be
          closed is a preview banner that gets screenshotted without it. */}
      <div className="bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-white lg:px-8">
        {tPreview('banner')}{' '}
        <span className="font-normal text-gray-300">
          {tPreview('state', { state: project.publishState })}
        </span>
      </div>

      <ProjectBody project={project} locale={locale} t={t} />
    </>
  )
}
