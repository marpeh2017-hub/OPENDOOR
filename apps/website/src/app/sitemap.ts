import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-config'
import { getPageBySlug } from '@/mock'
import { getPublishedProjects } from '@/lib/cms-projects'
import { getCmsFaqItems } from '@/lib/cms-source'
import { ASSEMBLY_NOTICE_HREF, ORGANIZING_AGREEMENT_HREF, REPRESENTATION_PROTOCOL_HREF } from '@/lib/navigation'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []
  const add = (path: string, updatedAt?: string) =>
    entries.push({
      url: `${SITE_URL}/he${path}`,
      ...(updatedAt ? { lastModified: updatedAt } : {}),
    })
  add('/')
  for (const slug of ['about', 'why-organizer', 'how-we-work', 'trust', 'services', 'stalled-projects']) {
    const page = await getPageBySlug(slug)
    if (page && !page.seo?.he?.noIndex) add(`/${slug}`, page.updatedAt)
  }
  for (const route of ['/projects', '/contact', '/eligibility', '/forms', REPRESENTATION_PROTOCOL_HREF, '/forms/representation-protocol/start', ASSEMBLY_NOTICE_HREF, ORGANIZING_AGREEMENT_HREF])
    add(route)
  const projects = await getPublishedProjects()
  for (const project of projects)
    if (!project.seo?.he?.noIndex) add(`/projects/${project.slug}`, project.updatedAt)
  if ((await getCmsFaqItems()).length) add('/faq')
  return entries
}
