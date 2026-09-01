import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import type { Locale } from '@urban-renewal/api-contracts'
import { getProjectBySlug } from '@/mock'
import { makeLocalizer } from '@/lib/localize'
import { ProjectBody } from '@/components/projects/project-body'

/**
 * Project detail.
 *
 * The route resolves the locale, fetches a PUBLISHED project and hands it to
 * `ProjectBody`. It owns no layout and no copy, which is what lets the
 * development preview route render the identical page from an unpublished
 * record — see `components/projects/project-body.tsx` for the section order and
 * the rules about absent content.
 *
 * ── THE SLUG IS CHECKED ────────────────────────────────────────────────────
 *
 * `getProjectBySlug` applies the publish filter, so an unpublished or
 * internal-only slug 404s here exactly like a slug that matches nothing. That
 * is deliberate: a "this project is not published" page would confirm the
 * record exists, which is itself a disclosure.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const project = await getProjectBySlug(slug)
  if (!project) return {}

  /* SEO is EDITABLE CONTENT, so the record's own `seo` wins when an editor has
     written one. Name and summary are the fallback rather than the source:
     they are what a project always has, so a page is never left without a
     title, but they are not what a person optimising a listing would choose.
     `noIndex` is honoured because unpublishing from search is a legitimate
     editorial act that must not require a deploy.

     NOTE: `PublicProject.seo` is a single `SeoMetadata`, not per-locale the
     way `CmsPage.seo` is. So one project publishes one title and description
     across both locales. That is a real limitation rather than a decision;
     it is recorded in the localisation section of the CMS architecture
     alongside the other project fields that are still plain strings. */
  const seo = project.seo
  return {
    title: seo?.title ?? project.name,
    description: seo?.description ?? project.summary,
    ...(seo?.noIndex ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const project = await getProjectBySlug(slug)
  if (!project) notFound()

  return <ProjectBody project={project} locale={locale} t={makeLocalizer(locale as Locale)} />
}
