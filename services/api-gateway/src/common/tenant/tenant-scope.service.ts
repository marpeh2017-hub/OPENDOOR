import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma.service'
import { DomainError } from '../errors/domain-error'

/**
 * Tenant boundary resolution, in one place.
 *
 * `Complex`, `Building` and `Apartment` carry NO `tenantId` column — the
 * boundary lives on `Project` and is inherited transitively:
 *
 *   Project → Complex → Building → Apartment
 *
 * so every scoped read walks that chain (the pattern established in
 * `buildings.service.ts`). `Owner`, `Resident` and `User` DO carry `tenantId`
 * and are filtered directly.
 *
 * Two rules hold everywhere:
 *   1. Look the row up scoped, THEN mutate by id — never mutate on a bare id.
 *   2. A row belonging to another tenant is indistinguishable from a row that
 *      does not exist: both raise NOT_FOUND (404). Never 403 — that would
 *      confirm the id is real somewhere else.
 */
@Injectable()
export class TenantScopeService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Nested where-filters (compose these into your own queries) ────────────

  static readonly scopes = {
    project: (tenantId: string) => ({ tenantId }),
    complex: (tenantId: string) => ({ project: { tenantId } }),
    building: (tenantId: string) => ({ complex: { project: { tenantId } } }),
    apartment: (tenantId: string) => ({ building: { complex: { project: { tenantId } } } }),
    /** Owner/Resident/User have a real column. */
    owner: (tenantId: string) => ({ tenantId }),
    resident: (tenantId: string) => ({ tenantId }),
    user: (tenantId: string) => ({ tenantId }),
  } as const

  // ── Single-row assertions ────────────────────────────────────────────────

  async assertProject(id: string, tenantId: string, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).project.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, status: true, stage: true },
    })
    if (!row) throw DomainError.notFound('PROJECT_NOT_FOUND', `פרויקט ${id} לא נמצא`)
    return row
  }

  async assertComplex(id: string, tenantId: string, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).complex.findFirst({
      where: { id, ...TenantScopeService.scopes.complex(tenantId) },
      select: { id: true, name: true, projectId: true },
    })
    if (!row) throw DomainError.notFound('COMPLEX_NOT_FOUND', `מתחם ${id} לא נמצא`)
    return row
  }

  async assertBuilding(id: string, tenantId: string, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).building.findFirst({
      where: { id, ...TenantScopeService.scopes.building(tenantId) },
      select: {
        id: true, address: true, streetNumber: true, status: true,
        complexId: true, complex: { select: { projectId: true } },
      },
    })
    if (!row) throw DomainError.notFound('BUILDING_NOT_FOUND', `מבנה ${id} לא נמצא`)
    return row
  }

  async assertApartment(id: string, tenantId: string, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).apartment.findFirst({
      where: { id, ...TenantScopeService.scopes.apartment(tenantId) },
      select: {
        id: true, apartmentNumber: true, status: true, buildingId: true,
        building: { select: { id: true, address: true, complex: { select: { projectId: true } } } },
      },
    })
    if (!row) throw DomainError.notFound('APARTMENT_NOT_FOUND', `דירה ${id} לא נמצאה`)
    return row
  }

  async assertOwner(id: string, tenantId: string, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).owner.findFirst({
      where: { id, tenantId },
      // nationalId deliberately not selected — see NationalIdService.
      select: { id: true, fullName: true, isEstate: true, phone: true, email: true },
    })
    if (!row) throw DomainError.notFound('OWNER_NOT_FOUND', `בעלים ${id} לא נמצא`)
    return row
  }

  async assertResident(id: string, tenantId: string, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).resident.findFirst({
      where: { id, tenantId },
      select: {
        id: true, firstName: true, lastName: true, apartmentId: true,
        signatureStatus: true, doNotContact: true,
      },
    })
    if (!row) throw DomainError.notFound('RESIDENT_NOT_FOUND', `דייר ${id} לא נמצא`)
    return row
  }

  async assertUser(id: string, tenantId: string, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).user.findFirst({
      where: { id, tenantId },
      // passwordHash / mfaSecret deliberately never selected.
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    })
    if (!row) throw DomainError.notFound('USER_NOT_FOUND', `משתמש ${id} לא נמצא`)
    return row
  }

  // ── Batch assertions (bulk actions & Excel import — no N+1) ──────────────

  /**
   * Verifies that EVERY id belongs to the tenant, in ONE query per model.
   * Returns the ids in tenant order; throws NOT_FOUND naming the count (never
   * the foreign ids, which would leak another tenant's key space).
   */
  private async assertAllIn(
    label: string,
    code: string,
    ids: readonly string[],
    found: readonly { id: string }[],
  ): Promise<Set<string>> {
    const set = new Set(found.map((r) => r.id))
    const missing = [...new Set(ids)].filter((id) => !set.has(id))
    if (missing.length) {
      throw DomainError.notFound(code, `${missing.length} ${label} לא נמצאו`)
    }
    return set
  }

  async assertProjects(ids: readonly string[], tenantId: string, tx?: Prisma.TransactionClient) {
    if (!ids.length) return new Set<string>()
    const rows = await (tx ?? this.prisma).project.findMany({
      where: { id: { in: [...new Set(ids)] }, tenantId },
      select: { id: true },
    })
    return this.assertAllIn('פרויקטים', 'PROJECT_NOT_FOUND', ids, rows)
  }

  async assertBuildings(ids: readonly string[], tenantId: string, tx?: Prisma.TransactionClient) {
    if (!ids.length) return new Set<string>()
    const rows = await (tx ?? this.prisma).building.findMany({
      where: { id: { in: [...new Set(ids)] }, ...TenantScopeService.scopes.building(tenantId) },
      select: { id: true },
    })
    return this.assertAllIn('מבנים', 'BUILDING_NOT_FOUND', ids, rows)
  }

  async assertApartments(ids: readonly string[], tenantId: string, tx?: Prisma.TransactionClient) {
    if (!ids.length) return new Set<string>()
    const rows = await (tx ?? this.prisma).apartment.findMany({
      where: { id: { in: [...new Set(ids)] }, ...TenantScopeService.scopes.apartment(tenantId) },
      select: { id: true },
    })
    return this.assertAllIn('דירות', 'APARTMENT_NOT_FOUND', ids, rows)
  }

  async assertOwners(ids: readonly string[], tenantId: string, tx?: Prisma.TransactionClient) {
    if (!ids.length) return new Set<string>()
    const rows = await (tx ?? this.prisma).owner.findMany({
      where: { id: { in: [...new Set(ids)] }, tenantId },
      select: { id: true },
    })
    return this.assertAllIn('בעלים', 'OWNER_NOT_FOUND', ids, rows)
  }

  async assertResidents(ids: readonly string[], tenantId: string, tx?: Prisma.TransactionClient) {
    if (!ids.length) return new Set<string>()
    const rows = await (tx ?? this.prisma).resident.findMany({
      where: { id: { in: [...new Set(ids)] }, tenantId },
      select: { id: true },
    })
    return this.assertAllIn('דיירים', 'RESIDENT_NOT_FOUND', ids, rows)
  }

  async assertUsers(ids: readonly string[], tenantId: string, tx?: Prisma.TransactionClient) {
    if (!ids.length) return new Set<string>()
    const rows = await (tx ?? this.prisma).user.findMany({
      where: { id: { in: [...new Set(ids)] }, tenantId },
      select: { id: true },
    })
    return this.assertAllIn('משתמשים', 'USER_NOT_FOUND', ids, rows)
  }

  /**
   * Maps apartment ids → owning project id in ONE query, for callers that need
   * to audit or authorise per project without a lookup per row.
   */
  async projectIdsForApartments(
    ids: readonly string[],
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Map<string, string>> {
    if (!ids.length) return new Map()
    const rows = await (tx ?? this.prisma).apartment.findMany({
      where: { id: { in: [...new Set(ids)] }, ...TenantScopeService.scopes.apartment(tenantId) },
      select: { id: true, building: { select: { complex: { select: { projectId: true } } } } },
    })
    return new Map(rows.map((r) => [r.id, r.building.complex.projectId]))
  }
}
