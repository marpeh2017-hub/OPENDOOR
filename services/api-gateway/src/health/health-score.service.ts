import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { DataQualityService } from '../data-quality/data-quality.service'

export interface HealthDimension {
  name: string
  score: number
  maxScore: number
  detail: string
}

export interface NbaAction {
  priority: 1 | 2 | 3
  category: 'SIGNATURE' | 'DATA_QUALITY' | 'ENGAGEMENT' | 'TASK' | 'MILESTONE'
  title: string
  description: string
  metric: string
  actionUrl: string
}

export interface ProjectHealthReport {
  projectId: string
  projectName: string
  totalScore: number
  dimensions: HealthDimension[]
  nba: NbaAction[]
  computedAt: string
}

@Injectable()
export class HealthScoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQualityService: DataQualityService,
  ) {}

  async getProjectHealth(projectId: string, tenantId: string): Promise<ProjectHealthReport> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    })
    if (!project) throw new Error(`Project ${projectId} not found`)

    const [sigDim, dqDim, engDim, taskDim, recDim, nba] = await Promise.all([
      this.signatureProgressDimension(project),
      this.dataQualityDimension(tenantId, projectId),
      this.residentEngagementDimension(tenantId, projectId),
      this.taskHealthDimension(tenantId, projectId),
      this.activityRecencyDimension(tenantId, projectId),
      this.buildNba(project, tenantId, projectId),
    ])

    const dimensions = [sigDim, dqDim, engDim, taskDim, recDim]
    const totalScore = Math.round(dimensions.reduce((s, d) => s + d.score, 0))

    return {
      projectId,
      projectName: project.name,
      totalScore,
      dimensions,
      nba,
      computedAt: new Date().toISOString(),
    }
  }

  async getPortfolio(tenantId: string): Promise<ProjectHealthReport[]> {
    const projects = await this.prisma.project.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true },
    })

    const reports = await Promise.all(
      projects.map(p => this.getProjectHealth(p.id, tenantId)),
    )

    return reports.sort((a, b) => a.totalScore - b.totalScore) // sickest first
  }

  /** For dashboard: top 3 lowest-scoring projects */
  async getTopSick(tenantId: string, limit = 3): Promise<ProjectHealthReport[]> {
    const portfolio = await this.getPortfolio(tenantId)
    return portfolio.slice(0, limit)
  }

  // ─── Dimension 1: Signature Progress (30 pts) ────────────────────────────

  private async signatureProgressDimension(
    project: { id: string; totalUnits: number; signedUnits: number; signatureGoal: number },
  ): Promise<HealthDimension> {
    const { totalUnits, signedUnits, signatureGoal } = project
    const requiredPct = signatureGoal / 100
    const signedPct   = totalUnits > 0 ? signedUnits / totalUnits : 0
    const score       = Math.min(30, totalUnits > 0 ? (signedPct / requiredPct) * 30 : 0)

    return {
      name: 'Signature Progress',
      score: Math.round(score * 10) / 10,
      maxScore: 30,
      detail: `${signedUnits}/${totalUnits} יחידות חתמו (${Math.round(signedPct * 100)}% מתוך ${signatureGoal}% נדרש)`,
    }
  }

  // ─── Dimension 2: Data Quality (20 pts) ──────────────────────────────────

  private async dataQualityDimension(tenantId: string, projectId: string): Promise<HealthDimension> {
    const dqScore = await this.dataQualityService.computeProjectScore(tenantId, projectId)
    const score   = (dqScore / 100) * 20

    return {
      name: 'Data Quality',
      score: Math.round(score * 10) / 10,
      maxScore: 20,
      detail: `ציון איכות נתונים: ${dqScore}/100`,
    }
  }

  // ─── Dimension 3: Resident Engagement (20 pts) ────────────────────────────

  private async residentEngagementDimension(tenantId: string, projectId: string): Promise<HealthDimension> {
    const [total, notEngaged] = await Promise.all([
      this.prisma.resident.count({
        where: { tenantId, apartment: { building: { complex: { projectId } } } },
      }),
      this.prisma.resident.count({
        where: {
          tenantId,
          apartment: { building: { complex: { projectId } } },
          signatureStatus: { in: ['NOT_CONTACTED', 'UNREACHABLE'] },
        },
      }),
    ])

    const engagedPct = total > 0 ? (total - notEngaged) / total : 0
    const score      = engagedPct * 20

    return {
      name: 'Resident Engagement',
      score: Math.round(score * 10) / 10,
      maxScore: 20,
      detail: `${total - notEngaged}/${total} דיירים מעורבים (${Math.round(engagedPct * 100)}%)`,
    }
  }

  // ─── Dimension 4: Task Health (15 pts) ───────────────────────────────────

  private async taskHealthDimension(tenantId: string, projectId: string): Promise<HealthDimension> {
    const tasks = await this.prisma.task.findMany({
      where: { tenantId, projectId },
      select: { status: true, dueDate: true },
    })

    const total     = tasks.length
    const completed = tasks.filter(t => t.status === 'COMPLETED').length
    const overdue   = tasks.filter(t => t.status === 'OVERDUE').length

    const base    = total > 0 ? (completed / total) * 15 : 15
    const penalty = overdue * 2
    const score   = Math.max(0, base - penalty)

    return {
      name: 'Task Health',
      score: Math.round(score * 10) / 10,
      maxScore: 15,
      detail: `${completed}/${total} משימות הושלמו, ${overdue} באיחור`,
    }
  }

  // ─── Dimension 5: Activity Recency (15 pts) ───────────────────────────────

  private async activityRecencyDimension(tenantId: string, projectId: string): Promise<HealthDimension> {
    const now   = new Date()
    const day7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
    const day14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [recentEvent, recentTask] = await Promise.all([
      this.prisma.signatureEvent.findFirst({
        where: { package: { projectId }, createdAt: { gte: day30 } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.task.findFirst({
        where: { tenantId, projectId, updatedAt: { gte: day30 } },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ])

    const lastActivity = [
      recentEvent?.createdAt,
      recentTask?.updatedAt,
    ].filter(Boolean).sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0]

    let score = 0
    let detail = 'אין פעילות ב-30 ימים האחרונים'
    if (lastActivity) {
      if (lastActivity >= day7) {
        score  = 15
        detail = 'פעילות בשבוע האחרון'
      } else if (lastActivity >= day14) {
        score  = 10
        detail = 'פעילות ב-14 ימים האחרונים'
      } else {
        score  = 5
        detail = 'פעילות ב-30 ימים האחרונים'
      }
    }

    return { name: 'Activity Recency', score, maxScore: 15, detail }
  }

  // ─── NBA Builder ─────────────────────────────────────────────────────────

  private async buildNba(
    project: { id: string; totalUnits: number; signedUnits: number; signatureGoal: number },
    tenantId: string,
    projectId: string,
  ): Promise<NbaAction[]> {
    const actions: NbaAction[] = []
    const { totalUnits, signedUnits, signatureGoal } = project
    const requiredPct = signatureGoal / 100
    const signedPct   = totalUnits > 0 ? signedUnits / totalUnits : 0

    const [overdueTasks, dqIssues, notContacted, residents, partialPackages] = await Promise.all([
      this.prisma.task.count({ where: { tenantId, projectId, status: 'OVERDUE' } }),
      this.dataQualityService.scanIssues(tenantId, { projectId }),
      this.prisma.resident.count({
        where: {
          tenantId,
          apartment: { building: { complex: { projectId } } },
          signatureStatus: 'NOT_CONTACTED',
        },
      }),
      this.prisma.resident.findMany({
        where: { tenantId, apartment: { building: { complex: { projectId } } } },
        select: { id: true, updatedAt: true },
      }),
      this.prisma.signaturePackage.count({
        where: { projectId, status: 'PARTIALLY_SIGNED' },
      }),
    ])

    const criticalIssues = dqIssues.filter(i => i.severity === 'CRITICAL')
    const highIssues     = dqIssues.filter(i => i.severity === 'HIGH')

    // Rule 1: Overdue tasks
    if (overdueTasks > 0) {
      actions.push({
        priority: 1,
        category: 'TASK',
        title: 'משימות באיחור',
        description: `יש ${overdueTasks} משימות שעברו את תאריך היעד`,
        metric: `${overdueTasks} משימות באיחור`,
        actionUrl: `/crm/projects/${projectId}/tasks?status=OVERDUE`,
      })
    }

    // Rule 2: Critical data quality
    if (criticalIssues.length > 0) {
      actions.push({
        priority: 1,
        category: 'DATA_QUALITY',
        title: 'בעיות קריטיות בנתונים',
        description: `תקן ${criticalIssues.length} בעיות קריטיות בנתונים`,
        metric: `${criticalIssues.length} בעיות קריטיות`,
        actionUrl: `/crm/projects/${projectId}/data-quality?severity=CRITICAL`,
      })
    }

    // Rule 3: Signature gap
    const gap = requiredPct - signedPct
    if (gap > 0.1 && totalUnits > 0) {
      const needed = Math.ceil(gap * totalUnits)
      actions.push({
        priority: 2,
        category: 'SIGNATURE',
        title: 'חתימות חסרות',
        description: `דרושות עוד ${needed} חתימות להגיע ל-${signatureGoal}%`,
        metric: `${needed} חתימות חסרות`,
        actionUrl: `/crm/projects/${projectId}/signatures`,
      })
    }

    // Rule 4: Not contacted
    if (notContacted > 5) {
      actions.push({
        priority: 2,
        category: 'ENGAGEMENT',
        title: 'דיירים ללא קשר',
        description: `${notContacted} דיירים טרם נוצר קשר אתם`,
        metric: `${notContacted} דיירים ללא קשר`,
        actionUrl: `/crm/projects/${projectId}/residents?status=NOT_CONTACTED`,
      })
    }

    // Rule 5: High data quality issues
    if (highIssues.length > 0) {
      actions.push({
        priority: 3,
        category: 'DATA_QUALITY',
        title: 'בעיות נתונים גבוהות',
        description: `תקן ${highIssues.length} בעיות בנתוני הפרויקט`,
        metric: `${highIssues.length} בעיות HIGH`,
        actionUrl: `/crm/projects/${projectId}/data-quality?severity=HIGH`,
      })
    }

    // Rule 6: Residents last contacted > 14 days
    const day14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const staleResidents = residents.filter(r => r.updatedAt < day14).length
    if (staleResidents > 0) {
      actions.push({
        priority: 3,
        category: 'ENGAGEMENT',
        title: 'מעקב נדרש עם דיירים',
        description: `מעקב נדרש עם ${staleResidents} דיירים שלא עודכנו ב-14 ימים`,
        metric: `${staleResidents} דיירים ממתינים למעקב`,
        actionUrl: `/crm/projects/${projectId}/residents`,
      })
    }

    // Rule 7: Partially signed packages
    if (partialPackages > 0) {
      actions.push({
        priority: 3,
        category: 'SIGNATURE',
        title: 'חבילות חתימות ממתינות',
        description: `${partialPackages} חבילות חתימות ממתינות להשלמה`,
        metric: `${partialPackages} חבילות ב-PARTIALLY_SIGNED`,
        actionUrl: `/crm/projects/${projectId}/signatures?status=PARTIALLY_SIGNED`,
      })
    }

    return actions.sort((a, b) => a.priority - b.priority)
  }
}
