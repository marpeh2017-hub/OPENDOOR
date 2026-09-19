import { Injectable } from '@nestjs/common'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { DomainError } from '../common/errors/domain-error'
import { PrismaService } from '../prisma.service'
import { FeasibilityService } from './feasibility.service'

@Injectable()
export class FeasibilityReportVersionService {
  constructor(private readonly prisma: PrismaService, private readonly feasibility: FeasibilityService, private readonly audit: AuditService) {}

  async create(projectId: string, snapshotId: string, title: string, actor: AuditActor) {
    const profile = await this.feasibility.find(projectId, actor.tenantId)
    if (!profile) throw DomainError.notFound('FEASIBILITY_PROFILE_NOT_FOUND', 'לא קיים פרופיל דוח אפס לפרויקט')
    const snapshot = await this.prisma.feasibilityCalculationSnapshot.findFirst({ where: { id: snapshotId, tenantId: actor.tenantId, feasibilityProfileId: profile.id } })
    if (!snapshot) throw DomainError.notFound('FEASIBILITY_SNAPSHOT_NOT_FOUND', 'צילום החישוב אינו שייך לפרויקט או ל־tenant')

    // A report version is evidence, not a live dashboard: capture the newest
    // calculation snapshot of every scenario at the moment the version opens.
    // The selected snapshot remains the report's authoritative base scenario.
    const snapshots = await this.prisma.feasibilityCalculationSnapshot.findMany({
      where: { tenantId: actor.tenantId, feasibilityProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, scenarioId: true, engineVersion: true, createdAt: true, outputSnapshot: true, validationSnapshot: true, sensitivitySnapshot: true },
    })
    const newestByScenario = new Map<string, typeof snapshots[number]>()
    for (const item of snapshots) {
      if (!newestByScenario.has(item.scenarioId)) newestByScenario.set(item.scenarioId, item)
    }
    if (!newestByScenario.has(snapshot.scenarioId)) {
      newestByScenario.set(snapshot.scenarioId, {
        id: snapshot.id,
        scenarioId: snapshot.scenarioId,
        engineVersion: snapshot.engineVersion,
        createdAt: snapshot.createdAt,
        outputSnapshot: snapshot.outputSnapshot,
        validationSnapshot: snapshot.validationSnapshot,
        sensitivitySnapshot: snapshot.sensitivitySnapshot,
      })
    }
    const comparisonSnapshot = {
      capturedAt: new Date().toISOString(),
      scenarios: [...newestByScenario.values()].map((item) => ({
        scenarioId: item.scenarioId,
        scenarioName: profile.scenarios.find((scenario) => scenario.id === item.scenarioId)?.name ?? 'תרחיש',
        snapshotId: item.id,
        engineVersion: item.engineVersion,
        calculatedAt: item.createdAt.toISOString(),
        output: item.outputSnapshot,
        validation: item.validationSnapshot,
        sensitivity: item.sensitivitySnapshot,
      })),
    }
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.feasibilityReportVersion.aggregate({ where: { feasibilityProfileId: profile.id }, _max: { version: true } })
      const row = await tx.feasibilityReportVersion.create({
        data: {
          tenantId: actor.tenantId,
          feasibilityProfileId: profile.id,
          snapshotId,
          version: (latest._max.version ?? 0) + 1,
          title,
          comparisonSnapshot,
          createdById: actor.userId,
        },
      })
      await this.audit.record(actor, {
        action: 'CREATE',
        entity: 'FeasibilityReportVersion',
        entityId: row.id,
        metadata: { feasibilityProfileId: profile.id, version: row.version, snapshotId, comparisonScenarioCount: comparisonSnapshot.scenarios.length },
      }, tx)
      return row
    })
  }

  async list(projectId: string, tenantId: string) {
    const profile = await this.feasibility.find(projectId, tenantId)
    if (!profile) throw DomainError.notFound('FEASIBILITY_PROFILE_NOT_FOUND', 'לא קיים פרופיל דוח אפס לפרויקט')
    return this.prisma.feasibilityReportVersion.findMany({
      where: { tenantId, feasibilityProfileId: profile.id },
      orderBy: { version: 'desc' },
      include: { snapshot: { select: { id: true, scenarioId: true, engineVersion: true, createdAt: true } } },
    })
  }

  async find(projectId: string, reportId: string, tenantId: string) {
    const profile = await this.feasibility.find(projectId, tenantId)
    if (!profile) throw DomainError.notFound('FEASIBILITY_PROFILE_NOT_FOUND', 'לא קיים פרופיל דוח אפס לפרויקט')
    const report = await this.prisma.feasibilityReportVersion.findFirst({
      where: { id: reportId, tenantId, feasibilityProfileId: profile.id },
      include: {
        snapshot: {
          select: {
            id: true, scenarioId: true, engineVersion: true, createdAt: true,
            inputSnapshot: true, outputSnapshot: true, validationSnapshot: true, sensitivitySnapshot: true,
          },
        },
      },
    })
    if (!report) throw DomainError.notFound('FEASIBILITY_REPORT_VERSION_NOT_FOUND', 'גרסת הדוח אינה שייכת לפרויקט או ל־tenant')
    return report
  }

  async transition(projectId: string, reportId: string, target: 'REVIEW' | 'APPROVED' | 'LOCKED', actor: AuditActor) {
    const profile = await this.feasibility.find(projectId, actor.tenantId)
    if (!profile) throw DomainError.notFound('FEASIBILITY_PROFILE_NOT_FOUND', 'לא קיים פרופיל דוח אפס לפרויקט')
    const report = await this.prisma.feasibilityReportVersion.findFirst({
      where: { id: reportId, tenantId: actor.tenantId, feasibilityProfileId: profile.id },
      include: { snapshot: { select: { validationSnapshot: true } } },
    })
    if (!report) throw DomainError.notFound('FEASIBILITY_REPORT_VERSION_NOT_FOUND', 'גרסת הדוח אינה שייכת לפרויקט או ל־tenant')
    const allowed: Record<string, string> = { DRAFT: 'REVIEW', REVIEW: 'APPROVED', APPROVED: 'LOCKED' }
    if (allowed[report.status] !== target) throw DomainError.conflict('FEASIBILITY_REPORT_TRANSITION_INVALID', 'מעבר סטטוס דוח אינו תקין')
    if (target === 'APPROVED' || target === 'LOCKED') {
      const validation = Array.isArray(report.snapshot.validationSnapshot) ? report.snapshot.validationSnapshot as Array<{ severity?: string }> : []
      if (validation.some((issue) => issue.severity === 'CRITICAL')) {
        throw DomainError.conflict('FEASIBILITY_REPORT_HAS_CRITICAL_VALIDATION', 'לא ניתן לאשר או לנעול דוח כאשר צילום החישוב כולל שגיאות קריטיות.')
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.feasibilityReportVersion.update({ where: { id: report.id }, data: { status: target, ...(target === 'APPROVED' ? { approvedById: actor.userId, approvedAt: new Date() } : {}), ...(target === 'LOCKED' ? { lockedById: actor.userId, lockedAt: new Date() } : {}) } })
      await this.audit.record(actor, { action: 'UPDATE', entity: 'FeasibilityReportVersion', entityId: row.id, changes: { before: { status: report.status }, after: { status: target } } }, tx)
      return row
    })
  }
}
