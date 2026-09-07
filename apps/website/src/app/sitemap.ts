import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-config'
import { getPageBySlug } from '@/mock'
import { getPublishedProjects } from '@/lib/cms-projects'
import { getCmsArticles, getCmsFaqItems } from '@/lib/cms-source'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []
  const add = (path: string, updatedAt?: string) =>
    entries.push({
      url: `${SITE_URL}/he${path}`,
      ...(updatedAt ? { lastModified: updatedAt } : {}),
    })
  add('/')
  for (const slug of ['about', 'why-organizer', 'how-we-work', 'trust']) {
    const page = await getPageBySlug(slug)
    if (page && !page.seo?.he?.noIndex) add(`/${slug}`, page.updatedAt)
  }
  for (const route of ['/projects', '/contact', '/eligibility']) add(route)
  const projects = await getPublishedProjects()
  for (const project of projects)
    if (!project.seo?.he?.noIndex) add(`/projects/${project.slug}`, project.updatedAt)
  const articles = await getCmsArticles()
  if (articles.length) add('/knowledge')
  for (const article of articles)
    if (!article.seo?.he?.noIndex) add(`/knowledge/${article.slug}`, article.publishedAt)
  if ((await getCmsFaqItems()).length) add('/faq')
  return entries
}
