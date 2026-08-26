import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma.service'
import { AuditService, type AuditActor, type AuditEntry } from '../audit/audit.service'
import { TenantScopeService } from '../tenant/tenant-scope.service'
import { DomainError, type DomainErrorDetail } from '../errors/domain-error'
import { Fraction, sumFractionParts } from '../fractions'

/** One owner's share of one apartment. */
export interface OwnershipAssignment {
  ownerId: string
  shareNumerator: number
  shareDenominator: number
  viaInheritance?: boolean
  poaHolderId?: string | null
  acquiredAt?: Date | null
}

/** The complete intended ownership of one apartment. */
export interface ApartmentOwnershipPlan {
  apartmentId: string
  assignments: OwnershipAssignment[]
  /** Caller reference echoed back in errors — the Excel row number, typically. */
  ref?: string
}

export interface OwnershipIssue extends DomainErrorDetail {
  severity: 'ERROR' | 'WARNING'
  apartmentId: string
}

export interface OwnershipValidationReport {
  issues: OwnershipIssue[]
  /** True when nothing blocks the write. Warnings do not block. */
  ok: boolean
  /** Exact reduced share sum per apartment, for callers that want to display it. */
  sums: Map<string, { num: number; den: number }>
}

export interface OwnershipValidationOptions {
  /**
   * When true, shares summing to less than 1 is an ERROR rather than a WARNING.
   *
   * Default false, deliberately: real tabu extracts routinely arrive with
   * missing heirs, and blocking the write would push staff to invent shares —
   * which is far worse for the threshold than a recorded, flagged gap. Data
   * Quality raises `OWNERSHIP_SHARE_SUM_INVALID` for these, and an incomplete
   * apartment can never count as fully signed because the signed shares cannot
   * sum to exactly 1.
   */
  requireCompleteShares?: boolean
}

/**
 * THE ownership rules service.
 *
 * Every path that touches `OwnerApartment` goes through here — manual apartment
 * edit, manual owner edit, bulk owner assignment, and (Run 3) Excel import.
 * There is no second copy of these rules anywhere.
 *
 * Arithmetic is exact: shares are `Fraction`s from `src/common/fractions`, so
 * `1/3 + 1/3 + 1/3` is exactly 1 and `999/1000` is exactly not 1. No floats and
 * no epsilon appear in any decision here.
 *
 * BATCH-FIRST. Every method takes a LIST of plans and resolves all of its
 * database dependencies in a fixed number of queries regardless of list length,
 * so Excel import can validate ten thousand rows without N+1 and without
 * reimplementing a rule.
 */
