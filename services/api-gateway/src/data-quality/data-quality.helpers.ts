import { createHash } from 'crypto'
import type { PrismaService } from '../prisma.service'
import type { ProjectIndex } from './data-quality.types'

// ─── Validators ─────────────────────────────────────────────────────────────

/** Israeli mobile/landline, tolerant of spaces, dashes and +972 prefix. */
const IL_PHONE = /^(?:\+?972|0)(?:[23489]|5[0-9]|7[2-9])\d{7}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

export function normalisePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, '')
}

export function isValidPhone(raw: string | null | undefined): boolean {
  if (!raw) return false
  return IL_PHONE.test(normalisePhone(raw))
}

export function isValidEmail(raw: string | null | undefined): boolean {
  if (!raw) return false
  return EMAIL.test(raw.trim())
}

export function isBlank(v: string | null | undefined): boolean {
  return v == null || v.trim().length === 0
}

/**
 * Non-reversible fingerprint of a sensitive value.
 *
 * `Owner.nationalId` is AES-256-GCM encrypted with a random IV, so two records
 * holding the SAME national ID produce DIFFERENT ciphertexts — a raw string
 * comparison can never detect duplicates. We therefore decrypt in memory (never
 * into a result object) and hash, so duplicate groups can be formed without the
 * plaintext ever leaving this function.
 */
export function fingerprint(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32)
}

// ─── Fraction arithmetic ────────────────────────────────────────────────────

/**
 * Ownership fraction maths lives in ONE place: `src/common/fractions`.
 * Re-exported here so existing Data Quality imports keep working, but the
 * implementation (exact BigInt rationals, no epsilon) is shared with
 * ThresholdService, the entity CRUD services and Excel import.
 */
export { Fraction, sumFractions, sumFractionParts, sharesSumToWhole } from '../common/fractions'

// ─── Project index ──────────────────────────────────────────────────────────

/**
 * Loads the tenant's (or a single project's) structural tree with four batched
 * queries. Every rule reads entity→project mapping from here instead of issuing
 * per-row joins.
 */
export async function buildProjectIndex(
  prisma: PrismaService,
  tenantId: string,
  projectId?: string,
): Promise<ProjectIndex> {
  const projects = await prisma.project.findMany({
    where: { tenantId, ...(projectId ? { id: projectId } : {}) },
    select: {
      id: true, name: true, code: true, status: true, stage: true,
      totalUnits: true, signedUnits: true, signatureGoal: true,
      projectManagerId: true, startDate: true, targetEndDate: true,
    },
  })
  const projectIds = projects.map(p => p.id)

  const complexes = projectIds.length
    ? await prisma.complex.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true, projectId: true },
      })
    : []
  const complexToProject = new Map(complexes.map(c => [c.id, c.projectId]))

  const buildings = complexes.length
    ? await prisma.building.findMany({
        where: { complexId: { in: complexes.map(c => c.id) } },
        select: {
          id: true, address: true, complexId: true,
          floors: true, totalApartments: true, constructionYear: true,
        },
      })
    : []

  const buildingMap = new Map(
    buildings.map(b => [
      b.id,
      {
        id: b.id,
        address: b.address,
        complexId: b.complexId,
        projectId: complexToProject.get(b.complexId) ?? '',
        floors: b.floors,
        totalApartments: b.totalApartments,
        constructionYear: b.constructionYear,
      },
    ]),
  )

  const apartments = buildings.length
    ? await prisma.apartment.findMany({
        where: { buildingId: { in: buildings.map(b => b.id) } },
        select: {
          id: true, apartmentNumber: true, buildingId: true,
          floor: true, sizeSqm: true, rooms: true,
        },
      })
    : []

  const apartmentMap = new Map(
    apartments.map(a => {
      const b = buildingMap.get(a.buildingId)
      return [
        a.id,
        {
          id: a.id,
          apartmentNumber: a.apartmentNumber,
          buildingId: a.buildingId,
          projectId: b?.projectId ?? '',
          floor: a.floor,
          sizeSqm: a.sizeSqm,
          rooms: a.rooms,
          label: `דירה ${a.apartmentNumber}, ${b?.address ?? '—'}`,
        },
      ]
    }),
  )

  return {
    projects: new Map(projects.map(p => [p.id, p])),
    buildings: buildingMap,
    apartments: apartmentMap,
    complexToProject,
    projectIds,
    buildingIds: [...buildingMap.keys()],
    apartmentIds: [...apartmentMap.keys()],
    entityCount: projects.length + buildingMap.size + apartmentMap.size,
  }
}

// ─── Deep links (CRM routes) ────────────────────────────────────────────────

export const links = {
  project:   (id: string) => `/projects/${id}`,
  building:  (projectId: string | null, id: string) =>
    projectId ? `/projects/${projectId}/buildings/${id}` : `/buildings/${id}`,
  apartment: (projectId: string | null, id: string) =>
    projectId ? `/projects/${projectId}/apartments/${id}` : `/buildings/apartments/${id}`,
  owner:     (id: string) => `/owners/${id}`,
  resident:  (id: string) => `/residents/${id}`,
  signaturePackage: (id: string) => `/signatures/${id}`,
  signatureRecord:  (packageId: string, id: string) => `/signatures/${packageId}/records/${id}`,
  document:  (id: string) => `/documents/${id}`,
  task:      (id: string) => `/tasks/${id}`,
  message:   (id: string) => `/communications/${id}`,
}
