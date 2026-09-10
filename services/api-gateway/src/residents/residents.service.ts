import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { AutomationRunnerService } from '../automations/automation-runner.service'
import { AuditService, type AuditActor, type AuditActionName, type AuditEntry } from '../common/audit/audit.service'
import { TenantScopeService } from '../common/tenant/tenant-scope.service'
import { NationalIdService } from '../common/pii/national-id.service'
import { DomainError } from '../common/errors/domain-error'
import type { CreateResidentDto } from './dto/create-resident.dto'
import type { UpdateResidentDto } from './dto/update-resident.dto'
import type {
  UpdateSignatureStatusDto, AddResidentActivityDto, SetResidentActiveDto,
  MoveResidentDto, BulkResidentStatusDto, SetPortalAccessDto,
} from './dto/resident-actions.dto'

/**
 * `nationalId` (תעודת זהות) is PII and is never needed by the CRM UI, so it is
 * stripped from every resident payload leaving the API. Removing it here rather
 * than relying on each caller means a new consumer cannot accidentally leak it.
 */
function redactResident<T extends Record<string, any>>(resident: T): Omit<T, 'nationalId'> {
  const { nationalId: _omitted, ...safe } = resident
  return safe
}

@Injectable()
export class ResidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: TenantScopeService,
    private readonly nationalIds: NationalIdService,
    private readonly audit: AuditService,
    private readonly automations: AutomationRunnerService,
  ) {}

  async findAll(query: Record<string, string>, tenantId: string) {
    const { projectId, signatureStatus, search, page = '1', limit = '20' } = query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { tenantId }
    if (signatureStatus) where.signatureStatus = signatureStatus
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName:  { contains: search } },
        { phone:     { contains: search } },
      ]
    }
    if (projectId) {
      where.apartment = { building: { complex: { projectId } } }
    }

    const [data, total] = await Promise.all([
      this.prisma.resident.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { lastName: 'asc' },
        include: {
          apartment: {
            include: {
              building: {
                include: { complex: { include: { project: { select: { name: true, city: true } } } } },
              },
            },
          },
          signatures: { select: { status: true, signedAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.resident.count({ where }),
    ])

    return { data: data.map(redactResident), total, page: Number(page), limit: Number(limit) }
  }

  async findOne(id: string, tenantId: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { id, tenantId },
      include: {
        apartment: {
          include: {
            building: {
              include: { complex: { include: { project: { select: { id: true, name: true, city: true, stage: true } } } } },
            },
          },
        },
        activityLog: { orderBy: { createdAt: 'desc' }, take: 20 },
        signatures:  { orderBy: { createdAt: 'desc' }, take: 5 },
        tasks:       { where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }, orderBy: { dueDate: 'asc' } },
        tickets:     { where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }, orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })
    if (!resident) throw new NotFoundException(`דייר ${id} לא נמצא`)
    return redactResident(resident)
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /**
   * A `Resident` is whoever LIVES in the apartment — possibly a tenant with no
   * registered title at all. Ownership shares live on `Owner`/`OwnerApartment`
   * and are never inferred from a resident record.
   *
   * `Resident.ownershipPercentage` is a legacy display field on this model; it
   * is NOT used by the threshold engine, which reads exact `OwnerApartment`
   * fractions through the shared OwnershipService. It is left untouched here
   * rather than silently reinterpreted.
   */
  async create(dto: CreateResidentDto, actor: AuditActor) {
    const apartment = await this.scope.assertApartment(dto.apartmentId, actor.tenantId)
    // Validated and AES-256-GCM encrypted before persist; never stored raw.
    const encrypted = this.nationalIds.encryptForWrite(dto.nationalId)

    const created = await this.prisma.$transaction(async (tx) => {
      const resident = await tx.resident.create({
        data: {
          tenantId: actor.tenantId,
          apartmentId: dto.apartmentId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          nationalId: encrypted,
          phone: dto.phone ?? null,
          phone2: dto.phone2 ?? null,
          email: dto.email ?? null,
          ...(dto.ownershipPercentage !== undefined && { ownershipPercentage: dto.ownershipPercentage }),
          ...(dto.isPrimaryContact !== undefined && { isPrimaryContact: dto.isPrimaryContact }),
          ...(dto.language !== undefined && { language: dto.language as any }),
          ...(dto.preferredChannel !== undefined && { preferredChannel: dto.preferredChannel as any }),
          ...(dto.whatsappOptIn !== undefined && { whatsappOptIn: dto.whatsappOptIn }),
          ...(dto.smsOptIn !== undefined && { smsOptIn: dto.smsOptIn }),
          ...(dto.emailOptIn !== undefined && { emailOptIn: dto.emailOptIn }),
          ...(dto.doNotContact !== undefined && { doNotContact: dto.doNotContact }),
          doNotContactReason: dto.doNotContactReason ?? null,
          notes: dto.notes ?? null,
        },
      })
      await this.audit.record(actor, {
        action: 'CREATE', entity: 'Resident', entityId: resident.id,
        changes: {
          after: {
            firstName: resident.firstName, lastName: resident.lastName,
            apartmentId: resident.apartmentId,
            nationalIdProvided: Boolean(encrypted),
          },
        },
        metadata: { projectId: apartment.building.complex.projectId },
      }, tx)
      return redactResident(resident)
    })

    /**
     * Dispatched AFTER the transaction commits, never inside it.
     *
     * The runner performs its own writes, so running it inside the caller's
     * transaction would let an automation failure roll back the primary record.
     * And an automation must only ever act on committed state - messaging a
     * resident about a record that then rolled back cannot be taken back.
     *
     * `dispatch()` never throws, so a broken automation cannot turn a
     * successful operation into a 500.
     */
    await this.automations.dispatch({
      trigger: 'RESIDENT_CREATED',
      tenantId: actor.tenantId,
      projectId: apartment.building.complex.projectId,
      subjectId: created.id,
      /**
       * Context carries the resident's NAME only. No national id, no phone, no
       * email: this object is rendered into templates and copied into audit
       * metadata, and neither is a place for identifying contact details. The
       * message reaches the resident through `ResidentContactService`, which
       * resolves the address at send time under consent rules.
       */
      context: {
        residentFirstName: created.firstName ?? '',
        residentLastName: created.lastName ?? '',
      },
    })

    return created
  }

  /**
   * Bulk ingest for Excel import — the resident twin of
   * `OwnersService.applyImportBatch`, and it exists for the same reason: the
   * rules must have ONE implementation, and calling `create()` per row would
   * be both an N+1 and a per-row transaction (so a failure halfway through
   * would leave the sheet half-applied).
   *
   * Reuses, unchanged:
   *   - `NationalIdService.encryptForWrite` — check digit + encryption
   *   - `AuditService.recordMany` — one redacted audit row per resident
   *
   * `Resident.apartmentId` is required and is validated by the caller against
   * the project index; it is never inferred here.
   *
   * NOTE `ownershipPercentage` is deliberately NOT set from an import share.
   * It is a legacy display field on this model and the threshold engine does
   * not read it — writing an owner's fraction into it would create a second,
   * silently diverging record of ownership.
   *
   * Queries: 1 `createManyAndReturn`, 1 bulk `UPDATE`, 1 audit `createMany`.
   */
  async applyImportBatch(
    batch: ResidentImportBatch,
    actor: AuditActor,
    tx: Prisma.TransactionClient,
  ): Promise<ResidentImportBatchResult> {
    const creates = batch.rows.filter((r) => r.existingResidentId == null)
    const updates = batch.rows.filter((r) => r.existingResidentId != null)

    const encrypted = new Map<string, string | null>()
    for (const row of batch.rows) {
      encrypted.set(row.ref, this.nationalIds.encryptForWrite(row.nationalId, `שורה ${row.ref}`))
    }

    const residentIdByRef = new Map<string, string>()
    const auditEntries: AuditEntry[] = []

    if (creates.length) {
      const rows = await tx.resident.createManyAndReturn({
        data: creates.map((r) => ({
          tenantId: actor.tenantId,
          apartmentId: r.apartmentId,
          firstName: r.firstName ?? '',
          lastName: r.lastName ?? '',
          nationalId: encrypted.get(r.ref) ?? null,
          phone: r.phone ?? null,
          phone2: r.phone2 ?? null,
          email: r.email ?? null,
          notes: r.notes ?? null,
        })),
        select: { id: true, firstName: true, lastName: true, apartmentId: true },
      })
      creates.forEach((r, i) => {
        const created = rows[i]
        if (!created) return
        residentIdByRef.set(r.ref, created.id)
        auditEntries.push({
          action: 'CREATE', entity: 'Resident', entityId: created.id,
          changes: {
            after: {
              firstName: created.firstName, lastName: created.lastName,
              apartmentId: created.apartmentId,
              nationalIdProvided: Boolean(encrypted.get(r.ref)),
            },
          },
          metadata: { source: 'EXCEL_IMPORT', importJobId: batch.jobId, sheetRow: r.ref },
        })
      })
    }

    if (updates.length) {
      // A blank cell leaves the stored value alone — see the note on
      // `OwnersService.applyImportBatch`. `apartmentId` is NOT updatable here:
      // moving a resident between flats is `moveResident`, which writes an
      // activity record and is not something a spreadsheet should do silently.
      const values = Prisma.join(
        updates.map((r) => Prisma.sql`(${r.existingResidentId!}::text, ${r.firstName ?? null}::text, ${r.lastName ?? null}::text, ${encrypted.get(r.ref) ?? null}::text, ${r.phone ?? null}::text, ${r.phone2 ?? null}::text, ${r.email ?? null}::text, ${r.notes ?? null}::text)`),
      )
      await tx.$executeRaw`
        UPDATE "residents" AS t
        SET "firstName"  = COALESCE(v."firstName", t."firstName"),
            "lastName"   = COALESCE(v."lastName", t."lastName"),
            "nationalId" = COALESCE(v."nationalId", t."nationalId"),
            "phone"      = COALESCE(v."phone", t."phone"),
            "phone2"     = COALESCE(v."phone2", t."phone2"),
            "email"      = COALESCE(v."email", t."email"),
            "notes"      = COALESCE(v."notes", t."notes"),
            "updatedAt"  = NOW()
        FROM (VALUES ${values})
          AS v(id, "firstName", "lastName", "nationalId", "phone", "phone2", "email", "notes")
        WHERE t.id = v.id AND t."tenantId" = ${actor.tenantId}
      `
      for (const r of updates) {
        residentIdByRef.set(r.ref, r.existingResidentId!)
        auditEntries.push({
          action: 'UPDATE', entity: 'Resident', entityId: r.existingResidentId!,
          changes: {
            after: {
              firstName: r.firstName ?? null, lastName: r.lastName ?? null,
              ...(encrypted.get(r.ref) ? { nationalIdChanged: true } : {}),
            },
          },
          metadata: { source: 'EXCEL_IMPORT', importJobId: batch.jobId, sheetRow: r.ref },
        })
      }
    }

    await this.audit.recordMany(actor, auditEntries, tx)

    return { created: creates.length, updated: updates.length, residentIdByRef }
  }

  async update(id: string, dto: UpdateResidentDto, actor: AuditActor) {
    const before = await this.prisma.resident.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: {
        id: true, firstName: true, lastName: true, phone: true, phone2: true,
        email: true, notes: true, isPrimaryContact: true, doNotContact: true,
        ownershipPercentage: true,
      },
    })
    if (!before) throw DomainError.notFound('RESIDENT_NOT_FOUND', `דייר ${id} לא נמצא`)

    const encrypted = dto.nationalId !== undefined
      ? this.nationalIds.encryptForWrite(dto.nationalId)
      : undefined

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.resident.update({
        where: { id },
        // Explicit fields only — `apartmentId` and `tenantId` are unreachable.
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(encrypted !== undefined && { nationalId: encrypted }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.phone2 !== undefined && { phone2: dto.phone2 }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.ownershipPercentage !== undefined && { ownershipPercentage: dto.ownershipPercentage }),
          ...(dto.isPrimaryContact !== undefined && { isPrimaryContact: dto.isPrimaryContact }),
          ...(dto.language !== undefined && { language: dto.language as any }),
          ...(dto.preferredChannel !== undefined && { preferredChannel: dto.preferredChannel as any }),
          ...(dto.whatsappOptIn !== undefined && { whatsappOptIn: dto.whatsappOptIn }),
          ...(dto.smsOptIn !== undefined && { smsOptIn: dto.smsOptIn }),
          ...(dto.emailOptIn !== undefined && { emailOptIn: dto.emailOptIn }),
          ...(dto.doNotContact !== undefined && { doNotContact: dto.doNotContact }),
          ...(dto.doNotContactReason !== undefined && { doNotContactReason: dto.doNotContactReason }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      })

      const changes = AuditService.diff(before, {
        firstName: after.firstName, lastName: after.lastName, phone: after.phone,
        phone2: after.phone2, email: after.email, notes: after.notes,
        isPrimaryContact: after.isPrimaryContact, doNotContact: after.doNotContact,
        ownershipPercentage: after.ownershipPercentage,
      }) ?? { after: {} }
      if (encrypted !== undefined) {
        ;(changes.after as Record<string, unknown>).nationalIdChanged = true
      }
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'Resident', entityId: id, changes,
      }, tx)
      return redactResident(after)
    })
  }

  /**
   * Archive / restore a resident.
   *
   * Soft: messages, documents, signature requests and the activity log all
   * cascade from `Resident`, and a move-out must not erase the record of what
   * was sent to that household. There is no hard delete.
   */
  async setActive(id: string, dto: SetResidentActiveDto, actor: AuditActor) {
    const before = await this.prisma.resident.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, isActive: true },
    })
    if (!before) throw DomainError.notFound('RESIDENT_NOT_FOUND', `דייר ${id} לא נמצא`)
    if (before.isActive === dto.isActive) return before

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.resident.update({ where: { id }, data: { isActive: dto.isActive } })
      const action: AuditActionName = dto.isActive ? 'UPDATE' : 'DELETE'
      await this.audit.record(actor, {
        action, entity: 'Resident', entityId: id,
        changes: { before: { isActive: before.isActive }, after: { isActive: dto.isActive } },
        metadata: { reason: dto.isActive ? 'RESTORE' : 'ARCHIVE' },
      }, tx)
      return redactResident(after)
    })
  }

  /**
   * Turns the resident's PORTAL inbox on or off.
   *
   * ── WHY THIS METHOD HAD TO EXIST ─────────────────────────────────────────
   *
   * `MessageChannel.PORTAL` is a fully built delivery channel: it has its own
   * provider, the dispatcher writes it straight to `DELIVERED` because its
   * transport is this database, and `ResidentContactService` selects it as the
   * last resort for a resident who has opted out of SMS, WhatsApp and email —
   * the one channel needing no opt-in, because it is pull rather than push and
   * puts nothing on anybody's phone.
   *
   * The gate on all of that is `Resident.portalEnabled`, and nothing in the
   * product ever wrote to it: only the seed set it. So the channel built
   * specifically for the resident portal was unreachable for every resident
   * created through the API — the same shape of gap as `ResidentDocument`,
   * where a table the portal reads had no writer at all.
   *
   * ── WHY THE TENANT CHECK IS THE TRAVERSAL ────────────────────────────────
   *
   * `setActive` above scopes on `Resident.tenantId`. That column is a bare
   * scalar with no foreign key and can disagree with where the apartment
   * actually sits. Archiving a resident is an internal state change; opening a
   * communication channel to them is a grant, and a grant should not rest on
   * the weaker of two available checks. Same rule as document sharing.
   */
  async setPortalAccess(id: string, dto: SetPortalAccessDto, actor: AuditActor) {
    const before = await this.prisma.resident.findFirst({
      where: {
        id,
        apartment: { building: { complex: { project: { tenantId: actor.tenantId } } } },
      },
      select: { id: true, portalEnabled: true, isActive: true },
    })
    if (!before) throw DomainError.notFound('RESIDENT_NOT_FOUND', `דייר ${id} לא נמצא`)

    if (dto.enabled && !before.isActive) {
      // A former resident is not somebody to open a new channel to.
      throw DomainError.validation(
        'RESIDENT_INACTIVE',
        'לא ניתן להפעיל גישה לפורטל לדייר שהועבר לארכיון',
      )
    }

    if (before.portalEnabled === dto.enabled) {
      return { id: before.id, portalEnabled: before.portalEnabled, changed: false }
    }

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.resident.update({
        where: { id },
        data: { portalEnabled: dto.enabled },
        select: { id: true, portalEnabled: true },
      })
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'Resident', entityId: id,
        changes: {
          before: { portalEnabled: before.portalEnabled },
          after: { portalEnabled: dto.enabled },
        },
        metadata: { grant: dto.enabled ? 'PORTAL_INBOX_ENABLED' : 'PORTAL_INBOX_DISABLED' },
      }, tx)
      return { ...after, changed: true }
    })
  }

  /** `DELETE /residents/:id` archives. See `setActive`. */
  async archive(id: string, actor: AuditActor) {
    return this.setActive(id, { isActive: false }, actor)
  }

  /** Moving a resident between apartments — separate and separately audited. */
  async moveToApartment(id: string, dto: MoveResidentDto, actor: AuditActor) {
    const before = await this.scope.assertResident(id, actor.tenantId)
    const target = await this.scope.assertApartment(dto.apartmentId, actor.tenantId)
    if (before.apartmentId === dto.apartmentId) return before

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.resident.update({
        where: { id }, data: { apartmentId: dto.apartmentId },
      })
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'Resident', entityId: id,
        changes: {
          before: { apartmentId: before.apartmentId },
          after: { apartmentId: dto.apartmentId },
        },
        metadata: { reason: 'RESIDENT_MOVED', toProjectId: target.building.complex.projectId },
      }, tx)
      return redactResident(after)
    })
  }

  async updateStatus(id: string, dto: UpdateSignatureStatusDto, actor: AuditActor) {
    const before = await this.scope.assertResident(id, actor.tenantId)
    if (before.signatureStatus === dto.status) return before

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.resident.update({
        where: { id },
        data:  { signatureStatus: dto.status as any },
      })
      await tx.residentActivity.create({
        data: {
          residentId:  id,
          type:        'status_change',
          title:       `סטטוס עודכן ל-${dto.status}`,
          note:        dto.note ?? null,
          createdById: actor.userId,
        },
      })
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'Resident', entityId: id,
        changes: {
          before: { signatureStatus: before.signatureStatus },
          after: { signatureStatus: dto.status },
        },
        metadata: { reason: 'SIGNATURE_STATUS_CHANGE', note: dto.note ?? null },
      }, tx)
      return redactResident(updated)
    })
  }

  /**
   * Bulk signature-status change. One transaction, all-or-nothing, with an
   * activity row per resident so the household timeline stays truthful.
   */
  async bulkUpdateStatus(dto: BulkResidentStatusDto, actor: AuditActor) {
    const ids = [...new Set(dto.ids)]
    await this.scope.assertResidents(ids, actor.tenantId)

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.resident.findMany({
        where: { id: { in: ids }, tenantId: actor.tenantId },
        select: { id: true, signatureStatus: true },
      })
      await tx.resident.updateMany({
        where: { id: { in: ids }, tenantId: actor.tenantId },
        data: { signatureStatus: dto.status as any },
      })
      await tx.residentActivity.createMany({
        data: before.map((r) => ({
          residentId: r.id,
          type: 'status_change',
          title: `סטטוס עודכן ל-${dto.status}`,
          createdById: actor.userId,
        })),
      })
      await this.audit.recordMany(actor, before.map((r) => ({
        action: 'UPDATE' as const, entity: 'Resident', entityId: r.id,
        changes: {
          before: { signatureStatus: r.signatureStatus },
          after: { signatureStatus: dto.status },
        },
        metadata: { reason: 'BULK_SIGNATURE_STATUS_CHANGE', batchSize: ids.length },
      })), tx)
      return { updated: before.length, status: dto.status }
    })
  }

  async addActivity(id: string, dto: AddResidentActivityDto, actor: AuditActor) {
    await this.scope.assertResident(id, actor.tenantId)
    return this.prisma.residentActivity.create({
      data: {
        residentId: id,
        type: dto.type,
        title: dto.title,
        note: dto.note ?? null,
        createdById: actor.userId,
      },
    })
  }
}

/**
 * One sheet row's worth of resident data, validated and normalised by the
 * import module. `ref` is the Excel row number.
 */
export interface ResidentImportRow {
  ref: string
  /** `null`/absent → create. Present → update that resident. */
  existingResidentId?: string | null
  /** Required for a create; resolved from the sheet by the import validator. */
  apartmentId: string
  firstName?: string
  lastName?: string
  /** RAW national ID. Validated and encrypted by NationalIdService. */
  nationalId?: string
  phone?: string
  phone2?: string
  email?: string
  notes?: string
}

export interface ResidentImportBatch {
  jobId: string
  rows: ResidentImportRow[]
}

export interface ResidentImportBatchResult {
  created: number
  updated: number
  residentIdByRef: Map<string, string>
}
