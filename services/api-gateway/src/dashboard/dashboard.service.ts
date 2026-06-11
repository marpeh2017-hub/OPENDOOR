import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(tenantId: string) {
    const [projectCount, residentCount, leadCount, tasks] = await Promise.all([
      this.prisma.project.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.resident.count({ where: { tenantId } }),
      this.prisma.lead.count({ where: { tenantId } }),
      this.prisma.task.findMany({
        where:   { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        take:    5,
        orderBy: { dueDate: 'asc' },
        include: { assignee: { select: { firstName: true, lastName: true } } },
      }),
    ])

    const projects = await this.prisma.project.findMany({
      where:  { tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, totalUnits: true, signedUnits: true, stage: true },
      take:   10,
    })

    const totalUnits  = projects.reduce((s, p) => s + p.totalUnits,  0)
    const signedUnits = projects.reduce((s, p) => s + p.signedUnits, 0)
    const avgSig = totalUnits > 0 ? Math.round((signedUnits / totalUnits) * 100 * 10) / 10 : 0

    const recentActivity = await this.prisma.auditLog.findMany({
      where:   { tenantId },
      take:    10,
      orderBy: { createdAt: 'desc' },
      select:  { id: true, action: true, entity: true, entityId: true, userId: true, createdAt: true },
    })

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
        newLeadsThisMonth: leadCount,
        projectsChange:    12,
        residentsChange:   8,
        signaturesChange:  3.2,
        leadsChange:       -4,
      },
      activeProjects: projects.map(p => ({
        id:         p.id,
        name:       p.name,
        stage:      p.stage,
        signatures: p.totalUnits > 0 ? Math.round((p.signedUnits / p.totalUnits) * 100) : 0,
        totalUnits: p.totalUnits,
      })),
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