@Injectable()
export class OwnershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: TenantScopeService,
    private readonly audit: AuditService,
  ) {}

  // ── Pure validation (no I/O — safe to call per row in a tight loop) ───────

  /**
   * Validates the SHAPE and ARITHMETIC of a set of plans. Does not touch the
   * database, so it cannot check that the ids exist — pair it with
   * {@link assertReferences}.
   */
  validatePlans(
    plans: readonly ApartmentOwnershipPlan[],
    opts: OwnershipValidationOptions = {},
  ): OwnershipValidationReport {
    const issues: OwnershipIssue[] = []
    const sums = new Map<string, { num: number; den: number }>()

    // The same apartment appearing twice in one batch would silently make the
    // last plan win — catch it rather than write an unpredictable result.
    const seenApartments = new Set<string>()

    for (const plan of plans) {
      const { apartmentId, assignments, ref } = plan
      const path = ref ?? apartmentId

      if (seenApartments.has(apartmentId)) {
        issues.push({
          severity: 'ERROR', apartmentId, path,
          code: 'OWNERSHIP_APARTMENT_DUPLICATED_IN_BATCH',
          message: 'אותה דירה מופיעה יותר מפעם אחת בבקשה.',
        })
        continue
      }
      seenApartments.add(apartmentId)

      const seenOwners = new Set<string>()
      const valid: { shareNumerator: number; shareDenominator: number }[] = []

      for (const a of assignments) {
        if (!a.ownerId) {
          issues.push({
            severity: 'ERROR', apartmentId, path,
            code: 'OWNERSHIP_OWNER_REQUIRED',
            message: 'חסר מזהה בעלים באחת מרשומות הבעלות.',
          })
          continue
        }
        if (seenOwners.has(a.ownerId)) {
          issues.push({
            severity: 'ERROR', apartmentId, path,
            code: 'OWNERSHIP_DUPLICATE_OWNER',
            message: 'אותו בעלים נרשם יותר מפעם אחת לאותה דירה.',
          })
          continue
        }
        seenOwners.add(a.ownerId)

        const share = Fraction.tryFrom(a.shareNumerator, a.shareDenominator)
        if (share === null) {
          issues.push({
            severity: 'ERROR', apartmentId, path,
            code: 'OWNERSHIP_SHARE_MALFORMED',
            message: `חלק הבעלות ${a.shareNumerator}/${a.shareDenominator} אינו שבר חוקי (המכנה חייב להיות מספר שלם שאינו אפס).`,
          })
          continue
        }
        if (share.isNegative() || share.isZero()) {
          issues.push({
            severity: 'ERROR', apartmentId, path,
            code: 'OWNERSHIP_SHARE_NOT_POSITIVE',
            message: `חלק הבעלות ${share.toString()} חייב להיות גדול מאפס.`,
          })
          continue
        }
        if (share.gt(Fraction.ONE)) {
          issues.push({
            severity: 'ERROR', apartmentId, path,
            code: 'OWNERSHIP_SHARE_EXCEEDS_ONE',
            message: `חלק הבעלות ${share.toString()} גדול מ-1.`,
          })
          continue
        }
        valid.push({ shareNumerator: a.shareNumerator, shareDenominator: a.shareDenominator })
      }

      // Exact sum — never a float comparison.
      const sum = sumFractionParts(valid)
      sums.set(apartmentId, sum.toJSON())

      if (sum.gt(Fraction.ONE)) {
        issues.push({
          severity: 'ERROR', apartmentId, path,
          code: 'OWNERSHIP_SHARE_SUM_EXCEEDS_ONE',
          message: `סכום חלקי הבעלות הוא ${sum.toString()} — גדול מ-1. בדקו רישום כפול או שבר שגוי.`,
        })
      } else if (assignments.length > 0 && !sum.isOne()) {
        issues.push({
          severity: opts.requireCompleteShares ? 'ERROR' : 'WARNING',
          apartmentId, path,
          code: 'OWNERSHIP_SHARE_SUM_INCOMPLETE',
          message: `סכום חלקי הבעלות הוא ${sum.toString()} במקום 1 — חסרה בעלות (יורשים, בני זוג).`,
        })
      }
    }

    return { issues, sums, ok: !issues.some((i) => i.severity === 'ERROR') }
  }

  /** Throws a single DomainError carrying every blocking issue. */
  assertValid(report: OwnershipValidationReport): void {
    if (report.ok) return
    throw new DomainError('VALIDATION', report.issues.filter((i) => i.severity === 'ERROR'))
  }

  // ── Reference checks (2 queries, independent of batch size) ──────────────

  /**
   * Verifies that every apartment and every owner referenced by the batch
   * exists INSIDE the tenant. Cross-tenant ids are reported as not found.
   */
  async assertReferences(
    plans: readonly ApartmentOwnershipPlan[],
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const apartmentIds = [...new Set(plans.map((p) => p.apartmentId))]
    const ownerIds = [...new Set(plans.flatMap((p) => p.assignments.map((a) => a.ownerId)).filter(Boolean))]
    // Two queries total, whatever the batch size.
    await this.scope.assertApartments(apartmentIds, tenantId, tx)
    await this.scope.assertOwners(ownerIds, tenantId, tx)
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /**
   * Current ownership of many apartments in ONE query, with the exact share sum
   * per apartment. Used by the apartment UI, the owner UI and Data Quality.
   */
  async summarise(
    apartmentIds: readonly string[],
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (!apartmentIds.length) return new Map<string, OwnershipSummary>()
    const rows = await (tx ?? this.prisma).ownerApartment.findMany({
      where: {
        apartmentId: { in: [...new Set(apartmentIds)] },
        apartment: TenantScopeService.scopes.apartment(tenantId),
      },
      select: {
        id: true, apartmentId: true, ownerId: true,
        shareNumerator: true, shareDenominator: true, viaInheritance: true,
        owner: { select: { id: true, fullName: true, isEstate: true, phone: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const out = new Map<string, OwnershipSummary>()
    for (const id of new Set(apartmentIds)) {
      out.set(id, { apartmentId: id, holdings: [], sum: { num: 0, den: 1 }, isComplete: false })
    }
    for (const r of rows) {
      const entry = out.get(r.apartmentId)
      if (!entry) continue
      entry.holdings.push(r)
    }
    for (const entry of out.values()) {
      const sum = sumFractionParts(entry.holdings)
      entry.sum = sum.toJSON()
      // "Complete" means EXACTLY 1 — not "close to 1".
      entry.isComplete = sum.isOne()
    }
    return out
  }

  /** All apartments a given owner holds, with the owning project resolved. */
  async holdingsForOwner(ownerId: string, tenantId: string) {
    await this.scope.assertOwner(ownerId, tenantId)
    return this.prisma.ownerApartment.findMany({
      where: { ownerId, apartment: TenantScopeService.scopes.apartment(tenantId) },
      select: {
        id: true, shareNumerator: true, shareDenominator: true, viaInheritance: true,
        apartment: {
          select: {
            id: true, apartmentNumber: true, floor: true, status: true,
            building: {
              select: {
                id: true, address: true, streetNumber: true, city: true,
                complex: { select: { id: true, name: true, projectId: true, project: { select: { id: true, name: true, code: true } } } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /**
   * Applies a batch of plans as a REPLACE: after this call each listed
   * apartment's ownership is exactly its plan.
   *
   * One transaction covers validation, the delete/insert and the audit rows, so
   * an apartment can never be left with a partial share set — which would
   * silently move the signature threshold.
   *
   * Query count is bounded and independent of batch size: 2 reference checks,
   * 1 read of current state, 1 deleteMany, 1 createMany, 1 audit createMany.
   */
  async applyPlans(
    plans: readonly ApartmentOwnershipPlan[],
    actor: AuditActor,
    opts: OwnershipValidationOptions & { tx?: Prisma.TransactionClient } = {},
  ): Promise<{ apartmentsUpdated: number; holdingsWritten: number }> {
    if (!plans.length) return { apartmentsUpdated: 0, holdingsWritten: 0 }

    this.assertValid(this.validatePlans(plans, opts))

    const run = async (tx: Prisma.TransactionClient) => {
      await this.assertReferences(plans, actor.tenantId, tx)

      const apartmentIds = [...new Set(plans.map((p) => p.apartmentId))]
      const before = await this.summarise(apartmentIds, actor.tenantId, tx)

      await tx.ownerApartment.deleteMany({ where: { apartmentId: { in: apartmentIds } } })

      const rows = plans.flatMap((p) =>
        p.assignments.map((a) => ({
          apartmentId: p.apartmentId,
          ownerId: a.ownerId,
          shareNumerator: a.shareNumerator,
          shareDenominator: a.shareDenominator,
          viaInheritance: a.viaInheritance ?? false,
          poaHolderId: a.poaHolderId ?? null,
          acquiredAt: a.acquiredAt ?? null,
        })),
      )
      if (rows.length) await tx.ownerApartment.createMany({ data: rows })

      const entries: AuditEntry[] = plans.map((p) => {
        const prev = before.get(p.apartmentId)
        return {
          action: 'UPDATE' as const,
          entity: 'ApartmentOwnership',
          entityId: p.apartmentId,
          changes: {
            before: prev?.holdings.map(shareTuple) ?? [],
            after: p.assignments.map(shareTuple),
          },
          metadata: {
            previousSum: prev?.sum ?? null,
            ownerCount: p.assignments.length,
          },
        }
      })
      await this.audit.recordMany(actor, entries, tx)

      return { apartmentsUpdated: apartmentIds.length, holdingsWritten: rows.length }
    }

    return opts.tx ? run(opts.tx) : this.prisma.$transaction(run)
  }

  /** Convenience wrapper for the single-apartment UI path. */
  async setApartmentOwners(
    apartmentId: string,
    assignments: OwnershipAssignment[],
    actor: AuditActor,
    opts: OwnershipValidationOptions = {},
  ) {
    return this.applyPlans([{ apartmentId, assignments }], actor, opts)
  }

  /**
   * Changes ONE owner's share of ONE apartment, leaving the other holdings
   * untouched. Still validated as a whole-apartment plan, so the resulting sum
   * is checked exactly — a percentage edit cannot push the apartment past 1.
   */
  async setOwnerShare(
    apartmentId: string,
    ownerId: string,
    share: { shareNumerator: number; shareDenominator: number },
    actor: AuditActor,
    opts: OwnershipValidationOptions = {},
  ) {
    const current = await this.summarise([apartmentId], actor.tenantId)
    const holdings = current.get(apartmentId)?.holdings ?? []
    const next: OwnershipAssignment[] = holdings
      .filter((h) => h.ownerId !== ownerId)
      .map((h) => ({
        ownerId: h.ownerId,
        shareNumerator: h.shareNumerator,
        shareDenominator: h.shareDenominator,
        viaInheritance: h.viaInheritance,
      }))
    next.push({ ownerId, ...share })
    return this.applyPlans([{ apartmentId, assignments: next }], actor, opts)
  }

  /** Removes one owner from one apartment. */
  async removeOwnerFromApartment(
    apartmentId: string,
    ownerId: string,
    actor: AuditActor,
  ) {
    const current = await this.summarise([apartmentId], actor.tenantId)
    const holdings = current.get(apartmentId)?.holdings ?? []
    if (!holdings.some((h) => h.ownerId === ownerId)) {
      throw DomainError.notFound('OWNERSHIP_HOLDING_NOT_FOUND', 'רשומת הבעלות לא נמצאה.')
    }
    const next: OwnershipAssignment[] = holdings
      .filter((h) => h.ownerId !== ownerId)
      .map((h) => ({
        ownerId: h.ownerId,
        shareNumerator: h.shareNumerator,
        shareDenominator: h.shareDenominator,
        viaInheritance: h.viaInheritance,
      }))
    // Removing an owner necessarily leaves the sum below 1; that is a WARNING,
    // never a block — you must be able to delete a wrongly recorded owner.
    return this.applyPlans([{ apartmentId, assignments: next }], actor)
  }
}

export interface OwnershipSummary {
  apartmentId: string
  holdings: {
    id: string
    apartmentId: string
    ownerId: string
    shareNumerator: number
    shareDenominator: number
    viaInheritance: boolean
    owner: { id: string; fullName: string; isEstate: boolean; phone: string | null; email: string | null }
  }[]
  sum: { num: number; den: number }
  isComplete: boolean
}

function shareTuple(a: { ownerId: string; shareNumerator: number; shareDenominator: number }) {
  return { ownerId: a.ownerId, share: `${a.shareNumerator}/${a.shareDenominator}` }
}
