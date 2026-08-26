import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { HealthScoreService } from '../health/health-score.service'

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthScoreService: HealthScoreService,
  ) {}

  async getProjectHealth(tenantId: string) {
    return this.healthScoreService.getTopSick(tenantId, 3)
  }

  async getStats(tenantId: string) {
    const [projectCount, residentCount, tasks] = await Promise.all([
      this.prisma.project.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.resident.count({ where: { tenantId } }),
      this.prisma.task.findMany({
        where:   { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        take:    5,
        orderBy: { dueDate: 'asc' },
        include: { assignee: { select: { firstName: true, lastName: true } } },
      }),
    ])

    const projects = await this.prisma.project.findMany({
      where:  { tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, totalUnits: true, signedUnits: true, stage: true, signatureGoal: true },
      take:   10,
    })

    const totalUnits  = projects.reduce((s, p) => s + p.totalUnits,  0)
    const signedUnits = projects.reduce((s, p) => s + p.signedUnits, 0)
    const avgSig = totalUnits > 0 ? Math.round((signedUnits / totalUnits) * 100 * 10) / 10 : 0

    const auditLogs = await this.prisma.auditLog.findMany({
      where:   { tenantId },
      take:    10,
      orderBy: { createdAt: 'desc' },
      select:  { id: true, action: true, entity: true, entityId: true, userId: true, createdAt: true },
    })

    // Resolve actor names in one query so the CRM never renders a raw user id.
    const actorIds = [...new Set(auditLogs.map(a => a.userId).filter((id): id is string => Boolean(id)))]
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where:  { id: { in: actorIds }, tenantId },
          select: { id: true, firstName: true, lastName: true },
        })
      : []
    const actorById = new Map(actors.map(u => [u.id, `${u.firstName} ${u.lastName}`]))

    const recentActivity = auditLogs.map(a => ({
      id:        a.id,
      action:    a.action,
      entity:    a.entity,
      entityId:  a.entityId,
      userId:    a.userId,
      userName:  a.userId ? actorById.get(a.userId) ?? null : null,
      createdAt: a.createdAt,
    }))

    // ── Signature trend: real cumulative signed-% over the last 6 months ──
    // Built from SignatureRecord.signedAt so the chart reflects actual signing
    // activity rather than a synthetic series.
    const now = new Date()
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const signedRecords = await this.prisma.signatureRecord.findMany({
      where:  { tenantId, status: 'SIGNED', signedAt: { not: null } },
      select: { signedAt: true },
    })

    // Count signatures completed strictly before the trend window so the first
    // bucket starts from the correct running total.
    let running = signedRecords.filter(
      r => r.signedAt !== null && r.signedAt < trendStart,
    ).length

    const MONTHS_HE = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']
    // Target line = mean of each active project's signature goal (%).
    const targetPct = projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + (p.signatureGoal ?? 0), 0) / projects.length)
      : 0

    const signatureTrend = Array.from({ length: 6 }, (_, i) => {
      const bucketStart = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const bucketEnd   = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1)
      running += signedRecords.filter(
        r => r.signedAt !== null && r.signedAt >= bucketStart && r.signedAt < bucketEnd,
      ).length
      return {
        month:      MONTHS_HE[bucketStart.getMonth()],
        signatures: totalUnits > 0 ? Math.round((running / totalUnits) * 100) : 0,
        target:     targetPct,
      }
    })

    /* ── Month-over-month deltas ────────────────────────────────────────
     *
     * These four numbers were hard-coded (12 / 8 / 3.2 / -4) and rendered on
     * both the Dashboard KPI cards and the Reports page as if they were real
     * business metrics. They are now derived from the same rows the headline
     * figures come from.
     *
     * Method, stated plainly because the cards do not have room to:
     *   - projects/residents compare TODAY's count against the count that
     *     existed at the start of this month (`createdAt < monthStart`). Rows
     *     are not tombstoned, so a deletion is invisible to this comparison —
     *     it measures growth, not net churn.
     *   - leads is a true month-vs-month comparison of rows created in each
     *     window, which is what "new leads this month" means.
     *   - signatures is a percentage-POINT move taken from the last two
     *     buckets of `signatureTrend` above, so the delta and the chart under
     *     it can never disagree.
     */
    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [projectsAtMonthStart, residentsAtMonthStart, leadsThisMonth, leadsPrevMonth] =
      await Promise.all([
        this.prisma.project.count({
          where: { tenantId, status: 'ACTIVE', createdAt: { lt: monthStart } },
        }),
        this.prisma.resident.count({ where: { tenantId, createdAt: { lt: monthStart } } }),
        this.prisma.lead.count({ where: { tenantId, createdAt: { gte: monthStart } } }),
        this.prisma.lead.count({
          where: { tenantId, createdAt: { gte: prevMonthStart, lt: monthStart } },
        }),
      ])

    /**
     * Percentage change, rounded to one decimal.
     *
     * Returns NULL when there is no baseline to compare against (previous = 0
     * and current > 0). It previously returned 100 for that case, which is
     * arithmetically defensible and practically misleading: "+100%" reads as
     * "we doubled", but going from zero to four is not a doubling — there was
     * simply nothing before. On a fresh tenant every counter starts at zero, so
     * three of the four KPI cards showed "+100%" simultaneously, which looks
     * like a placeholder and undermines trust in the cards that ARE real.
     *
     * The UI renders null as "חדש" rather than a percentage.
     */
    const pctChange = (current: number, previous: number): number | null => {
      if (previous === 0) return current > 0 ? null : 0
      return Math.round(((current - previous) / previous) * 1000) / 10
    }

    const lastBucket = signatureTrend[signatureTrend.length - 1]
    const prevBucket = signatureTrend[signatureTrend.length - 2]
    const signaturesChange =
      lastBucket && prevBucket
        ? Math.round((lastBucket.signatures - prevBucket.signatures) * 10) / 10
        : 0

    // Lead breakdown by status
    const leadsByStatus = await this.prisma.lead.groupBy({
      by:    ['status'],
      where: { tenantId },
      _count: { status: true },
    })

    return {
      kpis: {
        activeProjects:    projectCount,
        activeResidents:   residentCount,
        avgSignaturePct:   avgSig,
        // The card is labelled "לידים חדשים החודש". It was showing the
        // ALL-TIME lead count, which is a different (and much larger) number.
        newLeadsThisMonth: leadsThisMonth,
        projectsChange:    pctChange(projectCount, projectsAtMonthStart),
        residentsChange:   pctChange(residentCount, residentsAtMonthStart),
        signaturesChange,
        leadsChange:       pctChange(leadsThisMonth, leadsPrevMonth),
      },
      activeProjects: projects.map(p => ({
        id:         p.id,
        name:       p.name,
        stage:      p.stage,
        signatures: p.totalUnits > 0 ? Math.round((p.signedUnits / p.totalUnits) * 100) : 0,
        totalUnits: p.totalUnits,
      })),
      signatureTrend,
      recentActivity,
      upcomingTasks: tasks.map(t => ({
        id:       t.id,
        title:    t.title,
        dueDate:  t.dueDate,
        priority: t.priority,
        assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : null,
      })),
      leadsByStatus: leadsByStatus.map(l => ({ status: l.status, count: l._count.status })),
    }
  }
}
