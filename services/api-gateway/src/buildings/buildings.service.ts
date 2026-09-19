import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AuditService, type AuditActor, type AuditActionName } from '../common/audit/audit.service'
import { TenantScopeService } from '../common/tenant/tenant-scope.service'
import { OwnershipService } from '../common/ownership/ownership.service'
import { DomainError } from '../common/errors/domain-error'
import type {
  CreateBuildingDto, UpdateBuildingDto, MoveBuildingDto, SetEntityStatusDto,
  CreateApartmentDto, UpdateApartmentDto, SetApartmentOwnersDto,
  BulkBuildingStatusDto, BulkMoveBuildingsDto,
} from './dto/building.dto'

/**
 * Buildings & apartments.
 *
 * There is no `tenantId` column on Building/Apartment — the tenant boundary
 * lives on Project, and the ownership chain is:
 *
 *   Project → Complex → Building → Apartment
 *
 * So every read/write is scoped with a nested `where` walking that chain up to
 * `project.tenantId`. This is the same two-step "look it up scoped, then act by
 * id" pattern used by the other controllers, expressed through the relation.
 */
@Injectable()
export class BuildingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: TenantScopeService,
    private readonly ownership: OwnershipService,
    private readonly audit: AuditService,
  ) {}

  /** Nested tenant filter for a Building. */
  private buildingScope(tenantId: string) {
    return { complex: { project: { tenantId } } }
  }

  /** Nested tenant filter for an Apartment. */
  private apartmentScope(tenantId: string) {
    return { building: { complex: { project: { tenantId } } } }
  }

  // ── Complexes ────────────────────────────────────────────────────────────

  async findComplexes(tenantId: string, projectId?: string) {
    return this.prisma.complex.findMany({
      where: {
        project: { tenantId },
        ...(projectId ? { projectId } : {}),
      },
      select: {
        id: true,
        name: true,
        address: true,
        status: true,
        projectId: true,
        project: { select: { id: true, name: true, code: true } },
        _count: { select: { buildings: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  // ── Buildings ────────────────────────────────────────────────────────────

  /**
   * List buildings for the tenant. Apartment counts come from `_count` and the
   * project/complex names from a single nested select — one query, no N+1.
   */
  async findAll(
    tenantId: string,
    filters: { projectId?: string; complexId?: string; city?: string; search?: string } = {},
  ) {
    const { projectId, complexId, city, search } = filters

    const buildings = await this.prisma.building.findMany({
      where: {
        ...this.buildingScope(tenantId),
        ...(complexId ? { complexId } : {}),
        ...(projectId ? { complex: { projectId, project: { tenantId } } } : {}),
        ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
        ...(search ? { address: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id: true,
        complexId: true,
        address: true,
        streetNumber: true,
        city: true,
        zipCode: true,
        floors: true,
        totalApartments: true,
        constructionYear: true,
        buildingClass: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        complex: {
          select: {
            id: true,
            name: true,
            project: { select: { id: true, name: true, code: true, stage: true } },
          },
        },
        _count: { select: { apartments: true } },
      },
      orderBy: [{ city: 'asc' }, { address: 'asc' }],
    })

    // Resident counts for every listed building in ONE grouped query.
    const ids = buildings.map((b) => b.id)
    const residentGroups = ids.length
      ? await this.prisma.resident.groupBy({
          by: ['apartmentId'],
          where: { apartment: { buildingId: { in: ids } } },
          _count: { _all: true },
        })
      : []

    let aptToBuilding = new Map<string, string>()
    if (residentGroups.length) {
      const apts = await this.prisma.apartment.findMany({
        where: { id: { in: residentGroups.map((g) => g.apartmentId!).filter(Boolean) } },
        select: { id: true, buildingId: true },
      })
      aptToBuilding = new Map(apts.map((a) => [a.id, a.buildingId]))
    }

    const residentCount = new Map<string, number>()
    for (const g of residentGroups) {
      const buildingId = g.apartmentId ? aptToBuilding.get(g.apartmentId) : undefined
      if (!buildingId) continue
      residentCount.set(buildingId, (residentCount.get(buildingId) ?? 0) + g._count._all)
    }

    return buildings.map((b) => ({
      ...b,
      apartmentCount: b._count.apartments,
      residentCount: residentCount.get(b.id) ?? 0,
    }))
  }

  async findOne(id: string, tenantId: string) {
    const building = await this.prisma.building.findFirst({
      where: { id, ...this.buildingScope(tenantId) },
      include: {
        complex: {
          select: {
            id: true,
            name: true,
            project: { select: { id: true, name: true, code: true, stage: true } },
          },
        },
        apartments: {
          orderBy: { apartmentNumber: 'asc' },
          include: {
            residents: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                signatureStatus: true,
                // nationalId deliberately never selected
              },
            },
            owners: {
              select: {
                id: true,
                shareNumerator: true,
                shareDenominator: true,
                owner: { select: { id: true, fullName: true, isEstate: true } },
              },
            },
          },
        },
      },
    })
    if (!building) throw new NotFoundException(`מבנה ${id} לא נמצא`)
    return building
  }

  // ── Building writes ──────────────────────────────────────────────────────

  async create(dto: CreateBuildingDto, actor: AuditActor) {
    // Verify the target complex belongs to this tenant BEFORE writing.
    const complex = await this.scope.assertComplex(dto.complexId, actor.tenantId)

    return this.prisma.$transaction(async (tx) => {
      const building = await tx.building.create({
        data: {
          complexId: dto.complexId,
          address: dto.address,
          streetNumber: dto.streetNumber ?? null,
          city: dto.city ?? null,
          zipCode: dto.zipCode ?? null,
          floors: dto.floors ?? null,
          totalApartments: dto.totalApartments ?? null,
          constructionYear: dto.constructionYear ?? null,
          buildingClass: dto.buildingClass ?? null,
          coordinates: dto.coordinates ? { lat: dto.coordinates.lat, lng: dto.coordinates.lng } : undefined,
        },
      })
      await this.audit.record(actor, {
        action: 'CREATE', entity: 'Building', entityId: building.id,
        changes: { after: { address: building.address, streetNumber: building.streetNumber, complexId: dto.complexId } },
        metadata: { projectId: complex.projectId },
      }, tx)
      return building
    })
  }

  async update(id: string, dto: UpdateBuildingDto, actor: AuditActor) {
    const before = await this.prisma.building.findFirst({
      where: { id, ...this.buildingScope(actor.tenantId) },
      select: {
        id: true, address: true, streetNumber: true, city: true, zipCode: true,
        floors: true, totalApartments: true, constructionYear: true, buildingClass: true,
        complex: { select: { projectId: true } },
      },
    })
    if (!before) throw DomainError.notFound('BUILDING_NOT_FOUND', `מבנה ${id} לא נמצא`)

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.building.update({
        where: { id },
        // Explicit fields only — `complexId` is not updatable here, so a
        // building cannot be moved into another tenant's project by an update.
        data: {
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.streetNumber !== undefined && { streetNumber: dto.streetNumber }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.zipCode !== undefined && { zipCode: dto.zipCode }),
          ...(dto.floors !== undefined && { floors: dto.floors }),
          ...(dto.totalApartments !== undefined && { totalApartments: dto.totalApartments }),
          ...(dto.constructionYear !== undefined && { constructionYear: dto.constructionYear }),
          ...(dto.buildingClass !== undefined && { buildingClass: dto.buildingClass }),
          ...(dto.coordinates !== undefined && {
            coordinates: { lat: dto.coordinates.lat, lng: dto.coordinates.lng },
          }),
        },
      })
      const changes = AuditService.diff(before as any, {
        address: after.address, streetNumber: after.streetNumber, city: after.city,
        zipCode: after.zipCode, floors: after.floors, totalApartments: after.totalApartments,
        constructionYear: after.constructionYear, buildingClass: after.buildingClass,
      })
      if (changes) {
        await this.audit.record(actor, {
          action: 'UPDATE', entity: 'Building', entityId: id, changes,
          metadata: { projectId: before.complex.projectId },
        }, tx)
      }
      return after
    })
  }

  /** Moving a building between complexes — separate and separately audited,
   * because it re-parents every apartment beneath it and therefore moves units
   * between two projects' signature thresholds. */
  async move(id: string, dto: MoveBuildingDto, actor: AuditActor) {
    const before = await this.scope.assertBuilding(id, actor.tenantId)
    const target = await this.scope.assertComplex(dto.complexId, actor.tenantId)
    if (before.complexId === dto.complexId) return before

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.building.update({ where: { id }, data: { complexId: dto.complexId } })
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'Building', entityId: id,
        changes: { before: { complexId: before.complexId }, after: { complexId: dto.complexId } },
        metadata: {
          reason: 'BUILDING_MOVED',
          fromProjectId: before.complex.projectId,
          toProjectId: target.projectId,
        },
      }, tx)
      return after
    })
  }

  /**
   * Archive / restore a building.
   *
   * Soft, not a delete: apartments (and their ownership rows, residents and
   * signature records) cascade from Building, so a hard delete would destroy
   * signed evidence. `remove()` below routes here for the same reason.
   */
  async setStatus(id: string, dto: SetEntityStatusDto, actor: AuditActor) {
    const before = await this.scope.assertBuilding(id, actor.tenantId)
    if (before.status === dto.status) return before

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.building.update({ where: { id }, data: { status: dto.status } })
      // Archiving a building archives its apartments in the same transaction —
      // an "active" apartment under an archived building would keep counting
      // toward the threshold.
      if (dto.status === 'archived') {
        await tx.apartment.updateMany({ where: { buildingId: id }, data: { status: 'archived' } })
      }
      const action: AuditActionName = dto.status === 'archived' ? 'DELETE' : 'UPDATE'
      await this.audit.record(actor, {
        action, entity: 'Building', entityId: id,
        changes: { before: { status: before.status }, after: { status: dto.status } },
        metadata: {
          reason: dto.status === 'archived' ? 'ARCHIVE' : 'RESTORE',
          projectId: before.complex.projectId,
          cascadedToApartments: dto.status === 'archived',
        },
      }, tx)
      return after
    })
  }

  /** `DELETE /buildings/:id` archives. See `setStatus`. */
  async remove(id: string, actor: AuditActor) {
    return this.setStatus(id, { status: 'archived' }, actor)
  }

  private async findOneScoped(id: string, tenantId: string) {
    const building = await this.prisma.building.findFirst({
      where: { id, ...this.buildingScope(tenantId) },
      select: { id: true },
    })
    if (!building) throw DomainError.notFound('BUILDING_NOT_FOUND', `מבנה ${id} לא נמצא`)
    return building
  }

  // ── Bulk building actions ────────────────────────────────────────────────

  /** Bulk archive / restore, one transaction, all-or-nothing. */
  async bulkSetStatus(dto: BulkBuildingStatusDto, actor: AuditActor) {
    const ids = [...new Set(dto.ids)]
    await this.scope.assertBuildings(ids, actor.tenantId)
    const action: AuditActionName = dto.status === 'archived' ? 'DELETE' : 'UPDATE'

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.building.findMany({
        where: { id: { in: ids } }, select: { id: true, status: true },
      })
      await tx.building.updateMany({ where: { id: { in: ids } }, data: { status: dto.status } })
      if (dto.status === 'archived') {
        await tx.apartment.updateMany({
          where: { buildingId: { in: ids } }, data: { status: 'archived' },
        })
      }
      await this.audit.recordMany(actor, before.map((b) => ({
        action, entity: 'Building', entityId: b.id,
        changes: { before: { status: b.status }, after: { status: dto.status } },
        metadata: { reason: 'BULK_STATUS_CHANGE', batchSize: ids.length },
      })), tx)
      return { updated: before.length, status: dto.status }
    })
  }

  /** Bulk re-assign buildings to a project's complex, one transaction. */
  async bulkMove(dto: BulkMoveBuildingsDto, actor: AuditActor) {
    const ids = [...new Set(dto.ids)]
    await this.scope.assertBuildings(ids, actor.tenantId)
    const target = await this.scope.assertComplex(dto.complexId, actor.tenantId)

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.building.findMany({
        where: { id: { in: ids } }, select: { id: true, complexId: true },
      })
      await tx.building.updateMany({ where: { id: { in: ids } }, data: { complexId: dto.complexId } })
      await this.audit.recordMany(actor, before.map((b) => ({
        action: 'UPDATE' as const, entity: 'Building', entityId: b.id,
        changes: { before: { complexId: b.complexId }, after: { complexId: dto.complexId } },
        metadata: { reason: 'BULK_MOVE', toProjectId: target.projectId, batchSize: ids.length },
      })), tx)
      return { moved: before.length, complexId: dto.complexId }
    })
  }

  // ── Apartments ───────────────────────────────────────────────────────────

  async findApartments(tenantId: string, buildingId?: string) {
    return this.prisma.apartment.findMany({
      where: {
        ...this.apartmentScope(tenantId),
        ...(buildingId ? { buildingId } : {}),
      },
      select: {
        id: true,
        buildingId: true,
        apartmentNumber: true,
        floor: true,
        sizeSqm: true,
        rooms: true,
        hasParking: true,
        parkingSpots: true,
        hasStorage: true,
        hasBalcony: true,
        status: true,
        residents: {
          select: { id: true, firstName: true, lastName: true, signatureStatus: true },
        },
      },
      orderBy: { apartmentNumber: 'asc' },
    })
  }

  async findApartment(id: string, tenantId: string) {
    const apartment = await this.prisma.apartment.findFirst({
      where: { id, ...this.apartmentScope(tenantId) },
      include: {
        building: {
          select: {
            id: true,
            address: true,
            streetNumber: true,
            city: true,
            complex: { select: { id: true, name: true, projectId: true } },
          },
        },
        residents: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            ownershipPercentage: true,
            isPrimaryContact: true,
            signatureStatus: true,
            // nationalId deliberately never selected
          },
        },
      },
    })
    if (!apartment) throw DomainError.notFound('APARTMENT_NOT_FOUND', `דירה ${id} לא נמצאה`)

    // Ownership (and its EXACT share sum) comes from the shared service, so the
    // apartment screen, Data Quality and the threshold engine all agree.
    const summary = (await this.ownership.summarise([id], tenantId)).get(id)
    return {
      ...apartment,
      owners: summary?.holdings ?? [],
      ownershipSum: summary?.sum ?? { num: 0, den: 1 },
      ownershipComplete: summary?.isComplete ?? false,
    }
  }

  async createApartment(dto: CreateApartmentDto, actor: AuditActor) {
    const building = await this.scope.assertBuilding(dto.buildingId, actor.tenantId)

    // `@@unique([buildingId, apartmentNumber])` — check first so the caller gets
    // a 409 with a Hebrew message rather than a raw Prisma constraint error.
    const clash = await this.prisma.apartment.findFirst({
      where: { buildingId: dto.buildingId, apartmentNumber: dto.apartmentNumber },
      select: { id: true },
    })
    if (clash) {
      throw DomainError.conflict('APARTMENT_NUMBER_TAKEN', `דירה ${dto.apartmentNumber} כבר קיימת במבנה זה.`)
    }

    // Ownership arithmetic is validated BEFORE the transaction opens, so an
    // invalid share set never creates a half-built apartment.
    if (dto.owners?.length) {
      this.ownership.assertValid(
        this.ownership.validatePlans([{ apartmentId: 'new', assignments: dto.owners }]),
      )
    }

    return this.prisma.$transaction(async (tx) => {
      const apartment = await tx.apartment.create({
        data: {
          buildingId: dto.buildingId,
          apartmentNumber: dto.apartmentNumber,
          floor: dto.floor ?? null,
          sizeSqm: dto.sizeSqm ?? null,
          rooms: dto.rooms ?? null,
          ...(dto.hasParking !== undefined && { hasParking: dto.hasParking }),
          ...(dto.parkingSpots !== undefined && { parkingSpots: dto.parkingSpots }),
          ...(dto.hasStorage !== undefined && { hasStorage: dto.hasStorage }),
          ...(dto.storageCount !== undefined && { storageCount: dto.storageCount }),
          ...(dto.hasBalcony !== undefined && { hasBalcony: dto.hasBalcony }),
          balconySqm: dto.balconySqm ?? null,
          notes: dto.notes ?? null,
        },
      })
      await this.audit.record(actor, {
        action: 'CREATE', entity: 'Apartment', entityId: apartment.id,
        changes: { after: { apartmentNumber: apartment.apartmentNumber, buildingId: dto.buildingId } },
        metadata: { projectId: building.complex.projectId },
      }, tx)

      if (dto.owners?.length) {
        await this.ownership.applyPlans(
          [{ apartmentId: apartment.id, assignments: dto.owners }],
          actor,
          { tx },
        )
      }
      return apartment
    })
  }

  async updateApartment(id: string, dto: UpdateApartmentDto, actor: AuditActor) {
    const before = await this.prisma.apartment.findFirst({
      where: { id, ...this.apartmentScope(actor.tenantId) },
      select: {
        id: true, apartmentNumber: true, buildingId: true, floor: true,
        sizeSqm: true, rooms: true, notes: true,
        building: { select: { complex: { select: { projectId: true } } } },
      },
    })
    if (!before) throw DomainError.notFound('APARTMENT_NOT_FOUND', `דירה ${id} לא נמצאה`)

    if (dto.apartmentNumber && dto.apartmentNumber !== before.apartmentNumber) {
      const clash = await this.prisma.apartment.findFirst({
        where: {
          buildingId: before.buildingId,
          apartmentNumber: dto.apartmentNumber,
          NOT: { id },
        },
        select: { id: true },
      })
      if (clash) {
        throw DomainError.conflict('APARTMENT_NUMBER_TAKEN', `דירה ${dto.apartmentNumber} כבר קיימת במבנה זה.`)
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.apartment.update({
        where: { id },
        // `buildingId` is not updatable here — see `update()` on Building.
        data: {
          ...(dto.apartmentNumber !== undefined && { apartmentNumber: dto.apartmentNumber }),
          ...(dto.floor !== undefined && { floor: dto.floor }),
          ...(dto.sizeSqm !== undefined && { sizeSqm: dto.sizeSqm }),
          ...(dto.rooms !== undefined && { rooms: dto.rooms }),
          ...(dto.hasParking !== undefined && { hasParking: dto.hasParking }),
          ...(dto.parkingSpots !== undefined && { parkingSpots: dto.parkingSpots }),
          ...(dto.hasStorage !== undefined && { hasStorage: dto.hasStorage }),
          ...(dto.storageCount !== undefined && { storageCount: dto.storageCount }),
          ...(dto.hasBalcony !== undefined && { hasBalcony: dto.hasBalcony }),
          ...(dto.balconySqm !== undefined && { balconySqm: dto.balconySqm }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      })
      const changes = AuditService.diff(
        {
          apartmentNumber: before.apartmentNumber, floor: before.floor,
          sizeSqm: before.sizeSqm, rooms: before.rooms, notes: before.notes,
        },
        {
          apartmentNumber: after.apartmentNumber, floor: after.floor,
          sizeSqm: after.sizeSqm, rooms: after.rooms, notes: after.notes,
        },
      )
      if (changes) {
        await this.audit.record(actor, {
          action: 'UPDATE', entity: 'Apartment', entityId: id, changes,
          metadata: { projectId: before.building.complex.projectId },
        }, tx)
      }
      return after
    })
  }

  /** Archive / restore an apartment. Soft — ownership and signature history stay. */
  async setApartmentStatus(id: string, dto: SetEntityStatusDto, actor: AuditActor) {
    const before = await this.scope.assertApartment(id, actor.tenantId)
    if (before.status === dto.status) return before

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.apartment.update({ where: { id }, data: { status: dto.status } })
      const action: AuditActionName = dto.status === 'archived' ? 'DELETE' : 'UPDATE'
      await this.audit.record(actor, {
        action, entity: 'Apartment', entityId: id,
        changes: { before: { status: before.status }, after: { status: dto.status } },
        metadata: {
          reason: dto.status === 'archived' ? 'ARCHIVE' : 'RESTORE',
          projectId: before.building.complex.projectId,
        },
      }, tx)
      return after
    })
  }

  /** `DELETE /apartments/:id` archives. */
  async removeApartment(id: string, actor: AuditActor) {
    return this.setApartmentStatus(id, { status: 'archived' }, actor)
  }

  // ── Apartment ownership (delegates to the ONE shared service) ────────────

  async getApartmentOwners(id: string, tenantId: string) {
    await this.scope.assertApartment(id, tenantId)
    const summary = (await this.ownership.summarise([id], tenantId)).get(id)
    return {
      apartmentId: id,
      owners: summary?.holdings ?? [],
      sum: summary?.sum ?? { num: 0, den: 1 },
      isComplete: summary?.isComplete ?? false,
    }
  }

  async setApartmentOwners(id: string, dto: SetApartmentOwnersDto, actor: AuditActor) {
    await this.scope.assertApartment(id, actor.tenantId)
    await this.ownership.setApartmentOwners(id, dto.owners, actor, {
      requireCompleteShares: dto.requireCompleteShares ?? false,
    })
    return this.getApartmentOwners(id, actor.tenantId)
  }

  async removeApartmentOwner(id: string, ownerId: string, actor: AuditActor) {
    await this.scope.assertApartment(id, actor.tenantId)
    await this.ownership.removeOwnerFromApartment(id, ownerId, actor)
    return this.getApartmentOwners(id, actor.tenantId)
  }
}
