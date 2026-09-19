import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  DataQualityCategory,
  DataQualityEntityType,
  DataQualityIssue,
  DataQualitySeverity,
  DataQualityStatus,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { DataQualityEngine, type ScanResult } from './data-quality.engine'
import type { DataQualityIssueView, IssueSeverity } from './data-quality.types'

/**
 * Penalty weight per severity. Used by the project / tenant quality score.
 * See docs/DATA_QUALITY.md for the full formula and its rationale.
 */
export const SEVERITY_WEIGHT: Record<DataQualitySeverity, number> = {
  CRITICAL: 10,
  HIGH: 5,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
}

/** Score can never exceed this while an open CRITICAL issue exists. */
const CRITICAL_SCORE_CAP = 79
/** Smallest denominator, so a tiny project is not destroyed by one issue. */
const MIN_NORMALISER = 50

export interface ListIssuesFilters {
  projectId?: string
  category?: DataQualityCategory
  severity?: DataQualitySeverity
  status?: DataQualityStatus
  entityType?: DataQualityEntityType
  issueType?: string
  search?: string
  detectedFrom?: string
  detectedTo?: string
  sort?: 'severity' | 'age' | 'project' | 'entity' | 'status' | 'detectedAt'
  order?: 'asc' | 'desc'
  skip?: number
  take?: number
}

