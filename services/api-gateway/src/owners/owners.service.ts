import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { AuditService, type AuditActor, type AuditActionName, type AuditEntry } from '../common/audit/audit.service'
import { TenantScopeService } from '../common/tenant/tenant-scope.service'
import { OwnershipService, type OwnershipAssignment } from '../common/ownership/ownership.service'
import { NationalIdService } from '../common/pii/national-id.service'
import { DomainError } from '../common/errors/domain-error'
import type {
  CreateOwnerDto, UpdateOwnerDto, SetOwnerActiveDto, SetOwnerShareDto, BulkAssignOwnerDto,
} from './dto/owner.dto'

/**
 * Owner CRUD.
 *
 * `nationalId` is NEVER in this select list. Every response is built from it,
 * so a plaintext ID cannot escape by someone forgetting to strip a field.
 * Where the UI needs to know an ID exists, `hasNationalId` is derived instead.
 */
const OWNER_PUBLIC_SELECT = {
  id: true, fullName: true, phone: true, email: true, addressAbroad: true,
  isEstate: true, guardianContact: true, notes: true, residentId: true,
  isActive: true, createdAt: true, updatedAt: true,
} as const

@Injectable()
export class OwnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: TenantScopeService,
    private readonly ownership: OwnershipService,
    private readonly nationalIds: NationalIdService,
    private readonly audit: AuditService,
  ) {}

  // ── Reads ────────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    filters: { projectId?: string; search?: string; isActive?: boolean; isEstate?: boolean } = {},
  ) {
    const { projectId, search, isActive, isEstate } = filters

    const owners = await this.prisma.owner.findMany({
      where: {
        tenantId,
        ...(isActive === undefined ? {} : { isActive }),
        ...(isEstate === undefined ? {} : { isEstate }),
        ...(projectId
          ? { holdings: { some: { apartment: { building: { complex: { projectId } } } } } }
          : {}),
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
              // Searching by national ID is impossible by design: the random
              // IV means equal IDs have different ciphertexts, so there is
              // nothing to match against without decrypting every row.
            }
          : {}),
      },
      select: {
        ...OWNER_PUBLIC_SELECT,
        nationalId: true, // consumed below, never returned
        _count: { select: { holdings: true, signatures: true } },
      },
      orderBy: { fullName: 'asc' },
    })

    return owners.map(({ nationalId, _count, ...owner }) => ({
      ...owner,
      hasNationalId: this.nationalIds.isPresent(nationalId),
      nationalIdMasked: this.nationalIds.mask(nationalId),
      apartmentCount: _count.holdings,
      signatureCount: _count.signatures,
    }))
  }

  /**
   * Owner profile: identity, holdings, and read-only signature history.
   *
   * Documents, messages, tasks and the activity log hang off `Resident`, not
   * `Owner` — so they are surfaced here only through the linked resident, if
   * one exists. Conflating the two would attribute a tenant's message history
   * to a title holder who may never have lived in the building.
   */
  async findOne(id: string, tenantId: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { id, tenantId },
      select: { ...OWNER_PUBLIC_SELECT, nationalId: true },
    })
    if (!owner) throw DomainError.notFound('OWNER_NOT_FOUND', `בעלים ${id} לא נמצא`)

    const [holdings, signatures, resident] = await Promise.all([
      this.ownership.holdingsForOwner(id, tenantId),
      this.prisma.signatureRecord.findMany({
        where: { ownerId: id },
        select: {
          id: true, status: true, signedAt: true, apartmentId: true,
          package: { select: { id: true, title: true, version: true, status: true, projectId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      owner.residentId
        ? this.prisma.resident.findFirst({
            where: { id: owner.residentId, tenantId },
            select: {
              id: true, firstName: true, lastName: true, phone: true, email: true,
              signatureStatus: true, apartmentId: true, isActive: true,
              // nationalId deliberately not selected
            },
          })
        : Promise.resolve(null),
    ])

    const { nationalId, ...safe } = owner
    return {
      ...safe,
      hasNationalId: this.nationalIds.isPresent(nationalId),
      nationalIdMasked: this.nationalIds.mask(nationalId),
      holdings,
      signatures,
      /** Present only when this owner is also on file as a resident. */
      linkedResident: resident,
    }
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  async create(dto: CreateOwnerDto, actor: AuditActor) {
    // Validate + encrypt before anything else; an invalid ID must not create a
    // partially-written owner. The error message contains no digits.
    const encrypted = this.nationalIds.encryptForWrite(dto.nationalId)
    await this.assertNationalIdUnique(dto.nationalId, actor.tenantId)
    if (dto.residentId) await this.assertResidentLinkAvailable(dto.residentId, actor.tenantId)

    // Ownership arithmetic is checked before the transaction opens.
    if (dto.holdings?.length) {
      await this.assertHoldingsApplicable(dto.holdings, actor.tenantId)
    }

    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.owner.create({
        data: {
          tenantId: actor.tenantId,
          fullName: dto.fullName,
          nationalId: encrypted,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          addressAbroad: dto.addressAbroad ?? null,
          isEstate: dto.isEstate ?? false,
          guardianContact: dto.guardianContact ?? null,
          notes: dto.notes ?? null,
          residentId: dto.residentId ?? null,
        },
        select: OWNER_PUBLIC_SELECT,
      })

      await this.audit.record(actor, {
        action: 'CREATE', entity: 'Owner', entityId: owner.id,
        // `nationalIdProvided` records THAT an ID was set, never its value.
        changes: {
          after: {
            fullName: owner.fullName, isEstate: owner.isEstate,
            nationalIdProvided: Boolean(encrypted),
          },
        },
      }, tx)

      if (dto.holdings?.length) {
        await this.applyOwnerHoldings(owner.id, dto.holdings, actor, tx)
      }
      return owner
    })
  }

  async update(id: string, dto: UpdateOwnerDto, actor: AuditActor) {
    const before = await this.prisma.owner.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { ...OWNER_PUBLIC_SELECT, nationalId: true },
    })
    if (!before) throw DomainError.notFound('OWNER_NOT_FOUND', `בעלים ${id} לא נמצא`)

    const encrypted = dto.nationalId !== undefined
      ? this.nationalIds.encryptForWrite(dto.nationalId)
      : undefined
    if (dto.nationalId) await this.assertNationalIdUnique(dto.nationalId, actor.tenantId, id)
    if (dto.residentId) await this.assertResidentLinkAvailable(dto.residentId, actor.tenantId, id)

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.owner.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined && { fullName: dto.fullName }),
          ...(encrypted !== undefined && { nationalId: encrypted }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.addressAbroad !== undefined && { addressAbroad: dto.addressAbroad }),
          ...(dto.isEstate !== undefined && { isEstate: dto.isEstate }),
          ...(dto.guardianContact !== undefined && { guardianContact: dto.guardianContact }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.residentId !== undefined && { residentId: dto.residentId }),
        },
        select: OWNER_PUBLIC_SELECT,
      })

      const { nationalId: _b, ...beforeSafe } = before
      const changes = AuditService.diff(beforeSafe, after) ?? { after: {} }
      if (encrypted !== undefined) {
        // Only the FACT of a change is recorded — never either value.
        ;(changes.after as Record<string, unknown>).nationalIdChanged = true
      }
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'Owner', entityId: id, changes,
      }, tx)
      return after
    })
  }

  /**
   * Archive / restore an owner.
   *
   * Soft, always: `OwnerApartment` and `SignatureRecord` cascade from `Owner`,
   * so a hard delete would silently remove ownership shares — moving the
   * signature threshold — and destroy signed evidence. Archiving leaves the
   * holdings in place; they still count, which is correct, because title does
   * not lapse because a record was tidied away.
   */
  async setActive(id: string, dto: SetOwnerActiveDto, actor: AuditActor) {
    const before = await this.prisma.owner.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, isActive: true, fullName: true },
    })
    if (!before) throw DomainError.notFound('OWNER_NOT_FOUND', `בעלים ${id} לא נמצא`)
    if (before.isActive === dto.isActive) return before

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.owner.update({
        where: { id }, data: { isActive: dto.isActive }, select: OWNER_PUBLIC_SELECT,
      })
      const action: AuditActionName = dto.isActive ? 'UPDATE' : 'DELETE'
      await this.audit.record(actor, {
        action, entity: 'Owner', entityId: id,
        changes: { before: { isActive: before.isActive }, after: { isActive: dto.isActive } },
        metadata: { reason: dto.isActive ? 'RESTORE' : 'ARCHIVE' },
      }, tx)
      return after
    })
  }

  /** `DELETE /owners/:id` archives. See `setActive`. */
  async archive(id: string, actor: AuditActor) {
    return this.setActive(id, { isActive: false }, actor)
  }

  // ── Holdings (all arithmetic delegated to the shared OwnershipService) ────

  async listHoldings(id: string, tenantId: string) {
    return this.ownership.holdingsForOwner(id, tenantId)
  }

  /** Sets this owner's share of one apartment, leaving co-owners untouched. */
  async setShare(id: string, dto: SetOwnerShareDto, actor: AuditActor) {
    await this.scope.assertOwner(id, actor.tenantId)
    await this.scope.assertApartment(dto.apartmentId, actor.tenantId)
    await this.ownership.setOwnerShare(
      dto.apartmentId, id,
      { shareNumerator: dto.shareNumerator, shareDenominator: dto.shareDenominator },
      actor,
    )
    return this.ownership.holdingsForOwner(id, actor.tenantId)
  }

  async removeHolding(id: string, apartmentId: string, actor: AuditActor) {
    await this.scope.assertOwner(id, actor.tenantId)
    await this.scope.assertApartment(apartmentId, actor.tenantId)
    await this.ownership.removeOwnerFromApartment(apartmentId, id, actor)
    return this.ownership.holdingsForOwner(id, actor.tenantId)
  }

  /**
   * Bulk-assign one owner to many apartments at a uniform share.
   *
   * Each target apartment's FULL ownership set is rebuilt and revalidated, so
   * the batch is rejected outright if it would push any apartment past a share
   * sum of 1. One transaction covers the lot.
   */
  async bulkAssign(dto: BulkAssignOwnerDto, actor: AuditActor) {
    await this.scope.assertOwner(dto.ownerId, actor.tenantId)
    const apartmentIds = [...new Set(dto.apartmentIds)]
    await this.scope.assertApartments(apartmentIds, actor.tenantId)

    // ONE query loads the current ownership of every target apartment.
    const current = await this.ownership.summarise(apartmentIds, actor.tenantId)
    const plans = apartmentIds.map((apartmentId) => {
      const holdings = current.get(apartmentId)?.holdings ?? []
      const assignments: OwnershipAssignment[] = holdings
        .filter((h) => h.ownerId !== dto.ownerId)
        .map((h) => ({
          ownerId: h.ownerId,
          shareNumerator: h.shareNumerator,
          shareDenominator: h.shareDenominator,
          viaInheritance: h.viaInheritance,
        }))
      assignments.push({
        ownerId: dto.ownerId,
        shareNumerator: dto.shareNumerator,
        shareDenominator: dto.shareDenominator,
      })
      return { apartmentId, assignments, ref: apartmentId }
    })

    const result = await this.ownership.applyPlans(plans, actor)
    return { ...result, ownerId: dto.ownerId }
  }

  // ── Bulk ingest (Excel import) ───────────────────────────────────────────

  /**
   * Creates and updates many owners in a bounded number of queries.
   *
   * WHY THIS LIVES HERE AND NOT IN THE IMPORT MODULE
   * ------------------------------------------------
   * The import must not own a second copy of the owner rules. The natural
   * alternative — calling `create()` once per row — would have been a second
   * implementation in practice as well as an N+1: `create()` issues
   * `assertNationalIdUnique`, which loads EVERY owner in the tenant, so a
   * 5,000-row sheet would have run 5,000 full-table scans, and each row would
   * have opened its own transaction, making a partial import unavoidable.
   *
   * So the batch shape lives next to the single-row shape, in this file, and
   * both call the same rules:
   *
   *   - `NationalIdService.encryptForWrite` — check digit + AES-256-GCM, per
   *     row, exactly as `create()` does. An invalid ID throws before anything
   *     is written.
   *   - `NationalIdService.findCollisions` — the fingerprint duplicate check
   *     `assertNationalIdUnique` performs, run ONCE for the whole batch and
   *     re-run here inside the transaction so a concurrent manual create
   *     between preview and commit cannot slip a duplicate through.
   *   - `AuditService.recordMany` — one audit row per owner, same redaction.
   *
   * Ownership shares are NOT written here. The caller hands the resulting
   * owner ids to `OwnershipService.applyPlans`, which is the only writer of
   * `OwnerApartment` anywhere in the codebase.
   *
   * Queries: 1 duplicate-check read, 1 `createManyAndReturn`, 1 bulk `UPDATE`,
   * 1 audit `createMany` — four, whatever the batch size.
   */
  async applyImportBatch(
    batch: OwnerImportBatch,
    actor: AuditActor,
    tx: Prisma.TransactionClient,
  ): Promise<OwnerImportBatchResult> {
    const creates = batch.rows.filter((r) => r.existingOwnerId == null)
    const updates = batch.rows.filter((r) => r.existingOwnerId != null)

    // Encrypt (and therefore validate) every ID up front. A bad check digit
    // throws a DomainError here, before a single row is written — the same
    // ordering `create()` uses.
    const encrypted = new Map<string, string | null>()
    for (const row of batch.rows) {
      encrypted.set(row.ref, this.nationalIds.encryptForWrite(row.nationalId, `שורה ${row.ref}`))
    }

    // Re-check duplicates against live data INSIDE the transaction. The preview
    // ran the same check minutes ago against a snapshot; this is the one that
    // actually guards the write.
    const candidates = new Map<string, string | null | undefined>()
    for (const row of batch.rows) {
      if (row.nationalId) candidates.set(row.ref, row.nationalId)
    }
    if (candidates.size) {
      const existing = await tx.owner.findMany({
        where: { tenantId: actor.tenantId, nationalId: { not: null } },
        select: { id: true, nationalId: true },
      })
      const ignore = new Set(
        updates.map((r) => r.existingOwnerId!).filter(Boolean),
      )
      const collisions = this.nationalIds.findCollisions(candidates, existing, ignore)
      if (collisions.size) {
        throw new DomainError(
          'CONFLICT',
          [...collisions.keys()].map((ref) => ({
            code: 'OWNER_NATIONAL_ID_DUPLICATE',
            message: 'קיים כבר בעלים עם תעודת זהות זו בארגון.',
            path: ref,
          })),
        )
      }
    }

    const ownerIdByRef = new Map<string, string>()
    const auditEntries: AuditEntry[] = []

    // ── Creates ───────────────────────────────────────────────────────────
    if (creates.length) {
      // `fullName` is optional on OwnerImportRow (an UPDATE may legitimately omit
      // it and COALESCE keeps the stored value) but it is REQUIRED on Owner.
      // A create without a name is invalid data, so reject it rather than
      // coercing to '' and persisting nameless owners.
      const unnamed = creates.filter((r) => !r.fullName?.trim())
      if (unnamed.length) {
        throw new DomainError(
          'VALIDATION',
          unnamed.map((r) => ({
            code: 'OWNER_NAME_REQUIRED',
            message: 'לא ניתן ליצור בעלים ללא שם.',
            path: r.ref,
          })),
        )
      }

      const rows = await tx.owner.createManyAndReturn({
        data: creates.map((r) => ({
          tenantId: actor.tenantId,
          fullName: r.fullName!.trim(),
          nationalId: encrypted.get(r.ref) ?? null,
          phone: r.phone ?? null,
          email: r.email ?? null,
          addressAbroad: r.addressAbroad ?? null,
          isEstate: r.isEstate ?? false,
          notes: r.notes ?? null,
        })),
        select: { id: true, fullName: true, isEstate: true },
      })
      // `createManyAndReturn` preserves input order on PostgreSQL, which is how
      // each new id is tied back to its sheet row.
      creates.forEach((r, i) => {
        const created = rows[i]
        if (!created) return
        ownerIdByRef.set(r.ref, created.id)
        auditEntries.push({
          action: 'CREATE', entity: 'Owner', entityId: created.id,
          changes: {
            after: {
              fullName: created.fullName,
              isEstate: created.isEstate,
              // Records THAT an ID was set, never the value — as in `create()`.
              nationalIdProvided: Boolean(encrypted.get(r.ref)),
            },
          },
          metadata: { source: 'EXCEL_IMPORT', importJobId: batch.jobId, sheetRow: r.ref },
        })
      })
    }

    // ── Updates ───────────────────────────────────────────────────────────
    //
    // One statement for the whole batch. A BLANK CELL LEAVES THE STORED VALUE
    // ALONE (`COALESCE(v.col, o.col)`) rather than clearing it: an import sheet
    // that omits the email column must not wipe every owner's email, and a
    // half-filled sheet is the normal case. Clearing a field remains a manual
    // edit — which is the conservative and reversible default.
    //
    // `o."tenantId" = ...` in the WHERE clause is the write-time tenant guard,
    // independent of the scoping the validation pass already applied.
    if (updates.length) {
      const values = Prisma.join(
        updates.map((r) => {
          const enc = encrypted.get(r.ref) ?? null
          return Prisma.sql`(${r.existingOwnerId!}::text, ${r.fullName ?? null}::text, ${enc}::text, ${r.phone ?? null}::text, ${r.email ?? null}::text, ${r.addressAbroad ?? null}::text, ${r.isEstate ?? null}::boolean, ${r.notes ?? null}::text)`
        }),
      )
      await tx.$executeRaw`
        UPDATE "owners" AS o
        SET "fullName"      = COALESCE(v."fullName", o."fullName"),
            "nationalId"    = COALESCE(v."nationalId", o."nationalId"),
            "phone"         = COALESCE(v."phone", o."phone"),
            "email"         = COALESCE(v."email", o."email"),
            "addressAbroad" = COALESCE(v."addressAbroad", o."addressAbroad"),
            "isEstate"      = COALESCE(v."isEstate", o."isEstate"),
            "notes"         = COALESCE(v."notes", o."notes"),
            "updatedAt"     = NOW()
        FROM (VALUES ${values})
          AS v(id, "fullName", "nationalId", "phone", "email", "addressAbroad", "isEstate", "notes")
        WHERE o.id = v.id AND o."tenantId" = ${actor.tenantId}
      `
      for (const r of updates) {
        ownerIdByRef.set(r.ref, r.existingOwnerId!)
        auditEntries.push({
          action: 'UPDATE', entity: 'Owner', entityId: r.existingOwnerId!,
          changes: {
            after: {
              fullName: r.fullName ?? null,
              // Never either value — only that it changed.
              ...(encrypted.get(r.ref) ? { nationalIdChanged: true } : {}),
            },
          },
          metadata: { source: 'EXCEL_IMPORT', importJobId: batch.jobId, sheetRow: r.ref },
        })
      }
    }

    await this.audit.recordMany(actor, auditEntries, tx)

    return { created: creates.length, updated: updates.length, ownerIdByRef }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async applyOwnerHoldings(
    ownerId: string,
    holdings: { apartmentId: string; shareNumerator: number; shareDenominator: number; viaInheritance?: boolean }[],
    actor: AuditActor,
    tx?: Prisma.TransactionClient,
  ) {
    const apartmentIds = [...new Set(holdings.map((h) => h.apartmentId))]
    const current = await this.ownership.summarise(apartmentIds, actor.tenantId, tx)
    const plans = holdings.map((h) => {
      const existing = current.get(h.apartmentId)?.holdings ?? []
      const assignments: OwnershipAssignment[] = existing
        .filter((e) => e.ownerId !== ownerId)
        .map((e) => ({
          ownerId: e.ownerId,
          shareNumerator: e.shareNumerator,
          shareDenominator: e.shareDenominator,
          viaInheritance: e.viaInheritance,
        }))
      assignments.push({
        ownerId,
        shareNumerator: h.shareNumerator,
        shareDenominator: h.shareDenominator,
        viaInheritance: h.viaInheritance ?? false,
      })
      return { apartmentId: h.apartmentId, assignments }
    })
    return this.ownership.applyPlans(plans, actor, { tx })
  }

  /** Pre-flight for holdings supplied at create time. */
  private async assertHoldingsApplicable(
    holdings: { apartmentId: string }[],
    tenantId: string,
  ) {
    await this.scope.assertApartments(holdings.map((h) => h.apartmentId), tenantId)
  }

  /**
   * Duplicate national ID detection.
   *
   * Ciphertexts differ for identical IDs (random IV), so we compare SHA-256
   * fingerprints of the decrypted values — the same mechanism
   * `duplicate.rule.ts` uses, via the shared `NationalIdService`. One query
   * loads the tenant's stored IDs; nothing plaintext leaves the comparison.
   */
  private async assertNationalIdUnique(
    raw: string | null | undefined,
    tenantId: string,
    excludeId?: string,
  ) {
    if (!raw || raw.trim() === '') return
    const existing = await this.prisma.owner.findMany({
      where: { tenantId, nationalId: { not: null } },
      select: { id: true, nationalId: true },
    })
    const collisions = this.nationalIds.findCollisions(
      new Map([['new', raw]]),
      existing,
      new Set(excludeId ? [excludeId] : []),
    )
    if (collisions.has('new')) {
      throw DomainError.conflict(
        'OWNER_NATIONAL_ID_DUPLICATE',
        'קיים כבר בעלים עם תעודת זהות זו בארגון.',
      )
    }
  }

  /** `Owner.residentId` is `@unique` — one resident links to at most one owner. */
  private async assertResidentLinkAvailable(
    residentId: string,
    tenantId: string,
    excludeOwnerId?: string,
  ) {
    await this.scope.assertResident(residentId, tenantId)
    const taken = await this.prisma.owner.findFirst({
      where: { residentId, ...(excludeOwnerId ? { NOT: { id: excludeOwnerId } } : {}) },
      select: { id: true },
    })
    if (taken) {
      throw DomainError.conflict(
        'RESIDENT_ALREADY_LINKED',
        'הדייר כבר מקושר לרשומת בעלים אחרת.',
      )
    }
  }
}

export { OWNER_PUBLIC_SELECT }

/**
 * One sheet row's worth of owner data, already validated and normalised by the
 * import module. `ref` is the Excel row number as a string, echoed back in any
 * error so the user can find the offending line.
 */
export interface OwnerImportRow {
  ref: string
  /** `null`/absent → create. Present → update that owner. */
  existingOwnerId?: string | null
  fullName?: string
  /** RAW national ID. Validated and encrypted by NationalIdService here. */
  nationalId?: string
  phone?: string
  email?: string
  addressAbroad?: string
  isEstate?: boolean
  notes?: string
}

export interface OwnerImportBatch {
  jobId: string
  rows: OwnerImportRow[]
}

export interface OwnerImportBatchResult {
  created: number
  updated: number
  /** Sheet row → owner id, so the caller can build the ownership plans. */
  ownerIdByRef: Map<string, string>
}
