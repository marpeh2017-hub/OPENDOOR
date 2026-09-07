import { cache } from 'react'
import { getPublicMediaUrl } from './cms-source'
import type { PublicProject, MediaAsset } from '@urban-renewal/api-contracts'

// Adapt only the frozen public projection. Never merge it with drafts or fixtures.
export function projectFromPublication(row: {
  slug: string
  publishedAt: string
  content: Record<string, any>
  seo?: PublicProject['seo']
}): PublicProject | null {
  const p = row.content
  if (!p?.name?.he || !p?.location?.city?.he) return null
  const result: PublicProject = {
    id: row.slug,
    slug: row.slug,
    name: p.name,
    location: {
      city: p.location.city,
      ...(p.location.neighborhood ? { neighborhood: p.location.neighborhood } : {}),
      ...(p.location.street
        ? {
            street:
              typeof p.location.street === 'string' ? p.location.street : p.location.street.he,
          }
        : {}),
    },
    summary: p.summary ?? { he: '' },
    description: p.description,
    role: p.role,
    featured: true,
    visibility: 'public',
    publishState: 'published',
    updatedAt: row.publishedAt,
    seo: row.seo,
  }
  const factKeys = [
    'existingUnits',
    'proposedUnits',
    'buildingCount',
    'planningStatus',
    'developer',
    'professionals',
    'approvals',
    'permits',
    'materialDates',
  ] as const
  for (const key of factKeys) {
    const fact = p.facts?.[key]
    if (fact?.verified === true && fact.verifiedAt)
      (result as any)[key] = { value: fact.value, verifiedAt: fact.verifiedAt }
  }
  if (p.currentStage?.verified === true && p.currentStage.verifiedAt)
    result.currentStage = { value: p.currentStage.value, verifiedAt: p.currentStage.verifiedAt }
  if (Array.isArray(p.milestones))
    result.milestones = p.milestones.map((m: any) => ({
      id: m.id,
      title: m.title,
      state: m.state,
      note: m.note,
      ...(m.state !== 'upcoming' && m.occurredAt ? { occurredAt: m.occurredAt } : {}),
      ...(m.periodLabel?.he
        ? { periodLabel: { he: m.periodLabel.he, en: m.periodLabel.en ?? m.periodLabel.he } }
        : {}),
    }))
  return result
}

export const getPublishedProjects = cache(async (): Promise<PublicProject[]> => {
  const base = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/+$/, '')
  if (!base) return []
  try {
    const tenant = process.env['CMS_TENANT_SLUG'] ?? 'opendoor-demo'
    const response = await fetch(`${base}/api/v1/public/cms/${tenant}/project`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return []
    const rows = await response.json()
    if (!Array.isArray(rows)) return []
    return (await Promise.all(rows.map(projectWithMedia))).filter(
      (p): p is PublicProject => p !== null,
    )
  } catch {
    return []
  }
})

export async function projectWithMedia(
  row: Parameters<typeof projectFromPublication>[0],
): Promise<PublicProject | null> {
  const project = projectFromPublication(row)
  if (!project) return null
  const media = row.content.media
  if (!Array.isArray(media)) return project
  const gallery = await Promise.all(
    media.map(async (m: any, order: number): Promise<MediaAsset | null> => {
      if (!m.alt?.he || !['VERIFIED_PROJECT_PHOTO', 'EDITORIAL_CONTEXT'].includes(m.classification))
        return null
      const url = await getPublicMediaUrl(m.storageKey)
      return url
        ? {
            id: m.id,
            kind: 'image',
            url,
            alt: m.alt,
            caption: m.caption,
            credit: m.credit,
            imageType: m.classification,
            order,
          }
        : null
    }),
  )
  project.gallery = gallery.filter((m): m is MediaAsset => m !== null)
  project.heroImage = project.gallery.find((m) => m.imageType === 'VERIFIED_PROJECT_PHOTO')
  return project
}