@Injectable()
export class DataQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: DataQualityEngine,
  ) {}

  // ─── Catalogue ────────────────────────────────────────────────────────────

  getRules() {
    return this.engine.getRuleCatalogue()
  }

  // ─── Issue queries ────────────────────────────────────────────────────────

  private where(tenantId: string, f: ListIssuesFilters): Prisma.DataQualityIssueWhereInput {
    return {
      tenantId,
      ...(f.projectId ? { projectId: f.projectId } : {}),
      ...(f.category ? { category: f.category } : {}),
      ...(f.severity ? { severity: f.severity } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.entityType ? { entityType: f.entityType } : {}),
      ...(f.issueType ? { issueType: f.issueType } : {}),
      ...(f.detectedFrom || f.detectedTo
        ? {
            detectedAt: {
              ...(f.detectedFrom ? { gte: new Date(f.detectedFrom) } : {}),
              ...(f.detectedTo ? { lte: new Date(f.detectedTo) } : {}),
            },
          }
        : {}),
      ...(f.search
        ? {
            OR: [
              { title: { contains: f.search, mode: 'insensitive' } },
              { description: { contains: f.search, mode: 'insensitive' } },
              { entityLabel: { contains: f.search, mode: 'insensitive' } },
              { issueType: { contains: f.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }
  }

  private orderBy(f: ListIssuesFilters): Prisma.DataQualityIssueOrderByWithRelationInput[] {
    const dir = f.order ?? (f.sort === 'age' ? 'asc' : 'desc')
    switch (f.sort) {
      case 'age':      return [{ detectedAt: dir }]
      case 'project':  return [{ projectId: dir }, { severity: 'asc' }]
      case 'entity':   return [{ entityType: dir }, { entityLabel: 'asc' }]
      case 'status':   return [{ status: dir }, { severity: 'asc' }]
      case 'detectedAt': return [{ detectedAt: dir }]
      case 'severity':
      default:
        // The Postgres enum is declared CRITICAL→INFO, so ascending == worst first.
        return [{ severity: 'asc' }, { detectedAt: 'desc' }]
    }
  }

  async listIssues(tenantId: string, filters: ListIssuesFilters = {}) {
    const where = this.where(tenantId, filters)
    const take = Math.min(Math.max(filters.take ?? 50, 1), 200)
    const skip = Math.max(filters.skip ?? 0, 0)

    const [items, total] = await Promise.all([
      this.prisma.dataQualityIssue.findMany({
        where,
        orderBy: this.orderBy(filters),
        skip,
        take,
      }),
      this.prisma.dataQualityIssue.count({ where }),
    ])

    const projectNames = await this.projectNames(tenantId, items)

    return {
      items: items.map(i => ({ ...i, projectName: i.projectId ? projectNames.get(i.projectId) ?? null : null })),
      total,
      skip,
      take,
    }
  }

  async getIssue(tenantId: string, id: string) {
    const issue = await this.prisma.dataQualityIssue.findFirst({ where: { id, tenantId } })
    if (!issue) throw new NotFoundException('בעיית איכות נתונים לא נמצאה')

    const [projectNames, history, resolver] = await Promise.all([
      this.projectNames(tenantId, [issue]),
      this.prisma.auditLog.findMany({
        where: { tenantId, entity: 'DataQualityIssue', entityId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, action: true, changes: true, metadata: true, createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      issue.resolvedById
        ? this.prisma.user.findFirst({
            where: { id: issue.resolvedById, tenantId },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve(null),
    ])

    return {
      ...issue,
      projectName: issue.projectId ? projectNames.get(issue.projectId) ?? null : null,
      resolvedBy: resolver,
      history,
    }
  }

  private async projectNames(
    tenantId: string,
    issues: { projectId: string | null }[],
  ): Promise<Map<string, string>> {
    const ids = [...new Set(issues.map(i => i.projectId).filter((v): v is string => !!v))]
    if (ids.length === 0) return new Map()
    const projects = await this.prisma.project.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true, code: true },
    })
    return new Map(projects.map(p => [p.id, `${p.code} — ${p.name}`]))
  }

  // ─── Status transitions (all audited) ─────────────────────────────────────

  async resolveIssue(
    tenantId: string,
    id: string,
    actor: { userId: string | null; ip?: string; userAgent?: string },
    note?: string,
  ) {
    return this.transition(tenantId, id, 'RESOLVED', actor, note)
  }

  async ignoreIssue(
    tenantId: string,
    id: string,
    actor: { userId: string | null; ip?: string; userAgent?: string },
    note?: string,
  ) {
    return this.transition(tenantId, id, 'IGNORED', actor, note)
  }

  async reopenIssue(
    tenantId: string,
    id: string,
    actor: { userId: string | null; ip?: string; userAgent?: string },
    note?: string,
  ) {
    return this.transition(tenantId, id, 'OPEN', actor, note)
  }

  async startIssue(
    tenantId: string,
    id: string,
    actor: { userId: string | null; ip?: string; userAgent?: string },
    note?: string,
  ) {
    return this.transition(tenantId, id, 'IN_PROGRESS', actor, note)
  }

  /**
   * Applies a manual status change and records it in the shared AuditLog.
   * Tenant isolation: the two-step findFirst({ id, tenantId }) → update pattern
   * used across the codebase, so a foreign id can never be mutated.
   */
  private async transition(
    tenantId: string,
    id: string,
    next: DataQualityStatus,
    actor: { userId: string | null; ip?: string; userAgent?: string },
    note?: string,
  ) {
    const issue = await this.prisma.dataQualityIssue.findFirst({ where: { id, tenantId } })
    if (!issue) throw new NotFoundException('בעיית איכות נתונים לא נמצאה')
    if (issue.status === next) {
      throw new BadRequestException(`הבעיה כבר נמצאת בסטטוס ${next}`)
    }

    const closing = next === 'RESOLVED' || next === 'IGNORED'
    const updated = await this.prisma.dataQualityIssue.update({
      where: { id },
      data: {
        status: next,
        resolutionNote: note ?? null,
        resolvedAt: closing ? new Date() : null,
        resolvedById: closing ? actor.userId : null,
        resolutionType: closing ? 'MANUAL' : null,
      },
    })

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actor.userId,
        action: 'UPDATE',
        entity: 'DataQualityIssue',
        entityId: id,
        changes: { before: { status: issue.status }, after: { status: next } },
        metadata: {
          issueType: issue.issueType,
          severity: issue.severity,
          entityType: issue.entityType,
          entityId: issue.entityId,
          projectId: issue.projectId,
          note: note ?? null,
        },
        ipAddress: actor.ip ?? null,
        userAgent: actor.userAgent ?? null,
      },
    })

    return updated
  }

  // ─── Scanning ─────────────────────────────────────────────────────────────

  async scanProject(tenantId: string, projectId: string, triggeredById: string | null): Promise<ScanResult> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    })
    if (!project) throw new NotFoundException('פרויקט לא נמצא')
    return this.engine.runScan({ tenantId, scope: 'PROJECT', projectId, triggeredById })
  }

  async scanTenant(tenantId: string, triggeredById: string | null): Promise<ScanResult> {
    return this.engine.runScan({ tenantId, scope: 'TENANT', triggeredById })
  }

  /** Global scan — SUPER_ADMIN only. Runs one tenant-scoped pass per tenant. */
  async scanGlobal(triggeredById: string | null): Promise<ScanResult[]> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    const results: ScanResult[] = []
    for (const t of tenants) {
      results.push(await this.engine.runScan({ tenantId: t.id, scope: 'GLOBAL', triggeredById }))
    }
    return results
  }

  async listScans(tenantId: string, projectId?: string, take = 20) {
    return this.prisma.dataQualityScan.findMany({
      where: { tenantId, ...(projectId ? { projectId } : {}) },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
    })
  }

  async getScan(tenantId: string, id: string) {
    const scan = await this.prisma.dataQualityScan.findFirst({ where: { id, tenantId } })
    if (!scan) throw new NotFoundException('סריקה לא נמצאה')
    return scan
  }

  async getLatestScan(tenantId: string, projectId?: string) {
    return this.prisma.dataQualityScan.findFirst({
      where: { tenantId, ...(projectId ? { projectId } : {}) },
      orderBy: { startedAt: 'desc' },
    })
  }

  // ─── Summaries & scoring ──────────────────────────────────────────────────

  /**
   * Data-quality score, 0–100.
   *
   *   penalty     = Σ weight(severity) over OPEN + IN_PROGRESS issues
   *                 (CRITICAL 10, HIGH 5, MEDIUM 2, LOW 1, INFO 0)
   *   normaliser  = max(50, 2 × recordCount)
   *   score       = round(100 × (1 − min(1, penalty / normaliser)))
   *   if any open CRITICAL issue → score = min(score, 79)
   *
   * Normalising by record count keeps the score comparable between a 6-unit and
   * a 600-unit project: a fixed penalty budget would drive every large project
   * to zero. The CRITICAL cap guarantees that a project with a broken ownership
   * fraction can never present as "green" no matter how large it is.
   */
  private computeScore(
    bySeverity: Record<DataQualitySeverity, number>,
    recordCount: number,
  ): number {
    let penalty = 0
    for (const [sev, count] of Object.entries(bySeverity)) {
      penalty += SEVERITY_WEIGHT[sev as DataQualitySeverity] * count
    }
    const normaliser = Math.max(MIN_NORMALISER, recordCount * 2)
    let score = Math.round(100 * (1 - Math.min(1, penalty / normaliser)))
    if ((bySeverity.CRITICAL ?? 0) > 0) score = Math.min(score, CRITICAL_SCORE_CAP)
    return Math.max(0, Math.min(100, score))
  }

  private emptySeverityMap(): Record<DataQualitySeverity, number> {
    return { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 }
  }

  /** Counts the records the score is normalised against. */
  private async countRecords(tenantId: string, projectId?: string): Promise<number> {
    const projectFilter = projectId ? { projectId } : {}
    const aptFilter = projectId
      ? { building: { complex: { projectId } } }
      : { building: { complex: { project: { tenantId } } } }

    const [apartments, residents, tasks, documents, signatureRecords] = await Promise.all([
      this.prisma.apartment.count({ where: aptFilter }),
      this.prisma.resident.count({ where: { tenantId, ...(projectId ? { apartment: aptFilter } : {}) } }),
      this.prisma.task.count({ where: { tenantId, ...projectFilter } }),
      this.prisma.document.count({ where: { tenantId, ...projectFilter } }),
      this.prisma.signatureRecord.count({
        where: { tenantId, ...(projectId ? { package: { projectId } } : {}) },
      }),
    ])
    return apartments + residents + tasks + documents + signatureRecords
  }

  /**
   * Aggregated counts. Three groupBy queries regardless of issue volume —
   * no row is ever loaded into the API process for the dashboard.
   */
  private async aggregate(tenantId: string, projectId?: string) {
    const scope: Prisma.DataQualityIssueWhereInput = {
      tenantId,
      ...(projectId ? { projectId } : {}),
    }
    const open: Prisma.DataQualityIssueWhereInput = {
      ...scope,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    }

    const [bySeverityRows, byCategoryRows, byStatusRows, byTypeRows, byProjectRows] =
      await Promise.all([
        this.prisma.dataQualityIssue.groupBy({ by: ['severity'], where: open, _count: { _all: true } }),
        this.prisma.dataQualityIssue.groupBy({ by: ['category'], where: open, _count: { _all: true } }),
        this.prisma.dataQualityIssue.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
        this.prisma.dataQualityIssue.groupBy({ by: ['issueType'], where: open, _count: { _all: true } }),
        projectId
          ? Promise.resolve([])
          : this.prisma.dataQualityIssue.groupBy({ by: ['projectId'], where: open, _count: { _all: true } }),
      ])

    const bySeverity = this.emptySeverityMap()
    for (const r of bySeverityRows) bySeverity[r.severity] = r._count._all

    const byCategory: Record<string, number> = {}
    for (const r of byCategoryRows) byCategory[r.category] = r._count._all

    const byStatus: Record<string, number> = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, IGNORED: 0 }
    for (const r of byStatusRows) byStatus[r.status] = r._count._all

    const byIssueType = byTypeRows
      .map(r => ({ issueType: r.issueType, count: r._count._all }))
      .sort((a, b) => b.count - a.count)

    return { bySeverity, byCategory, byStatus, byIssueType, byProjectRows }
  }

  /** Per-project quality summary. Feeds the CRM and, later, Project Health Score. */
  async getProjectSummary(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true, name: true, code: true, stage: true, status: true },
    })
    if (!project) throw new NotFoundException('פרויקט לא נמצא')

    const [agg, recordCount, headline, latestScan] = await Promise.all([
      this.aggregate(tenantId, projectId),
      this.countRecords(tenantId, projectId),
      this.headlineMetrics(tenantId, projectId),
      this.getLatestScan(tenantId, projectId),
    ])

    const openTotal = agg.bySeverity.CRITICAL + agg.bySeverity.HIGH +
      agg.bySeverity.MEDIUM + agg.bySeverity.LOW + agg.bySeverity.INFO

    return {
      project,
      score: this.computeScore(agg.bySeverity, recordCount),
      recordCount,
      openIssues: openTotal,
      resolvedIssues: agg.byStatus.RESOLVED,
      ignoredIssues: agg.byStatus.IGNORED,
      bySeverity: agg.bySeverity,
      byCategory: agg.byCategory,
      byStatus: agg.byStatus,
      topIssueTypes: agg.byIssueType.slice(0, 10),
      headline,
      lastScan: latestScan,
    }
  }

  /** Tenant-wide summary, including a per-project breakdown and a 30-day trend. */
  async getTenantSummary(tenantId: string) {
    const [agg, recordCount, projects, latestScan, trend] = await Promise.all([
      this.aggregate(tenantId),
      this.countRecords(tenantId),
      this.prisma.project.findMany({
        where: { tenantId },
        select: { id: true, name: true, code: true },
      }),
      this.getLatestScan(tenantId),
      this.getTrend(tenantId),
    ])

    const projectMap = new Map(projects.map(p => [p.id, p]))
    const byProject = agg.byProjectRows
      .map(r => ({
        projectId: r.projectId,
        projectName: r.projectId
          ? projectMap.get(r.projectId)
            ? `${projectMap.get(r.projectId)!.code} — ${projectMap.get(r.projectId)!.name}`
            : null
          : null,
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count)

    const openTotal = agg.bySeverity.CRITICAL + agg.bySeverity.HIGH +
      agg.bySeverity.MEDIUM + agg.bySeverity.LOW + agg.bySeverity.INFO

    return {
      score: this.computeScore(agg.bySeverity, recordCount),
      recordCount,
      openIssues: openTotal,
      resolvedIssues: agg.byStatus.RESOLVED,
      ignoredIssues: agg.byStatus.IGNORED,
      bySeverity: agg.bySeverity,
      byCategory: agg.byCategory,
      byStatus: agg.byStatus,
      byProject,
      topIssueTypes: agg.byIssueType.slice(0, 10),
      projectCount: projects.length,
      lastScan: latestScan,
      trend,
    }
  }

  /** Issues detected vs. resolved over the last 30 scans. */
  private async getTrend(tenantId: string) {
    const scans = await this.prisma.dataQualityScan.findMany({
      where: { tenantId, status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      take: 30,
      select: {
        id: true, startedAt: true, issuesFound: true,
        issuesNew: true, issuesResolved: true, durationMs: true,
      },
    })
    return scans.reverse()
  }

  /** Headline operational metrics the CRM shows above the issue list. */
  private async headlineMetrics(tenantId: string, projectId: string) {
    const aptFilter = { building: { complex: { projectId } } }
    const openStatuses = { in: ['OPEN', 'IN_PROGRESS'] as DataQualityStatus[] }

    const [ownersMissingPhone, apartmentsWithoutOwners, ownershipInconsistencies, overdueTasks, apartments] =
      await Promise.all([
        this.prisma.dataQualityIssue.count({
          where: { tenantId, projectId, issueType: 'OWNER_MISSING_PHONE', status: openStatuses },
        }),
        this.prisma.dataQualityIssue.count({
          where: { tenantId, projectId, issueType: 'APARTMENT_NO_OWNER', status: openStatuses },
        }),
        this.prisma.dataQualityIssue.count({
          where: {
            tenantId, projectId, status: openStatuses,
            issueType: { in: ['OWNERSHIP_SHARE_SUM_INVALID', 'OWNERSHIP_INVALID_FRACTION'] },
          },
        }),
        this.prisma.dataQualityIssue.count({
          where: { tenantId, projectId, issueType: 'TASK_OVERDUE', status: openStatuses },
        }),
        this.prisma.apartment.count({ where: aptFilter }),
      ])

    return {
      ownersMissingPhone,
      apartmentsWithoutOwners,
      ownershipInconsistencies,
      overdueTasks,
      totalApartments: apartments,
    }
  }

  // ─── Backwards-compatible API (consumed by HealthScoreService) ────────────

  /**
   * Live, non-persisted detection. Kept with its original signature so the
   * pre-existing HealthScoreService keeps working unchanged.
   */
  async scanIssues(
    tenantId: string,
    filters: { projectId?: string; severity?: IssueSeverity; type?: string } = {},
  ): Promise<DataQualityIssueView[]> {
    const { issues } = await this.engine.detect(tenantId, filters.projectId)
    return issues
      .filter(i => {
        if (filters.severity && i.severity !== filters.severity) return false
        if (filters.type && i.issueType !== filters.type) return false
        return true
      })
      .map(i => ({
        type: i.issueType,
        severity: i.severity,
        category: i.category,
        entityType: i.entityType,
        entityId: i.entityId,
        entityLabel: i.entityLabel,
        projectId: i.projectId,
        title: i.title,
        description: i.description,
        impact: i.impact,
        recommendation: i.recommendation,
        fixUrl: i.deepLink,
        deepLink: i.deepLink,
      }))
  }

  /** 0–100 quality score for a project, read from persisted issues. */
  async computeProjectScore(tenantId: string, projectId: string): Promise<number> {
    const [agg, recordCount] = await Promise.all([
      this.aggregate(tenantId, projectId),
      this.countRecords(tenantId, projectId),
    ])
    return this.computeScore(agg.bySeverity, recordCount)
  }

  /** Legacy tenant summary shape. */
  async getSummary(tenantId: string) {
    const summary = await this.getTenantSummary(tenantId)
    return {
      score: summary.score,
      totalIssues: summary.openIssues,
      bySeverity: summary.bySeverity,
      byType: Object.fromEntries(summary.topIssueTypes.map(t => [t.issueType, t.count])),
    }
  }
}

export type { DataQualityIssue }
export type { IssueSeverity, DataQualityIssueView } from './data-quality.types'
/** Legacy alias — issue types are now open strings from the rule catalogue. */
export type IssueType = string
