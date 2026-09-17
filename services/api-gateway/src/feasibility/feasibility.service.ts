import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AuditService } from '../common/audit/audit.service'
import type { AuditActor } from '../common/audit/audit.service'
import { DomainError } from '../common/errors/domain-error'
import { TenantScopeService } from '../common/tenant/tenant-scope.service'
import { PrismaService } from '../prisma.service'
import {
  CreateFeasibilityAreaDto, CreateFeasibilityAssumptionDto,
  CreateFeasibilityProfileDto, CreateFeasibilitySourceDto, CreateGushChelkaDto, UpdateGushChelkaDto, UpdateFeasibilitySourceDto,
  CreatePlanningRightDto, UpdatePlanningRightDto, CreateFeasibilityScenarioDto, CreateUnitMixLineDto, UpdateUnitMixLineDto,
  CreateFeasibilityRevenueLineDto, CreateFeasibilityCostLineDto,
  UpdateFeasibilityRevenueLineDto, UpdateFeasibilityCostLineDto,
  CreateFeasibilityCashFlowAllocationDto, CreateFeasibilityTimelinePhaseDto, UpdateFeasibilityCashFlowAllocationDto, UpdateFeasibilityProfileDto, UpdateFeasibilityAssumptionDto, UpdateFeasibilityAreaDto,
  CreateFeasibilityCompensationLineDto, UpdateFeasibilityCompensationLineDto,
  CreateComparableAdjustmentDto, CreateComparableTransactionDto, UpdateComparableAdjustmentDto, UpdateComparableTransactionDto,
  UpsertFeasibilityFinancingDto,
} from './dto/feasibility-foundation.dto'

const PROFILE_INCLUDE = {
  parcels: { orderBy: [{ gush: 'asc' }, { chelka: 'asc' }] },
  sources: { orderBy: { createdAt: 'desc' } },
  assumptions: { orderBy: { key: 'asc' } },
  areas: { orderBy: [{ areaType: 'asc' }, { createdAt: 'asc' }] },
  planningRights: { orderBy: { createdAt: 'asc' } },
  comparableTransactions: { include: { adjustments: { orderBy: { createdAt: 'asc' } } }, orderBy: { transactionDate: 'desc' } },
  scenarios: {
    include: {
      unitMix: { orderBy: { createdAt: 'asc' } },
      revenueLines: { orderBy: { createdAt: 'asc' } },
      costLines: { orderBy: { createdAt: 'asc' } },
      financing: true,
      timelinePhases: { orderBy: { createdAt: 'asc' } },
      cashFlowAllocations: { orderBy: { periodStart: 'asc' } },
      // `ownerApartment` is loaded because the engine checks that every
      // compensation line is actually tied to a real apartment before it will
      // let a report be approved. Without the relation the check cannot tell a
      // missing link from an unloaded one.
      compensations: { include: { ownerApartment: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: [{ isBaseline: 'desc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.FeasibilityProfileInclude

function decimal(value: string | undefined): Prisma.Decimal | undefined {
  if (value === undefined) return undefined
  const parsed = new Prisma.Decimal(value)
  if (parsed.isNegative()) throw DomainError.validation('FEASIBILITY_NEGATIVE_VALUE', 'ערך כלכלי או שטח לא יכול להיות שלילי')
  return parsed
}

function date(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value)
}

/** Prisma represents an absent Decimal column as null, whereas the creation
 * DTO uses undefined for an absent calculation basis. Keep that distinction
 * when validating a partial update: null must not accidentally count as a
 * second revenue/cost basis. */
function existingDecimal(value: Prisma.Decimal | null | undefined): string | undefined {
  return value == null ? undefined : value.toString()
}

/**
 * Phase 1 source-data service. It deliberately persists no calculated outputs:
 * scenario calculation snapshots are a later, separate layer.
 */
@Injectable()
export class FeasibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: TenantScopeService,
    private readonly audit: AuditService,
  ) {}

  async find(projectId: string, tenantId: string) {
    await this.scope.assertProject(projectId, tenantId)
    const profile = await this.prisma.feasibilityProfile.findFirst({
      where: { projectId, tenantId },
      include: PROFILE_INCLUDE,
    })
    if (!profile) return null
    // Derived comparison values are response-only calculation views. They are
    // never written back into a source transaction and use Prisma Decimal.
    const comparableTransactions = profile.comparableTransactions.map((comparable) => {
      const observedPricePerSqm = comparable.transactionPrice.div(comparable.saleableAreaSqm)
      const adjustmentFactor = comparable.adjustments.reduce((factor, adjustment) => factor.mul(adjustment.factor), new Prisma.Decimal(1))
      return { ...comparable, observedPricePerSqm: observedPricePerSqm.toFixed(2), adjustmentFactor: adjustmentFactor.toFixed(8), adjustedPricePerSqm: observedPricePerSqm.mul(adjustmentFactor).toFixed(2) }
    })
    return { ...profile, comparableTransactions }
  }

  /**
   * Read-only bridge to the canonical ownership registry for compensation.
   * We deliberately return a holding id rather than copying owner/apartment
   * data into feasibility tables. National IDs are never selected.
   */
  async listCompensationCandidates(projectId: string, tenantId: string) {
    await this.scope.assertProject(projectId, tenantId)
    return this.prisma.ownerApartment.findMany({
      where: {
        owner: { tenantId, isActive: true },
        apartment: { building: { complex: { projectId } } },
      },
      select: {
        id: true, shareNumerator: true, shareDenominator: true,
        owner: { select: { id: true, fullName: true } },
        apartment: { select: { id: true, apartmentNumber: true, floor: true, building: { select: { id: true, address: true } } } },
      },
      orderBy: [{ apartment: { apartmentNumber: 'asc' } }, { owner: { fullName: 'asc' } }],
    })
  }

  async create(projectId: string, dto: CreateFeasibilityProfileDto, actor: AuditActor) {
    await this.scope.assertProject(projectId, actor.tenantId)
    const existing = await this.prisma.feasibilityProfile.findFirst({ where: { projectId, tenantId: actor.tenantId } })
    if (existing) throw DomainError.conflict('FEASIBILITY_PROFILE_EXISTS', 'כבר קיים פרופיל דוח אפס לפרויקט')
    const profile = await this.prisma.$transaction(async (tx) => {
      const created = await tx.feasibilityProfile.create({
        data: {
          tenantId: actor.tenantId,
          projectId,
          projectType: dto.projectType,
          reportType: dto.reportType,
          purpose: dto.purpose,
          valuationDate: new Date(dto.valuationDate),
          reportDate: new Date(dto.reportDate),
          clientName: dto.clientName,
          developerName: dto.developerName,
          appraiserName: dto.appraiserName,
          neighborhood: dto.neighborhood,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      })
      await this.audit.record(actor, { action: 'CREATE', entity: 'FeasibilityProfile', entityId: created.id, changes: { after: { projectId, projectType: dto.projectType, reportType: dto.reportType } } }, tx)
      return created
    })
    return this.find(profile.projectId, actor.tenantId)
  }

  async update(projectId: string, dto: UpdateFeasibilityProfileDto, actor: AuditActor) {
    const before = await this.requireProfile(projectId, actor.tenantId)
    if (before.status === 'LOCKED') throw DomainError.conflict('FEASIBILITY_PROFILE_LOCKED', 'פרופיל נעול אינו ניתן לעריכה')
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.feasibilityProfile.update({
        where: { id: before.id },
        data: {
          ...(dto.projectType !== undefined ? { projectType: dto.projectType } : {}),
          ...(dto.reportType !== undefined ? { reportType: dto.reportType } : {}),
          ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
          ...(dto.valuationDate !== undefined ? { valuationDate: new Date(dto.valuationDate) } : {}),
          ...(dto.reportDate !== undefined ? { reportDate: new Date(dto.reportDate) } : {}),
          ...(dto.clientName !== undefined ? { clientName: dto.clientName } : {}),
          ...(dto.developerName !== undefined ? { developerName: dto.developerName } : {}),
          ...(dto.appraiserName !== undefined ? { appraiserName: dto.appraiserName } : {}),
          ...(dto.neighborhood !== undefined ? { neighborhood: dto.neighborhood } : {}),
          updatedById: actor.userId,
        },
      })
      await this.audit.record(actor, { action: 'UPDATE', entity: 'FeasibilityProfile', entityId: before.id, changes: AuditService.diff(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>) }, tx)
    })
    return this.find(projectId, actor.tenantId)
  }

  async addParcel(projectId: string, dto: CreateGushChelkaDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertSource(profile.id, dto.sourceId)
    return this.mutateChild(profile.id, actor, 'GushChelkaRecord', (tx) => tx.gushChelkaRecord.create({
      data: { feasibilityProfileId: profile.id, gush: dto.gush, chelka: dto.chelka, subChelka: dto.subChelka, landAreaSqm: decimal(dto.landAreaSqm), address: dto.address, notes: dto.notes, classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate) },
    }))
  }

  async updateParcel(projectId: string, parcelId: string, dto: UpdateGushChelkaDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.gushChelkaRecord.findFirst({ where: { id: parcelId, feasibilityProfileId: profile.id } })
    if (!before) throw DomainError.notFound('FEASIBILITY_PARCEL_NOT_FOUND', 'רישום גוש וחלקה אינו שייך לפרויקט')
    if (dto.sourceId !== undefined) await this.assertSource(profile.id, dto.sourceId)
    return this.updateFoundation(profile.id, actor, 'GushChelkaRecord', before, (tx) => tx.gushChelkaRecord.update({ where: { id: before.id }, data: { ...(dto.gush !== undefined ? { gush: dto.gush } : {}), ...(dto.chelka !== undefined ? { chelka: dto.chelka } : {}), ...(dto.subChelka !== undefined ? { subChelka: dto.subChelka } : {}), ...(dto.landAreaSqm !== undefined ? { landAreaSqm: decimal(dto.landAreaSqm) } : {}), ...(dto.address !== undefined ? { address: dto.address } : {}), ...(dto.classification !== undefined ? { classification: dto.classification } : {}), ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}), ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}), ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}), ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}) } }))
  }

  async deleteParcel(projectId: string, parcelId: string, actor: AuditActor) { return this.deleteFoundation(projectId, parcelId, actor, 'GushChelkaRecord', (profileId) => this.prisma.gushChelkaRecord.findFirst({ where: { id: parcelId, feasibilityProfileId: profileId }, select: { id: true } }), (tx) => tx.gushChelkaRecord.delete({ where: { id: parcelId } })) }

  async addComparableTransaction(projectId: string, dto: CreateComparableTransactionDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertSource(profile.id, dto.sourceId)
    const transactionPrice = decimal(dto.transactionPrice)
    const saleableAreaSqm = decimal(dto.saleableAreaSqm)
    if (!transactionPrice || transactionPrice.lte(0) || !saleableAreaSqm || saleableAreaSqm.lte(0)) {
      throw DomainError.validation('FEASIBILITY_COMPARABLE_PRICE_OR_AREA_INVALID', 'מחיר עסקה ושטח מכירה בעסקת השוואה חייבים להיות גדולים מאפס.')
    }
    return this.mutateChild(profile.id, actor, 'ComparableTransaction', (tx) => tx.comparableTransaction.create({
      data: {
        tenantId: actor.tenantId, feasibilityProfileId: profile.id, address: dto.address, transactionDate: new Date(dto.transactionDate),
        transactionPrice, saleableAreaSqm, rooms: decimal(dto.rooms), floor: dto.floor,
        buildingAgeYears: dto.buildingAgeYears, condition: dto.condition, hasParking: dto.hasParking ?? false, balconyAreaSqm: decimal(dto.balconyAreaSqm), storageAreaSqm: decimal(dto.storageAreaSqm),
        sourceId: dto.sourceId, sourceUrl: dto.sourceUrl, reliability: dto.reliability, notes: dto.notes, createdById: actor.userId, updatedById: actor.userId,
      },
    }))
  }

  async addComparableAdjustment(projectId: string, comparableId: string, dto: CreateComparableAdjustmentDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const comparable = await this.prisma.comparableTransaction.findFirst({ where: { id: comparableId, tenantId: actor.tenantId, feasibilityProfileId: profile.id }, select: { id: true } })
    if (!comparable) throw DomainError.notFound('FEASIBILITY_COMPARABLE_NOT_FOUND', 'עסקת ההשוואה אינה שייכת לפרויקט או ל־tenant')
    await this.assertSource(profile.id, dto.sourceId)
    const factor = decimal(dto.factor)
    if (!factor || factor.lte(0)) throw DomainError.validation('FEASIBILITY_COMPARABLE_ADJUSTMENT_FACTOR_INVALID', 'מקדם התאמה חייב להיות גדול מאפס.')
    return this.mutateChild(profile.id, actor, 'ComparableAdjustment', (tx) => tx.comparableAdjustment.create({
      data: {
        comparableTransactionId: comparable.id, category: dto.category, factor, description: dto.description, classification: dto.classification,
        confidence: dto.confidence, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), createdById: actor.userId, updatedById: actor.userId,
      },
    }))
  }

  async updateComparableTransaction(projectId: string, comparableId: string, dto: UpdateComparableTransactionDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.comparableTransaction.findFirst({ where: { id: comparableId, tenantId: actor.tenantId, feasibilityProfileId: profile.id } })
    if (!before) throw DomainError.notFound('FEASIBILITY_COMPARABLE_NOT_FOUND', 'עסקת ההשוואה אינה שייכת לפרויקט או ל־tenant')
    await this.assertSource(profile.id, dto.sourceId)
    const price = dto.transactionPrice === undefined ? before.transactionPrice : decimal(dto.transactionPrice)
    const area = dto.saleableAreaSqm === undefined ? before.saleableAreaSqm : decimal(dto.saleableAreaSqm)
    if (!price || price.lte(0) || !area || area.lte(0)) throw DomainError.validation('FEASIBILITY_COMPARABLE_PRICE_OR_AREA_INVALID', 'מחיר עסקה ושטח מכירה בעסקת השוואה חייבים להיות גדולים מאפס.')
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.comparableTransaction.update({ where: { id: before.id }, data: {
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.transactionDate !== undefined ? { transactionDate: new Date(dto.transactionDate) } : {}),
        ...(dto.transactionPrice !== undefined ? { transactionPrice: price } : {}),
        ...(dto.saleableAreaSqm !== undefined ? { saleableAreaSqm: area } : {}),
        ...(dto.rooms !== undefined ? { rooms: decimal(dto.rooms) } : {}), ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
        ...(dto.buildingAgeYears !== undefined ? { buildingAgeYears: dto.buildingAgeYears } : {}), ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
        ...(dto.hasParking !== undefined ? { hasParking: dto.hasParking } : {}), ...(dto.balconyAreaSqm !== undefined ? { balconyAreaSqm: decimal(dto.balconyAreaSqm) } : {}),
        ...(dto.storageAreaSqm !== undefined ? { storageAreaSqm: decimal(dto.storageAreaSqm) } : {}), ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}),
        ...(dto.sourceUrl !== undefined ? { sourceUrl: dto.sourceUrl } : {}), ...(dto.reliability !== undefined ? { reliability: dto.reliability } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}), updatedById: actor.userId,
      } })
      await this.audit.record(actor, { action: 'UPDATE', entity: 'ComparableTransaction', entityId: before.id, changes: AuditService.diff(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>) }, tx)
      return updated
    })
  }

  async updateComparableAdjustment(projectId: string, comparableId: string, adjustmentId: string, dto: UpdateComparableAdjustmentDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.comparableAdjustment.findFirst({ where: { id: adjustmentId, comparableTransactionId: comparableId, comparableTransaction: { tenantId: actor.tenantId, feasibilityProfileId: profile.id } } })
    if (!before) throw DomainError.notFound('FEASIBILITY_COMPARABLE_ADJUSTMENT_NOT_FOUND', 'התאמת עסקת ההשוואה אינה שייכת לפרויקט או ל־tenant')
    await this.assertSource(profile.id, dto.sourceId)
    const factor = dto.factor === undefined ? before.factor : decimal(dto.factor)
    if (!factor || factor.lte(0)) throw DomainError.validation('FEASIBILITY_COMPARABLE_ADJUSTMENT_FACTOR_INVALID', 'מקדם התאמה חייב להיות גדול מאפס.')
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.comparableAdjustment.update({ where: { id: before.id }, data: { ...(dto.category !== undefined ? { category: dto.category } : {}), ...(dto.factor !== undefined ? { factor } : {}), ...(dto.description !== undefined ? { description: dto.description } : {}), ...(dto.classification !== undefined ? { classification: dto.classification } : {}), ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}), ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}), ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}), updatedById: actor.userId } })
      await this.audit.record(actor, { action: 'UPDATE', entity: 'ComparableAdjustment', entityId: before.id, changes: AuditService.diff(before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>) }, tx)
      return updated
    })
  }

  async addSource(projectId: string, dto: CreateFeasibilitySourceDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    if (dto.documentId) await this.assertDocument(projectId, dto.documentId, actor.tenantId)
    return this.mutateChild(profile.id, actor, 'FeasibilitySource', (tx) => tx.feasibilitySource.create({
      data: { feasibilityProfileId: profile.id, type: dto.type, title: dto.title, issuer: dto.issuer, sourceDate: date(dto.sourceDate), documentId: dto.documentId, sourceUrl: dto.sourceUrl, pageReference: dto.pageReference, extractedValue: dto.extractedValue, notes: dto.notes, reliability: dto.reliability, createdById: actor.userId, updatedById: actor.userId },
    }))
  }

  async updateSource(projectId: string, sourceId: string, dto: UpdateFeasibilitySourceDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.feasibilitySource.findFirst({ where: { id: sourceId, feasibilityProfileId: profile.id } })
    if (!before) throw DomainError.notFound('FEASIBILITY_SOURCE_NOT_FOUND', 'מקור אינו שייך לפרופיל דוח האפס')
    if (dto.documentId !== undefined) await this.assertDocument(projectId, dto.documentId, actor.tenantId)
    return this.updateFoundation(profile.id, actor, 'FeasibilitySource', before, (tx) => tx.feasibilitySource.update({ where: { id: before.id }, data: { ...(dto.type !== undefined ? { type: dto.type } : {}), ...(dto.title !== undefined ? { title: dto.title } : {}), ...(dto.issuer !== undefined ? { issuer: dto.issuer } : {}), ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}), ...(dto.documentId !== undefined ? { documentId: dto.documentId } : {}), ...(dto.sourceUrl !== undefined ? { sourceUrl: dto.sourceUrl } : {}), ...(dto.pageReference !== undefined ? { pageReference: dto.pageReference } : {}), ...(dto.extractedValue !== undefined ? { extractedValue: dto.extractedValue } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}), ...(dto.reliability !== undefined ? { reliability: dto.reliability } : {}), updatedById: actor.userId } }))
  }

  async deleteSource(projectId: string, sourceId: string, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const source = await this.prisma.feasibilitySource.findFirst({ where: { id: sourceId, feasibilityProfileId: profile.id }, select: { id: true } })
    if (!source) throw DomainError.notFound('FEASIBILITY_SOURCE_NOT_FOUND', 'מקור אינו שייך לפרופיל דוח האפס')
    const references = await Promise.all([this.prisma.gushChelkaRecord.count({ where: { feasibilityProfileId: profile.id, sourceId } }), this.prisma.feasibilityAssumption.count({ where: { feasibilityProfileId: profile.id, sourceId } }), this.prisma.feasibilityAreaLine.count({ where: { feasibilityProfileId: profile.id, sourceId } }), this.prisma.planningRight.count({ where: { feasibilityProfileId: profile.id, sourceId } }), this.prisma.comparableTransaction.count({ where: { feasibilityProfileId: profile.id, sourceId } }), this.prisma.comparableAdjustment.count({ where: { sourceId, comparableTransaction: { feasibilityProfileId: profile.id } } }), this.prisma.feasibilityUnitMixLine.count({ where: { sourceId, scenario: { feasibilityProfileId: profile.id } } }), this.prisma.feasibilityRevenueLine.count({ where: { sourceId, scenario: { feasibilityProfileId: profile.id } } }), this.prisma.feasibilityCostLine.count({ where: { sourceId, scenario: { feasibilityProfileId: profile.id } } }), this.prisma.feasibilityCompensationLine.count({ where: { sourceId, scenario: { feasibilityProfileId: profile.id } } })])
    if (references.some(Boolean)) throw DomainError.conflict('FEASIBILITY_SOURCE_IN_USE', 'לא ניתן למחוק מקור שמקושר לנתוני דוח אפס. עדכנו או נתקו קודם את הקישורים.')
    return this.deleteFoundation(projectId, sourceId, actor, 'FeasibilitySource', () => Promise.resolve(source), (tx) => tx.feasibilitySource.delete({ where: { id: sourceId } }))
  }

  async addAssumption(projectId: string, dto: CreateFeasibilityAssumptionDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertSource(profile.id, dto.sourceId)
    if (dto.value === undefined && !dto.textValue) throw DomainError.validation('FEASIBILITY_ASSUMPTION_VALUE_REQUIRED', 'להנחה נדרש ערך מספרי או טקסטואלי')
    if (dto.validFrom && dto.validUntil && new Date(dto.validFrom) > new Date(dto.validUntil)) throw DomainError.validation('FEASIBILITY_ASSUMPTION_DATE_RANGE', 'תוקף ההנחה אינו תקין')
    return this.mutateChild(profile.id, actor, 'FeasibilityAssumption', (tx) => tx.feasibilityAssumption.create({
      data: { feasibilityProfileId: profile.id, key: dto.key, label: dto.label, value: decimal(dto.value), textValue: dto.textValue, unit: dto.unit, classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), validFrom: date(dto.validFrom), validUntil: date(dto.validUntil), impact: dto.impact, notes: dto.notes, createdById: actor.userId, updatedById: actor.userId },
    }))
  }

  async updateAssumption(projectId: string, assumptionId: string, dto: UpdateFeasibilityAssumptionDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.feasibilityAssumption.findFirst({ where: { id: assumptionId, feasibilityProfileId: profile.id } })
    if (!before) throw DomainError.notFound('FEASIBILITY_ASSUMPTION_NOT_FOUND', 'ההנחה אינה שייכת לפרויקט')
    if (dto.sourceId !== undefined) await this.assertSource(profile.id, dto.sourceId)
    const value = dto.value === undefined ? before.value : decimal(dto.value)
    const textValue = dto.textValue === undefined ? before.textValue : dto.textValue
    if (!value && !textValue) throw DomainError.validation('FEASIBILITY_ASSUMPTION_VALUE_REQUIRED', 'להנחה נדרש ערך מספרי או טקסטואלי')
    const validFrom = dto.validFrom === undefined ? before.validFrom : date(dto.validFrom)
    const validUntil = dto.validUntil === undefined ? before.validUntil : date(dto.validUntil)
    if (validFrom && validUntil && validFrom > validUntil) throw DomainError.validation('FEASIBILITY_ASSUMPTION_DATE_RANGE', 'תוקף ההנחה אינו תקין')
    return this.updateFoundation(profile.id, actor, 'FeasibilityAssumption', before, (tx) => tx.feasibilityAssumption.update({ where: { id: before.id }, data: { ...(dto.key !== undefined ? { key: dto.key } : {}), ...(dto.label !== undefined ? { label: dto.label } : {}), ...(dto.value !== undefined ? { value } : {}), ...(dto.textValue !== undefined ? { textValue: dto.textValue } : {}), ...(dto.unit !== undefined ? { unit: dto.unit } : {}), ...(dto.classification !== undefined ? { classification: dto.classification } : {}), ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}), ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}), ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}), ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}), ...(dto.validFrom !== undefined ? { validFrom } : {}), ...(dto.validUntil !== undefined ? { validUntil } : {}), ...(dto.impact !== undefined ? { impact: dto.impact } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}), updatedById: actor.userId } }))
  }

  async deleteAssumption(projectId: string, assumptionId: string, actor: AuditActor) { return this.deleteFoundation(projectId, assumptionId, actor, 'FeasibilityAssumption', (profileId) => this.prisma.feasibilityAssumption.findFirst({ where: { id: assumptionId, feasibilityProfileId: profileId }, select: { id: true } }), (tx) => tx.feasibilityAssumption.delete({ where: { id: assumptionId } })) }

  async addArea(projectId: string, dto: CreateFeasibilityAreaDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertSource(profile.id, dto.sourceId)
    return this.mutateChild(profile.id, actor, 'FeasibilityAreaLine', (tx) => tx.feasibilityAreaLine.create({
      data: { feasibilityProfileId: profile.id, areaType: dto.areaType, label: dto.label, valueSqm: decimal(dto.valueSqm)!, classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), notes: dto.notes, createdById: actor.userId, updatedById: actor.userId },
    }))
  }

  async updateArea(projectId: string, areaId: string, dto: UpdateFeasibilityAreaDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.feasibilityAreaLine.findFirst({ where: { id: areaId, feasibilityProfileId: profile.id } })
    if (!before) throw DomainError.notFound('FEASIBILITY_AREA_NOT_FOUND', 'שורת השטח אינה שייכת לפרויקט')
    if (dto.sourceId !== undefined) await this.assertSource(profile.id, dto.sourceId)
    return this.updateFoundation(profile.id, actor, 'FeasibilityAreaLine', before, (tx) => tx.feasibilityAreaLine.update({ where: { id: before.id }, data: { ...(dto.areaType !== undefined ? { areaType: dto.areaType } : {}), ...(dto.label !== undefined ? { label: dto.label } : {}), ...(dto.valueSqm !== undefined ? { valueSqm: decimal(dto.valueSqm)! } : {}), ...(dto.classification !== undefined ? { classification: dto.classification } : {}), ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}), ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}), ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}), ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}), updatedById: actor.userId } }))
  }

  async deleteArea(projectId: string, areaId: string, actor: AuditActor) { return this.deleteFoundation(projectId, areaId, actor, 'FeasibilityAreaLine', (profileId) => this.prisma.feasibilityAreaLine.findFirst({ where: { id: areaId, feasibilityProfileId: profileId }, select: { id: true } }), (tx) => tx.feasibilityAreaLine.delete({ where: { id: areaId } })) }

  async addPlanningRight(projectId: string, dto: CreatePlanningRightDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertSource(profile.id, dto.sourceId)
    return this.mutateChild(profile.id, actor, 'PlanningRight', (tx) => tx.planningRight.create({
      data: { feasibilityProfileId: profile.id, category: dto.category, status: dto.status, areaSqm: decimal(dto.areaSqm), unitCount: dto.unitCount, floorLimit: dto.floorLimit, heightMeters: decimal(dto.heightMeters), planNumber: dto.planNumber, landUse: dto.landUse, classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), notes: dto.notes, createdById: actor.userId, updatedById: actor.userId },
    }))
  }

  async updatePlanningRight(projectId: string, rightId: string, dto: UpdatePlanningRightDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.planningRight.findFirst({ where: { id: rightId, feasibilityProfileId: profile.id } })
    if (!before) throw DomainError.notFound('FEASIBILITY_RIGHT_NOT_FOUND', 'זכות התכנון אינה שייכת לפרויקט')
    if (dto.sourceId !== undefined) await this.assertSource(profile.id, dto.sourceId)
    return this.updateFoundation(profile.id, actor, 'PlanningRight', before, (tx) => tx.planningRight.update({ where: { id: before.id }, data: { ...(dto.category !== undefined ? { category: dto.category } : {}), ...(dto.status !== undefined ? { status: dto.status } : {}), ...(dto.areaSqm !== undefined ? { areaSqm: decimal(dto.areaSqm) } : {}), ...(dto.unitCount !== undefined ? { unitCount: dto.unitCount } : {}), ...(dto.floorLimit !== undefined ? { floorLimit: dto.floorLimit } : {}), ...(dto.heightMeters !== undefined ? { heightMeters: decimal(dto.heightMeters) } : {}), ...(dto.planNumber !== undefined ? { planNumber: dto.planNumber } : {}), ...(dto.landUse !== undefined ? { landUse: dto.landUse } : {}), ...(dto.classification !== undefined ? { classification: dto.classification } : {}), ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}), ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}), ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}), ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}), updatedById: actor.userId } }))
  }

  async deletePlanningRight(projectId: string, rightId: string, actor: AuditActor) { return this.deleteFoundation(projectId, rightId, actor, 'PlanningRight', (profileId) => this.prisma.planningRight.findFirst({ where: { id: rightId, feasibilityProfileId: profileId }, select: { id: true } }), (tx) => tx.planningRight.delete({ where: { id: rightId } })) }

  async addScenario(projectId: string, dto: CreateFeasibilityScenarioDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    return this.prisma.$transaction(async (tx) => {
      // A profile must always have a usable baseline. The first scenario becomes
      // one unless the caller explicitly creates a later baseline.
      const existingCount = await tx.feasibilityScenario.count({ where: { feasibilityProfileId: profile.id } })
      const isBaseline = dto.isBaseline ?? existingCount === 0
      if (isBaseline) await tx.feasibilityScenario.updateMany({ where: { feasibilityProfileId: profile.id, isBaseline: true }, data: { isBaseline: false } })
      const row = await tx.feasibilityScenario.create({
        data: { feasibilityProfileId: profile.id, tenantId: actor.tenantId, name: dto.name, kind: dto.kind, description: dto.description, probability: decimal(dto.probability), isBaseline, createdById: actor.userId, updatedById: actor.userId },
      })
      await this.audit.record(actor, { action: 'CREATE', entity: 'FeasibilityScenario', entityId: row.id, metadata: { feasibilityProfileId: profile.id, kind: row.kind } }, tx)
      return row
    })
  }

  async duplicateScenario(projectId: string, scenarioId: string, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.feasibilityScenario.findFirst({ where: { id: scenarioId, feasibilityProfileId: profile.id, tenantId: actor.tenantId }, include: { unitMix: true } })
      if (!source) throw DomainError.notFound('FEASIBILITY_SCENARIO_NOT_FOUND', 'התרחיש לא נמצא בפרויקט')
      const name = await this.nextCopyName(tx, profile.id, source.name)
      const copy = await tx.feasibilityScenario.create({ data: { feasibilityProfileId: profile.id, tenantId: actor.tenantId, name, kind: 'CUSTOM', description: source.description, probability: source.probability, createdById: actor.userId, updatedById: actor.userId } })
      if (source.unitMix.length) await tx.feasibilityUnitMixLine.createMany({ data: source.unitMix.map((line) => ({ scenarioId: copy.id, label: line.label, rooms: line.rooms, unitCount: line.unitCount, netAreaSqm: line.netAreaSqm, grossAreaSqm: line.grossAreaSqm, saleableAreaSqm: line.saleableAreaSqm, balconyAreaSqm: line.balconyAreaSqm, storageAreaSqm: line.storageAreaSqm, parkingSpaces: line.parkingSpaces, floorFrom: line.floorFrom, floorTo: line.floorTo, orientation: line.orientation, pricePerSqm: line.pricePerSqm, fixedUnitPrice: line.fixedUnitPrice, balconyPricePerSqm: line.balconyPricePerSqm, parkingPrice: line.parkingPrice, storagePricePerSqm: line.storagePricePerSqm, adjustmentFactor: line.adjustmentFactor, classification: line.classification, confidence: line.confidence, isVerified: line.isVerified, sourceId: line.sourceId, sourceDate: line.sourceDate, notes: line.notes, createdById: actor.userId, updatedById: actor.userId })) })
      await this.audit.record(actor, { action: 'CREATE', entity: 'FeasibilityScenario', entityId: copy.id, metadata: { copiedFromId: source.id, feasibilityProfileId: profile.id } }, tx)
      return copy
    })
  }

  async addUnitMixLine(projectId: string, scenarioId: string, dto: CreateUnitMixLineDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    if (dto.floorFrom !== undefined && dto.floorTo !== undefined && dto.floorTo < dto.floorFrom) throw DomainError.validation('FEASIBILITY_UNIT_MIX_FLOOR_RANGE', 'קומת סיום אינה יכולה להיות לפני קומת התחלה')
    await this.assertSource(profile.id, dto.sourceId)
    const scenario = await this.prisma.feasibilityScenario.findFirst({ where: { id: scenarioId, tenantId: actor.tenantId, feasibilityProfileId: profile.id }, select: { id: true } })
    if (!scenario) throw DomainError.notFound('FEASIBILITY_SCENARIO_NOT_FOUND', 'התרחיש לא נמצא בפרויקט')
    return this.mutateChild(profile.id, actor, 'FeasibilityUnitMixLine', (tx) => tx.feasibilityUnitMixLine.create({ data: { scenarioId, label: dto.label, unitCount: dto.unitCount, rooms: decimal(dto.rooms), netAreaSqm: decimal(dto.netAreaSqm), grossAreaSqm: decimal(dto.grossAreaSqm), saleableAreaSqm: decimal(dto.saleableAreaSqm), balconyAreaSqm: decimal(dto.balconyAreaSqm), storageAreaSqm: decimal(dto.storageAreaSqm), parkingSpaces: dto.parkingSpaces, floorFrom: dto.floorFrom, floorTo: dto.floorTo, orientation: dto.orientation, pricePerSqm: decimal(dto.pricePerSqm), fixedUnitPrice: decimal(dto.fixedUnitPrice), balconyPricePerSqm: decimal(dto.balconyPricePerSqm), parkingPrice: decimal(dto.parkingPrice), storagePricePerSqm: decimal(dto.storagePricePerSqm), adjustmentFactor: decimal(dto.adjustmentFactor), classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), notes: dto.notes, createdById: actor.userId, updatedById: actor.userId } }))
  }

  async updateUnitMixLine(projectId: string, scenarioId: string, lineId: string, dto: UpdateUnitMixLineDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.feasibilityUnitMixLine.findFirst({ where: { id: lineId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } } })
    if (!before) throw DomainError.notFound('FEASIBILITY_UNIT_MIX_LINE_NOT_FOUND', 'שורת תמהיל הדירות אינה שייכת לתרחיש או לפרויקט')
    if (dto.floorFrom !== undefined && dto.floorTo !== undefined && dto.floorTo < dto.floorFrom) throw DomainError.validation('FEASIBILITY_UNIT_MIX_FLOOR_RANGE', 'קומת סיום אינה יכולה להיות לפני קומת התחלה')
    if (dto.sourceId !== undefined) await this.assertSource(profile.id, dto.sourceId)
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.feasibilityUnitMixLine.update({
        where: { id: before.id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label } : {}), ...(dto.unitCount !== undefined ? { unitCount: dto.unitCount } : {}), ...(dto.rooms !== undefined ? { rooms: decimal(dto.rooms) } : {}),
          ...(dto.netAreaSqm !== undefined ? { netAreaSqm: decimal(dto.netAreaSqm) } : {}), ...(dto.grossAreaSqm !== undefined ? { grossAreaSqm: decimal(dto.grossAreaSqm) } : {}), ...(dto.saleableAreaSqm !== undefined ? { saleableAreaSqm: decimal(dto.saleableAreaSqm) } : {}),
          ...(dto.balconyAreaSqm !== undefined ? { balconyAreaSqm: decimal(dto.balconyAreaSqm) } : {}), ...(dto.storageAreaSqm !== undefined ? { storageAreaSqm: decimal(dto.storageAreaSqm) } : {}), ...(dto.parkingSpaces !== undefined ? { parkingSpaces: dto.parkingSpaces } : {}),
          ...(dto.floorFrom !== undefined ? { floorFrom: dto.floorFrom } : {}), ...(dto.floorTo !== undefined ? { floorTo: dto.floorTo } : {}), ...(dto.orientation !== undefined ? { orientation: dto.orientation } : {}), ...(dto.pricePerSqm !== undefined ? { pricePerSqm: decimal(dto.pricePerSqm) } : {}), ...(dto.fixedUnitPrice !== undefined ? { fixedUnitPrice: decimal(dto.fixedUnitPrice) } : {}),
          ...(dto.balconyPricePerSqm !== undefined ? { balconyPricePerSqm: decimal(dto.balconyPricePerSqm) } : {}), ...(dto.parkingPrice !== undefined ? { parkingPrice: decimal(dto.parkingPrice) } : {}), ...(dto.storagePricePerSqm !== undefined ? { storagePricePerSqm: decimal(dto.storagePricePerSqm) } : {}), ...(dto.adjustmentFactor !== undefined ? { adjustmentFactor: decimal(dto.adjustmentFactor) } : {}),
          ...(dto.classification !== undefined ? { classification: dto.classification } : {}), ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}), ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}), ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}), ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}), updatedById: actor.userId,
        },
      })
      await this.audit.record(actor, { action: 'UPDATE', entity: 'FeasibilityUnitMixLine', entityId: row.id, changes: { before: { label: before.label, unitCount: before.unitCount }, after: { label: row.label, unitCount: row.unitCount } }, metadata: { feasibilityProfileId: profile.id, scenarioId } }, tx)
      return row
    })
  }

  async deleteUnitMixLine(projectId: string, scenarioId: string, lineId: string, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const line = await this.prisma.feasibilityUnitMixLine.findFirst({ where: { id: lineId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } }, select: { id: true, label: true } })
    if (!line) throw DomainError.notFound('FEASIBILITY_UNIT_MIX_LINE_NOT_FOUND', 'שורת תמהיל הדירות אינה שייכת לתרחיש או לפרויקט')
    return this.prisma.$transaction(async (tx) => {
      await tx.feasibilityUnitMixLine.delete({ where: { id: line.id } })
      await this.audit.record(actor, { action: 'DELETE', entity: 'FeasibilityUnitMixLine', entityId: line.id, metadata: { feasibilityProfileId: profile.id, scenarioId, label: line.label } }, tx)
      return { id: line.id, deleted: true }
    })
  }

  async addRevenueLine(projectId: string, scenarioId: string, dto: CreateFeasibilityRevenueLineDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertScenario(profile.id, scenarioId, actor.tenantId)
    await this.assertSource(profile.id, dto.sourceId)
    this.assertRevenueBasis(dto)
    this.assertPreVatLine(dto.vatTreatment)
    return this.mutateChild(profile.id, actor, 'FeasibilityRevenueLine', (tx) => tx.feasibilityRevenueLine.create({
      data: { scenarioId, category: dto.category, label: dto.label, quantity: decimal(dto.quantity), unit: dto.unit, saleableAreaSqm: decimal(dto.saleableAreaSqm), pricePerSqm: decimal(dto.pricePerSqm), fixedUnitPrice: decimal(dto.fixedUnitPrice), annualNoi: decimal(dto.annualNoi), capitalizationRate: decimal(dto.capitalizationRate), vatTreatment: dto.vatTreatment, vatRate: decimal(dto.vatRate), classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), notes: dto.notes, createdById: actor.userId, updatedById: actor.userId },
    }))
  }

  async addCostLine(projectId: string, scenarioId: string, dto: CreateFeasibilityCostLineDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertScenario(profile.id, scenarioId, actor.tenantId)
    await this.assertSource(profile.id, dto.sourceId)
    this.assertCostBasis(dto)
    this.assertPreVatLine(dto.vatTreatment)
    return this.mutateChild(profile.id, actor, 'FeasibilityCostLine', (tx) => tx.feasibilityCostLine.create({
      data: { scenarioId, category: dto.category, label: dto.label, quantity: decimal(dto.quantity), unit: dto.unit, unitCost: decimal(dto.unitCost), fixedAmount: decimal(dto.fixedAmount), percentage: decimal(dto.percentage), percentageBase: dto.percentageBase, vatTreatment: dto.vatTreatment, vatRate: decimal(dto.vatRate), escalationRate: decimal(dto.escalationRate), contingencyRate: decimal(dto.contingencyRate), classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), notes: dto.notes, createdById: actor.userId, updatedById: actor.userId },
    }))
  }

  async updateRevenueLine(projectId: string, scenarioId: string, lineId: string, dto: UpdateFeasibilityRevenueLineDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.feasibilityRevenueLine.findFirst({ where: { id: lineId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } } })
    if (!before) throw DomainError.notFound('FEASIBILITY_REVENUE_LINE_NOT_FOUND', 'שורת ההכנסה אינה שייכת לתרחיש או לפרויקט')
    if (dto.sourceId !== undefined) await this.assertSource(profile.id, dto.sourceId)
    const merged: Pick<CreateFeasibilityRevenueLineDto, 'saleableAreaSqm' | 'pricePerSqm' | 'quantity' | 'fixedUnitPrice' | 'annualNoi' | 'capitalizationRate' | 'vatTreatment'> = {
      saleableAreaSqm: dto.saleableAreaSqm ?? existingDecimal(before.saleableAreaSqm),
      pricePerSqm: dto.pricePerSqm ?? existingDecimal(before.pricePerSqm),
      quantity: dto.quantity ?? existingDecimal(before.quantity),
      fixedUnitPrice: dto.fixedUnitPrice ?? existingDecimal(before.fixedUnitPrice),
      annualNoi: dto.annualNoi ?? existingDecimal(before.annualNoi),
      capitalizationRate: dto.capitalizationRate ?? existingDecimal(before.capitalizationRate),
      vatTreatment: dto.vatTreatment ?? before.vatTreatment,
    }
    this.assertRevenueBasis(merged as CreateFeasibilityRevenueLineDto)
    this.assertPreVatLine(merged.vatTreatment)
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.feasibilityRevenueLine.update({
        where: { id: before.id },
        data: {
          ...(dto.category !== undefined ? { category: dto.category } : {}), ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.quantity !== undefined ? { quantity: decimal(dto.quantity) } : {}), ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
          ...(dto.saleableAreaSqm !== undefined ? { saleableAreaSqm: decimal(dto.saleableAreaSqm) } : {}), ...(dto.pricePerSqm !== undefined ? { pricePerSqm: decimal(dto.pricePerSqm) } : {}),
          ...(dto.fixedUnitPrice !== undefined ? { fixedUnitPrice: decimal(dto.fixedUnitPrice) } : {}), ...(dto.annualNoi !== undefined ? { annualNoi: decimal(dto.annualNoi) } : {}), ...(dto.capitalizationRate !== undefined ? { capitalizationRate: decimal(dto.capitalizationRate) } : {}),
          ...(dto.vatTreatment !== undefined ? { vatTreatment: dto.vatTreatment } : {}), ...(dto.vatRate !== undefined ? { vatRate: decimal(dto.vatRate) } : {}),
          ...(dto.classification !== undefined ? { classification: dto.classification } : {}), ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}), ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}),
          ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}), ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}), updatedById: actor.userId,
        },
      })
      await this.audit.record(actor, { action: 'UPDATE', entity: 'FeasibilityRevenueLine', entityId: row.id, changes: { before: { label: before.label }, after: { label: row.label } }, metadata: { feasibilityProfileId: profile.id, scenarioId } }, tx)
      return row
    })
  }

  async updateCostLine(projectId: string, scenarioId: string, lineId: string, dto: UpdateFeasibilityCostLineDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.feasibilityCostLine.findFirst({ where: { id: lineId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } } })
    if (!before) throw DomainError.notFound('FEASIBILITY_COST_LINE_NOT_FOUND', 'שורת העלות אינה שייכת לתרחיש או לפרויקט')
    if (dto.sourceId !== undefined) await this.assertSource(profile.id, dto.sourceId)
    const merged: Pick<CreateFeasibilityCostLineDto, 'quantity' | 'unitCost' | 'fixedAmount' | 'percentage' | 'percentageBase' | 'vatTreatment'> = {
      quantity: dto.quantity ?? existingDecimal(before.quantity),
      unitCost: dto.unitCost ?? existingDecimal(before.unitCost),
      fixedAmount: dto.fixedAmount ?? existingDecimal(before.fixedAmount),
      percentage: dto.percentage ?? existingDecimal(before.percentage),
      percentageBase: dto.percentageBase ?? before.percentageBase ?? undefined,
      vatTreatment: dto.vatTreatment ?? before.vatTreatment,
    }
    this.assertCostBasis(merged as CreateFeasibilityCostLineDto)
    this.assertPreVatLine(merged.vatTreatment)
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.feasibilityCostLine.update({
        where: { id: before.id },
        data: {
          ...(dto.category !== undefined ? { category: dto.category } : {}), ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.quantity !== undefined ? { quantity: decimal(dto.quantity) } : {}), ...(dto.unit !== undefined ? { unit: dto.unit } : {}), ...(dto.unitCost !== undefined ? { unitCost: decimal(dto.unitCost) } : {}), ...(dto.fixedAmount !== undefined ? { fixedAmount: decimal(dto.fixedAmount) } : {}),
          ...(dto.percentage !== undefined ? { percentage: decimal(dto.percentage) } : {}), ...(dto.percentageBase !== undefined ? { percentageBase: dto.percentageBase } : {}),
          ...(dto.vatTreatment !== undefined ? { vatTreatment: dto.vatTreatment } : {}), ...(dto.vatRate !== undefined ? { vatRate: decimal(dto.vatRate) } : {}), ...(dto.escalationRate !== undefined ? { escalationRate: decimal(dto.escalationRate) } : {}), ...(dto.contingencyRate !== undefined ? { contingencyRate: decimal(dto.contingencyRate) } : {}),
          ...(dto.classification !== undefined ? { classification: dto.classification } : {}), ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}), ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}), ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}), ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}), updatedById: actor.userId,
        },
      })
      await this.audit.record(actor, { action: 'UPDATE', entity: 'FeasibilityCostLine', entityId: row.id, changes: { before: { label: before.label }, after: { label: row.label } }, metadata: { feasibilityProfileId: profile.id, scenarioId } }, tx)
      return row
    })
  }

  async deleteRevenueLine(projectId: string, scenarioId: string, lineId: string, actor: AuditActor) {
    return this.deleteScenarioLine(projectId, scenarioId, lineId, actor, 'REVENUE')
  }

  async deleteCostLine(projectId: string, scenarioId: string, lineId: string, actor: AuditActor) {
    return this.deleteScenarioLine(projectId, scenarioId, lineId, actor, 'COST')
  }

  async upsertFinancing(projectId: string, scenarioId: string, dto: UpsertFeasibilityFinancingDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertScenario(profile.id, scenarioId, actor.tenantId)
    await this.assertSource(profile.id, dto.sourceId)
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.feasibilityFinancingAssumption.findUnique({ where: { scenarioId } })
      const row = await tx.feasibilityFinancingAssumption.upsert({
        where: { scenarioId },
        create: { scenarioId, debtAmount: decimal(dto.debtAmount), equityAmount: decimal(dto.equityAmount), ltc: decimal(dto.ltc), ltv: decimal(dto.ltv), annualInterestRate: decimal(dto.annualInterestRate), arrangementFeeRate: decimal(dto.arrangementFeeRate), guaranteeFeeRate: decimal(dto.guaranteeFeeRate), graceMonths: dto.graceMonths, financingMonths: dto.financingMonths, classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), notes: dto.notes, createdById: actor.userId, updatedById: actor.userId },
        update: { debtAmount: decimal(dto.debtAmount), equityAmount: decimal(dto.equityAmount), ltc: decimal(dto.ltc), ltv: decimal(dto.ltv), annualInterestRate: decimal(dto.annualInterestRate), arrangementFeeRate: decimal(dto.arrangementFeeRate), guaranteeFeeRate: decimal(dto.guaranteeFeeRate), graceMonths: dto.graceMonths, financingMonths: dto.financingMonths, classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), notes: dto.notes, updatedById: actor.userId },
      })
      await this.audit.record(actor, { action: before ? 'UPDATE' : 'CREATE', entity: 'FeasibilityFinancingAssumption', entityId: row.id, metadata: { feasibilityProfileId: profile.id, scenarioId } }, tx)
      return row
    })
  }

  async addTimelinePhase(projectId: string, scenarioId: string, dto: CreateFeasibilityTimelinePhaseDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertScenario(profile.id, scenarioId, actor.tenantId)
    await this.assertSource(profile.id, dto.sourceId)
    if (dto.startDate && dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) throw DomainError.validation('FEASIBILITY_TIMELINE_DATE_RANGE', 'תאריך סיום אינו יכול להיות לפני תאריך התחלה')
    if (dto.dependencyPhaseId) {
      const dependency = await this.prisma.feasibilityTimelinePhase.findFirst({ where: { id: dto.dependencyPhaseId, scenarioId }, select: { id: true } })
      if (!dependency) throw DomainError.notFound('FEASIBILITY_TIMELINE_DEPENDENCY_NOT_FOUND', 'שלב התלות אינו שייך לתרחיש')
    }
    return this.mutateChild(profile.id, actor, 'FeasibilityTimelinePhase', (tx) => tx.feasibilityTimelinePhase.create({
      data: { scenarioId, kind: dto.kind, label: dto.label, startDate: date(dto.startDate), endDate: date(dto.endDate), durationMonths: dto.durationMonths, dependencyPhaseId: dto.dependencyPhaseId, classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), notes: dto.notes, createdById: actor.userId, updatedById: actor.userId },
    }))
  }

  async deleteTimelinePhase(projectId: string, scenarioId: string, phaseId: string, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const phase = await this.prisma.feasibilityTimelinePhase.findFirst({ where: { id: phaseId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } }, select: { id: true } })
    if (!phase) throw DomainError.notFound('FEASIBILITY_TIMELINE_PHASE_NOT_FOUND', 'שלב לוח הזמנים אינו שייך לתרחיש')
    const dependents = await this.prisma.feasibilityTimelinePhase.count({ where: { scenarioId, dependencyPhaseId: phase.id } })
    if (dependents) throw DomainError.conflict('FEASIBILITY_TIMELINE_PHASE_IN_USE', 'לא ניתן למחוק שלב שעליו תלויים שלבים אחרים')
    return this.prisma.$transaction(async (tx) => { await tx.feasibilityTimelinePhase.delete({ where: { id: phase.id } }); await this.audit.record(actor, { action: 'DELETE', entity: 'FeasibilityTimelinePhase', entityId: phase.id, metadata: { feasibilityProfileId: profile.id, scenarioId } }, tx); return { id: phase.id, deleted: true } })
  }

  async addCashFlowAllocation(projectId: string, scenarioId: string, dto: CreateFeasibilityCashFlowAllocationDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertScenario(profile.id, scenarioId, actor.tenantId)
    await this.assertSource(profile.id, dto.sourceId)
    const periodStart = new Date(dto.periodStart)
    if (periodStart.getUTCDate() !== 1) throw DomainError.validation('FEASIBILITY_CASH_FLOW_MONTH_START_REQUIRED', 'תזרים חודשי חייב להתחיל ביום הראשון של החודש')
    if (dto.sourceKind === 'REVENUE') {
      if (dto.direction !== 'INFLOW' || !dto.sourceLineId) throw DomainError.validation('FEASIBILITY_CASH_FLOW_REVENUE_LINK_REQUIRED', 'הכנסה חייבת להיות תזרים נכנס המקושר לשורת הכנסה')
      const [revenue, unitMix] = await Promise.all([
        this.prisma.feasibilityRevenueLine.findFirst({ where: { id: dto.sourceLineId, scenarioId }, select: { id: true } }),
        this.prisma.feasibilityUnitMixLine.findFirst({ where: { id: dto.sourceLineId, scenarioId }, select: { id: true } }),
      ])
      if (!revenue && !unitMix) throw DomainError.notFound('FEASIBILITY_CASH_FLOW_REVENUE_NOT_FOUND', 'שורת ההכנסה אינה שייכת לתרחיש')
    }
    if (dto.sourceKind === 'COST') {
      if (dto.direction !== 'OUTFLOW' || !dto.sourceLineId) throw DomainError.validation('FEASIBILITY_CASH_FLOW_COST_LINK_REQUIRED', 'עלות חייבת להיות תזרים יוצא המקושר לשורת עלות')
      const cost = await this.prisma.feasibilityCostLine.findFirst({ where: { id: dto.sourceLineId, scenarioId }, select: { id: true } })
      if (!cost) throw DomainError.notFound('FEASIBILITY_CASH_FLOW_COST_NOT_FOUND', 'שורת העלות אינה שייכת לתרחיש')
    }
    if (dto.sourceKind === 'COMPENSATION') {
      if (dto.direction !== 'OUTFLOW' || !dto.sourceLineId) throw DomainError.validation('FEASIBILITY_CASH_FLOW_COMPENSATION_LINK_REQUIRED', 'תמורה חייבת להיות תזרים יוצא המקושר לשורת תמורה')
      const compensation = await this.prisma.feasibilityCompensationLine.findFirst({ where: { id: dto.sourceLineId, scenarioId }, select: { id: true } })
      if (!compensation) throw DomainError.notFound('FEASIBILITY_CASH_FLOW_COMPENSATION_NOT_FOUND', 'שורת התמורה אינה שייכת לתרחיש')
    }
    if (dto.sourceKind === 'EQUITY' && dto.sourceLineId) throw DomainError.validation('FEASIBILITY_CASH_FLOW_EQUITY_INVALID', 'השקעת הון או חלוקת הון אינן מקושרות לשורת הכנסה או עלות')
    if (dto.sourceKind === 'DEBT' && dto.sourceLineId) throw DomainError.validation('FEASIBILITY_CASH_FLOW_DEBT_INVALID', 'משיכת חוב או החזר חוב אינם מקושרים לשורת הכנסה או עלות')
    return this.mutateChild(profile.id, actor, 'FeasibilityCashFlowAllocation', (tx) => tx.feasibilityCashFlowAllocation.create({
      data: { scenarioId, periodStart, direction: dto.direction, sourceKind: dto.sourceKind, sourceLineId: dto.sourceLineId, label: dto.label, amount: decimal(dto.amount)!, classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), notes: dto.notes, createdById: actor.userId, updatedById: actor.userId },
    }))
  }

  async deleteCashFlowAllocation(projectId: string, scenarioId: string, allocationId: string, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const allocation = await this.prisma.feasibilityCashFlowAllocation.findFirst({ where: { id: allocationId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } }, select: { id: true } })
    if (!allocation) throw DomainError.notFound('FEASIBILITY_CASH_FLOW_NOT_FOUND', 'הקצאת התזרים אינה שייכת לתרחיש')
    return this.prisma.$transaction(async (tx) => { await tx.feasibilityCashFlowAllocation.delete({ where: { id: allocation.id } }); await this.audit.record(actor, { action: 'DELETE', entity: 'FeasibilityCashFlowAllocation', entityId: allocation.id, metadata: { feasibilityProfileId: profile.id, scenarioId } }, tx); return { id: allocation.id, deleted: true } })
  }

  /** Source and direction are immutable after creation: changing either can
   * turn a linked sale into a cost or bypass the linkage rules. */
  async updateCashFlowAllocation(projectId: string, scenarioId: string, allocationId: string, dto: UpdateFeasibilityCashFlowAllocationDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.feasibilityCashFlowAllocation.findFirst({ where: { id: allocationId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } } })
    if (!before) throw DomainError.notFound('FEASIBILITY_CASH_FLOW_NOT_FOUND', 'הקצאת התזרים אינה שייכת לתרחיש')
    const periodStart = dto.periodStart === undefined ? before.periodStart : new Date(dto.periodStart)
    if (periodStart.getUTCDate() !== 1) throw DomainError.validation('FEASIBILITY_CASH_FLOW_MONTH_START_REQUIRED', 'תזרים חודשי חייב להתחיל ביום הראשון של החודש')
    return this.updateFoundation(profile.id, actor, 'FeasibilityCashFlowAllocation', before, (tx) => tx.feasibilityCashFlowAllocation.update({ where: { id: before.id }, data: { ...(dto.periodStart !== undefined ? { periodStart } : {}), ...(dto.label !== undefined ? { label: dto.label } : {}), ...(dto.amount !== undefined ? { amount: decimal(dto.amount)! } : {}), ...(dto.classification !== undefined ? { classification: dto.classification } : {}), ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}), ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}), ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}), ...(dto.notes !== undefined ? { notes: dto.notes } : {}), updatedById: actor.userId } }))
  }

  async addCompensationLine(projectId: string, scenarioId: string, dto: CreateFeasibilityCompensationLineDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    await this.assertScenario(profile.id, scenarioId, actor.tenantId)
    await this.assertSource(profile.id, dto.sourceId)
    const holding = await this.prisma.ownerApartment.findFirst({
      where: {
        id: dto.ownerApartmentId,
        owner: { tenantId: actor.tenantId },
        apartment: { building: { complex: { projectId } } },
      },
      select: { id: true },
    })
    if (!holding) throw DomainError.notFound('FEASIBILITY_OWNER_APARTMENT_NOT_FOUND', 'הבעלות אינה שייכת לפרויקט או ל‑tenant')
    return this.mutateChild(profile.id, actor, 'FeasibilityCompensationLine', (tx) => tx.feasibilityCompensationLine.create({
      data: { scenarioId, ownerApartmentId: holding.id, status: dto.status, replacementAreaSqm: decimal(dto.replacementAreaSqm), additionalAreaSqm: decimal(dto.additionalAreaSqm), balconyAreaSqm: decimal(dto.balconyAreaSqm), parkingSpaces: dto.parkingSpaces, storageAreaSqm: decimal(dto.storageAreaSqm), newFloor: dto.newFloor, replacementValue: decimal(dto.replacementValue), parkingValue: decimal(dto.parkingValue), storageValue: decimal(dto.storageValue), balconyValue: decimal(dto.balconyValue), cashCompensation: decimal(dto.cashCompensation), monthlyRelocationRent: decimal(dto.monthlyRelocationRent), relocationMonths: dto.relocationMonths, movingCost: decimal(dto.movingCost), temporaryHousingCost: decimal(dto.temporaryHousingCost), legalCost: decimal(dto.legalCost), inspectionCost: decimal(dto.inspectionCost), otherCost: decimal(dto.otherCost), classification: dto.classification, confidence: dto.confidence, isVerified: dto.isVerified, sourceId: dto.sourceId, sourceDate: date(dto.sourceDate), notes: dto.notes, createdById: actor.userId, updatedById: actor.userId },
    }))
  }

  async deleteCompensationLine(projectId: string, scenarioId: string, lineId: string, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const line = await this.prisma.feasibilityCompensationLine.findFirst({ where: { id: lineId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } }, select: { id: true } })
    if (!line) throw DomainError.notFound('FEASIBILITY_COMPENSATION_NOT_FOUND', 'שורת התמורה אינה שייכת לתרחיש')
    const allocations = await this.prisma.feasibilityCashFlowAllocation.count({ where: { scenarioId, sourceKind: 'COMPENSATION', sourceLineId: line.id } })
    if (allocations) throw DomainError.conflict('FEASIBILITY_COMPENSATION_HAS_CASH_FLOW', 'לא ניתן למחוק תמורה המקושרת לתזרים. מחקו או עדכנו קודם את הקצאת התזרים.')
    return this.prisma.$transaction(async (tx) => { await tx.feasibilityCompensationLine.delete({ where: { id: line.id } }); await this.audit.record(actor, { action: 'DELETE', entity: 'FeasibilityCompensationLine', entityId: line.id, metadata: { feasibilityProfileId: profile.id, scenarioId } }, tx); return { id: line.id, deleted: true } })
  }

  async updateCompensationLine(projectId: string, scenarioId: string, lineId: string, dto: UpdateFeasibilityCompensationLineDto, actor: AuditActor) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await this.prisma.feasibilityCompensationLine.findFirst({ where: { id: lineId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } } })
    if (!before) throw DomainError.notFound('FEASIBILITY_COMPENSATION_NOT_FOUND', 'שורת התמורה אינה שייכת לתרחיש')
    if (dto.sourceId !== undefined) await this.assertSource(profile.id, dto.sourceId)
    return this.updateFoundation(profile.id, actor, 'FeasibilityCompensationLine', before, (tx) => tx.feasibilityCompensationLine.update({ where: { id: before.id }, data: {
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.replacementAreaSqm !== undefined ? { replacementAreaSqm: decimal(dto.replacementAreaSqm) } : {}),
      ...(dto.additionalAreaSqm !== undefined ? { additionalAreaSqm: decimal(dto.additionalAreaSqm) } : {}),
      ...(dto.balconyAreaSqm !== undefined ? { balconyAreaSqm: decimal(dto.balconyAreaSqm) } : {}),
      ...(dto.parkingSpaces !== undefined ? { parkingSpaces: dto.parkingSpaces } : {}),
      ...(dto.storageAreaSqm !== undefined ? { storageAreaSqm: decimal(dto.storageAreaSqm) } : {}),
      ...(dto.newFloor !== undefined ? { newFloor: dto.newFloor } : {}),
      ...(dto.replacementValue !== undefined ? { replacementValue: decimal(dto.replacementValue) } : {}),
      ...(dto.parkingValue !== undefined ? { parkingValue: decimal(dto.parkingValue) } : {}),
      ...(dto.storageValue !== undefined ? { storageValue: decimal(dto.storageValue) } : {}),
      ...(dto.balconyValue !== undefined ? { balconyValue: decimal(dto.balconyValue) } : {}),
      ...(dto.cashCompensation !== undefined ? { cashCompensation: decimal(dto.cashCompensation) } : {}),
      ...(dto.monthlyRelocationRent !== undefined ? { monthlyRelocationRent: decimal(dto.monthlyRelocationRent) } : {}),
      ...(dto.relocationMonths !== undefined ? { relocationMonths: dto.relocationMonths } : {}),
      ...(dto.movingCost !== undefined ? { movingCost: decimal(dto.movingCost) } : {}),
      ...(dto.temporaryHousingCost !== undefined ? { temporaryHousingCost: decimal(dto.temporaryHousingCost) } : {}),
      ...(dto.legalCost !== undefined ? { legalCost: decimal(dto.legalCost) } : {}),
      ...(dto.inspectionCost !== undefined ? { inspectionCost: decimal(dto.inspectionCost) } : {}),
      ...(dto.otherCost !== undefined ? { otherCost: decimal(dto.otherCost) } : {}),
      ...(dto.classification !== undefined ? { classification: dto.classification } : {}),
      ...(dto.confidence !== undefined ? { confidence: dto.confidence } : {}),
      ...(dto.isVerified !== undefined ? { isVerified: dto.isVerified } : {}),
      ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}),
      ...(dto.sourceDate !== undefined ? { sourceDate: date(dto.sourceDate) } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      updatedById: actor.userId,
    } }))
  }

  private async requireProfile(projectId: string, tenantId: string) {
    await this.scope.assertProject(projectId, tenantId)
    const profile = await this.prisma.feasibilityProfile.findFirst({ where: { projectId, tenantId } })
    if (!profile) throw DomainError.notFound('FEASIBILITY_PROFILE_NOT_FOUND', 'לא קיים עדיין פרופיל דוח אפס לפרויקט')
    return profile
  }

  private async updateFoundation<T extends { id: string }>(profileId: string, actor: AuditActor, entity: string, before: T, update: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async (tx) => {
      const row = await update(tx)
      await this.audit.record(actor, { action: 'UPDATE', entity, entityId: row.id, changes: AuditService.diff(before as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>), metadata: { feasibilityProfileId: profileId } }, tx)
      return row
    })
  }

  private async deleteFoundation(projectId: string, entityId: string, actor: AuditActor, entity: string, find: (profileId: string) => Promise<{ id: string } | null>, remove: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    const profile = await this.requireEditableProfile(projectId, actor)
    const before = await find(profile.id)
    if (!before) throw DomainError.notFound('FEASIBILITY_FOUNDATION_ITEM_NOT_FOUND', 'נתון היסוד אינו שייך לפרויקט')
    return this.prisma.$transaction(async (tx) => {
      await remove(tx)
      await this.audit.record(actor, { action: 'DELETE', entity, entityId, metadata: { feasibilityProfileId: profile.id } }, tx)
      return { id: entityId, deleted: true }
    })
  }

  private async deleteScenarioLine(projectId: string, scenarioId: string, lineId: string, actor: AuditActor, kind: 'REVENUE' | 'COST') {
    const profile = await this.requireEditableProfile(projectId, actor)
    const line = kind === 'REVENUE'
      ? await this.prisma.feasibilityRevenueLine.findFirst({ where: { id: lineId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } }, select: { id: true, label: true } })
      : await this.prisma.feasibilityCostLine.findFirst({ where: { id: lineId, scenarioId, scenario: { feasibilityProfileId: profile.id, tenantId: actor.tenantId } }, select: { id: true, label: true } })
    if (!line) throw DomainError.notFound(kind === 'REVENUE' ? 'FEASIBILITY_REVENUE_LINE_NOT_FOUND' : 'FEASIBILITY_COST_LINE_NOT_FOUND', 'שורת המודל אינה שייכת לתרחיש או לפרויקט')
    const allocations = await this.prisma.feasibilityCashFlowAllocation.count({ where: { scenarioId, sourceLineId: line.id, sourceKind: kind } })
    if (allocations) throw DomainError.conflict('FEASIBILITY_LINE_HAS_CASH_FLOW', 'לא ניתן למחוק שורה המקושרת לתזרים. מחקו או העבירו קודם את הקצאות התזרים שלה.')
    return this.prisma.$transaction(async (tx) => {
      if (kind === 'REVENUE') await tx.feasibilityRevenueLine.delete({ where: { id: line.id } })
      else await tx.feasibilityCostLine.delete({ where: { id: line.id } })
      await this.audit.record(actor, { action: 'DELETE', entity: kind === 'REVENUE' ? 'FeasibilityRevenueLine' : 'FeasibilityCostLine', entityId: line.id, metadata: { feasibilityProfileId: profile.id, scenarioId, label: line.label } }, tx)
      return { id: line.id, deleted: true }
    })
  }

  private async requireEditableProfile(projectId: string, actor: AuditActor) {
    const profile = await this.requireProfile(projectId, actor.tenantId)
    if (profile.status === 'LOCKED') throw DomainError.conflict('FEASIBILITY_PROFILE_LOCKED', 'פרופיל נעול אינו ניתן לעריכה')
    return profile
  }

  private async assertSource(profileId: string, sourceId?: string) {
    if (!sourceId) return
    const source = await this.prisma.feasibilitySource.findFirst({ where: { id: sourceId, feasibilityProfileId: profileId }, select: { id: true } })
    if (!source) throw DomainError.notFound('FEASIBILITY_SOURCE_NOT_FOUND', 'מקור אינו שייך לפרופיל דוח האפס')
  }

  private async assertScenario(profileId: string, scenarioId: string, tenantId: string) {
    const scenario = await this.prisma.feasibilityScenario.findFirst({ where: { id: scenarioId, feasibilityProfileId: profileId, tenantId }, select: { id: true } })
    if (!scenario) throw DomainError.notFound('FEASIBILITY_SCENARIO_NOT_FOUND', 'התרחיש לא נמצא בפרויקט')
  }

  private assertRevenueBasis(dto: CreateFeasibilityRevenueLineDto) {
    const areaPricing = dto.saleableAreaSqm !== undefined && dto.pricePerSqm !== undefined
    const unitPricing = dto.quantity !== undefined && dto.fixedUnitPrice !== undefined
    const capitalization = dto.annualNoi !== undefined && dto.capitalizationRate !== undefined
    if ([areaPricing, unitPricing, capitalization].filter(Boolean).length !== 1) throw DomainError.validation('FEASIBILITY_REVENUE_BASIS_REQUIRED', 'להכנסה נדרש בסיס אחד בלבד: שטח ומחיר, כמות ומחיר יחידה, או NOI ושיעור היוון')
    if (capitalization) {
      const noi = decimal(dto.annualNoi)
      const rate = decimal(dto.capitalizationRate)
      if (!noi || noi.lte(0) || !rate || rate.lte(0) || rate.gte(1)) {
        throw DomainError.validation('FEASIBILITY_CAPITALIZATION_INPUT_INVALID', 'NOI שנתי חייב להיות חיובי ושיעור היוון חייב להיות גדול מאפס וקטן מ־1.')
      }
    }
  }

  private assertCostBasis(dto: CreateFeasibilityCostLineDto) {
    const unitPricing = dto.quantity !== undefined && dto.unitCost !== undefined
    const fixed = dto.fixedAmount !== undefined
    const percentage = dto.percentage !== undefined && Boolean(dto.percentageBase)
    if ([unitPricing, fixed, percentage].filter(Boolean).length !== 1) throw DomainError.validation('FEASIBILITY_COST_BASIS_REQUIRED', 'לעלות נדרש בסיס אחד בלבד: כמות ועלות יחידה, סכום קבוע, או אחוז ובסיס חישוב')
  }

  /** The agreed feasibility basis is before VAT. Mixing VAT-inclusive inputs
   * into a pre-VAT model produces plausible but legally misleading totals. */
  private assertPreVatLine(vatTreatment?: string) {
    if (vatTreatment === 'VAT_INCLUDED') {
      throw DomainError.validation('FEASIBILITY_VAT_INCLUDED_NOT_ALLOWED', 'דוח האפס מוגדר לפני מע״מ; הזינו סכום לפני מע״מ או סמנו VAT_NOT_APPLICABLE.')
    }
  }

  private async nextCopyName(tx: Prisma.TransactionClient, feasibilityProfileId: string, sourceName: string) {
    const prefix = `${sourceName} — עותק`
    const copies = await tx.feasibilityScenario.findMany({
      where: { feasibilityProfileId, name: { startsWith: prefix } },
      select: { name: true },
    })
    const taken = new Set(copies.map((row) => row.name))
    if (!taken.has(prefix)) return prefix
    let ordinal = 2
    while (taken.has(`${prefix} ${ordinal}`)) ordinal += 1
    return `${prefix} ${ordinal}`
  }

  private async assertDocument(projectId: string, documentId: string, tenantId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, tenantId, OR: [{ projectId }, { projectId: null }] }, select: { id: true } })
    if (!doc) throw DomainError.notFound('FEASIBILITY_DOCUMENT_NOT_FOUND', 'מסמך המקור לא נמצא בפרויקט או ב‑tenant')
  }

  private async mutateChild<T>(profileId: string, actor: AuditActor, entity: string, create: (tx: Prisma.TransactionClient) => Promise<T & { id: string }>) {
    return this.prisma.$transaction(async (tx) => {
      const row = await create(tx)
      await this.audit.record(actor, { action: 'CREATE', entity, entityId: row.id, metadata: { feasibilityProfileId: profileId } }, tx)
      return row
    })
  }
}
