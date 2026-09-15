import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AutomationRunnerService } from '../automations/automation-runner.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'
import type {
  AdvanceStageDto, ChangeProjectStatusDto, AssignProjectTeamDto,
  AddProjectMemberDto, BulkProjectStatusDto, ArchiveProjectDto, RestoreProjectDto,
} from './dto/project-actions.dto'
import { PROJECT_RESTORE_STATUSES } from './dto/project-actions.dto'
import { AuditService, type AuditActor, type AuditActionName } from '../common/audit/audit.service'
import { TenantScopeService } from '../common/tenant/tenant-scope.service'
import { DomainError } from '../common/errors/domain-error'

/** Query-string booleans arrive as strings; treat only explicit truth as true. */
function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === '1'
}

/**
 * Relations that make a project non-empty for the purposes of hard deletion.
 * Each entry is the Prisma delegate name plus the filter that ties a row to the
 * project — either a direct `projectId` or a walk down the ownership chain.
 */
const PROJECT_CONTENT_CHECKS: {
  label: string
  count: (prisma: PrismaService, projectId: string) => Promise<number>
}[] = [
  { label: 'complexes',  count: (p, id) => p.complex.count({ where: { projectId: id } }) },
  { label: 'buildings',  count: (p, id) => p.building.count({ where: { complex: { projectId: id } } }) },
  { label: 'apartments', count: (p, id) => p.apartment.count({ where: { building: { complex: { projectId: id } } } }) },
  { label: 'documents',  count: (p, id) => p.document.count({ where: { projectId: id } }) },
  { label: 'meetings',   count: (p, id) => p.meeting.count({ where: { projectId: id } }) },
  { label: 'tasks',      count: (p, id) => p.task.count({ where: { projectId: id } }) },
  { label: 'members',    count: (p, id) => p.projectMember.count({ where: { projectId: id } }) },
]

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: TenantScopeService,
    private readonly audit: AuditService,
    private readonly automations: AutomationRunnerService,
  ) {}

  async findAll(query: Record<string, string>, tenantId: string) {
    const { stage, city, search, status, page = '1', limit = '20' } = query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { tenantId }
    if (stage)  where.stage = stage
    if (city)   where.city  = { contains: city }

    // Archived projects are hidden by DEFAULT — a finished or abandoned project
    // must fall out of the working list without being destroyed. Two opt-ins:
    // `status=ARCHIVED` (or any explicit status) selects exactly that status,
    // and `includeArchived=true` widens the default list to everything.
    if (status) {
      where.status = status
    } else if (!isTruthyFlag(query.includeArchived)) {
      where.status = { not: 'ARCHIVED' }
    }
    if (search) {
      where.OR = [
        { name:    { contains: search } },
        { address: { contains: search } },
        { code:    { contains: search } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          members: {
            include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ])

    return {
      data: await this.attachTeam(data, tenantId),
      total,
      page: Number(page),
      limit: Number(limit),
    }
  }

  /**
   * Resolve the direct team FKs (`projectManagerId`, `lawyerId`, `architectId`)
   * to user records.
   *
   * These are plain scalar FKs on Project with no Prisma relation declared, so
   * they cannot be `include`d. Rather than one lookup per project (N+1), every
   * referenced user id across the whole page is collected and fetched in a
   * single tenant-scoped query, then mapped back.
   */
  private async attachTeam<T extends {
    projectManagerId?: string | null
    lawyerId?: string | null
    architectId?: string | null
  }>(projects: T[], tenantId: string) {
    const ids = [
      ...new Set(
        projects
          .flatMap((p) => [p.projectManagerId, p.lawyerId, p.architectId])
          .filter((id): id is string => Boolean(id)),
      ),
    ]

    const users = ids.length
      ? await this.prisma.user.findMany({
          // Tenant-scoped: a stale FK pointing at another tenant resolves to null.
          where: { id: { in: ids }, tenantId },
          select: { id: true, firstName: true, lastName: true, role: true, email: true },
        })
      : []

    const byId = new Map(users.map((u) => [u.id, u]))

    return projects.map((p) => ({
      ...p,
      projectManager: p.projectManagerId ? byId.get(p.projectManagerId) ?? null : null,
      lawyer:         p.lawyerId         ? byId.get(p.lawyerId)         ?? null : null,
      architect:      p.architectId      ? byId.get(p.architectId)      ?? null : null,
    }))
  }

  async findOne(id: string, tenantId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
      include: {
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, role: true, email: true } } },
        },
        stages: { orderBy: { enteredAt: 'desc' }, take: 10 },
        complexes: {
          include: {
            buildings: {
              include: {
                apartments: {
                  include: { residents: { select: { id: true, firstName: true, lastName: true, signatureStatus: true, phone: true } } },
                },
              },
            },
          },
        },
      },
    })
    if (!project) throw new NotFoundException(`פרויקט ${id} לא נמצא`)
    const [withTeam] = await this.attachTeam([project], tenantId)
    return withTeam
  }

  async create(dto: CreateProjectDto, actor: AuditActor) {
    await this.assertTeamUsers([dto.projectManagerId, dto.lawyerId], actor.tenantId)

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          // tenantId always comes from the JWT, never from the body.
          tenantId:      actor.tenantId,
          code:          `PRJ-${Date.now().toString(36).toUpperCase()}`,
          name:          dto.name,
          description:   dto.description ?? null,
          address:       dto.address ?? '',
          city:          dto.city,
          neighborhood:  dto.neighborhood ?? null,
          totalUnits:    Number(dto.totalUnits ?? 0),
          ...(dto.signatureGoal !== undefined ? { signatureGoal: Number(dto.signatureGoal) } : {}),
          startDate:     dto.startDate ? new Date(dto.startDate) : null,
          targetEndDate: dto.targetEndDate ? new Date(dto.targetEndDate) : null,
          projectManagerId: dto.projectManagerId ?? null,
          lawyerId:         dto.lawyerId ?? null,
          stage:         (dto.stage as any) ?? 'DISCOVERY',
        } as any,
      })
      // Opening stage entry, so stage history is never missing its first row.
      await tx.projectStageHistory.create({
        data: { projectId: project.id, stage: project.stage, changedById: actor.userId },
      })
      await this.audit.record(actor, {
        action: 'CREATE', entity: 'Project', entityId: project.id,
        changes: { after: { name: project.name, code: project.code, city: project.city, stage: project.stage } },
      }, tx)
      return project
    })
  }

  async update(id: string, dto: UpdateProjectDto, actor: AuditActor) {
    const before = await this.scope.assertProject(id, actor.tenantId)
    const { stage, city, projectManagerId, lawyerId, startDate, targetEndDate, ...rest } = dto as any
    await this.assertTeamUsers([projectManagerId, lawyerId], actor.tenantId)

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.project.update({
        where: { id },
        data: {
          ...rest,
          ...(stage !== undefined && { stage }),
          ...(city !== undefined && { city }),
          ...(projectManagerId !== undefined && { projectManagerId }),
          ...(lawyerId !== undefined && { lawyerId }),
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(targetEndDate !== undefined && { targetEndDate: targetEndDate ? new Date(targetEndDate) : null }),
        },
      })
      const changes = AuditService.diff(
        { name: before.name, stage: before.stage, status: before.status },
        { name: after.name, stage: after.stage, status: after.status },
      )
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'Project', entityId: id,
        changes: changes ?? { after: { updated: true } },
      }, tx)
      return after
    })
  }

  async advanceStage(id: string, dto: AdvanceStageDto, actor: AuditActor) {
    const before = await this.scope.assertProject(id, actor.tenantId)
    if (before.stage === dto.stage) {
      throw DomainError.validation('PROJECT_STAGE_UNCHANGED', 'הפרויקט כבר נמצא בשלב זה.')
    }

    const after = await this.prisma.$transaction(async (tx) => {
      // Close the open stage entry, then open the new one.
      await tx.projectStageHistory.updateMany({
        where: { projectId: id, exitedAt: null },
        data:  { exitedAt: new Date() },
      })
      await tx.projectStageHistory.create({
        data: {
          projectId: id, stage: dto.stage as any,
          notes: dto.notes ?? null, changedById: actor.userId,
        },
      })
      const after = await tx.project.update({ where: { id }, data: { stage: dto.stage as any } })
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'Project', entityId: id,
        changes: { before: { stage: before.stage }, after: { stage: after.stage } },
        metadata: { reason: 'STAGE_ADVANCE', notes: dto.notes ?? null },
      }, tx)
      return after
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
      trigger: 'PROJECT_STAGE_CHANGED',
      tenantId: actor.tenantId,
      projectId: id,
      subjectId: id,
      context: {
        projectName: after.name,
        previousStage: before.stage,
        newStage: after.stage,
      },
    })

    return after
  }

  /**
   * Status change, including ARCHIVE.
   *
   * Archiving is the soft alternative to deletion for projects: Complex,
   * Building and Apartment all cascade from Project, so a hard delete would
   * silently destroy an entire ownership tree — and with it the evidence behind
   * any signature threshold already reported to the authority. There is
   * deliberately no project delete endpoint.
   */
  async changeStatus(id: string, dto: ChangeProjectStatusDto, actor: AuditActor) {
    const before = await this.scope.assertProject(id, actor.tenantId)
    if (before.status === dto.status) return before

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.project.update({
        where: { id },
        data: {
          status: dto.status as any,
          ...(dto.status === 'COMPLETED' ? { actualEndDate: new Date() } : {}),
        },
      })
      await this.audit.record(actor, {
        action: dto.status === 'ARCHIVED' ? 'DELETE' : 'UPDATE',
        entity: 'Project', entityId: id,
        changes: { before: { status: before.status }, after: { status: after.status } },
        metadata: {
          reason: dto.status === 'ARCHIVED' ? 'ARCHIVE' : 'STATUS_CHANGE',
          note: dto.reason ?? null,
        },
      }, tx)
      return after
    })
  }

  // ── Lifecycle closure: archive / restore / delete ────────────────────────

  /**
   * Archive (soft close). This is THE way a project leaves the active list.
   *
   * A project is the root of complexes → buildings → apartments → owners →
   * signatures → documents → evidence. Those records are legally significant
   * (they are the evidence behind any signature threshold reported to the
   * authority), so closure is a status transition, never a destruction.
   *
   * The status held immediately before archiving is written into the audit
   * metadata so `restore()` can put the project back exactly where it was.
   */
  async archive(id: string, dto: ArchiveProjectDto, actor: AuditActor) {
    const before = await this.scope.assertProject(id, actor.tenantId)
    if (before.status === 'ARCHIVED') {
      throw DomainError.conflict('PROJECT_ALREADY_ARCHIVED', 'הפרויקט כבר בארכיון.')
    }

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.project.update({
        where: { id },
        data: { status: 'ARCHIVED' as any },
      })
      await this.audit.record(actor, {
        action: 'DELETE', entity: 'Project', entityId: id,
        changes: { before: { status: before.status }, after: { status: 'ARCHIVED' } },
        metadata: {
          reason: 'ARCHIVE',
          previousStatus: before.status,
          note: dto.reason ?? null,
        },
      }, tx)
      return after
    })
  }

  /**
   * Restore an archived project.
   *
   * Target status resolution, in order: an explicit `status` on the request,
   * else the `previousStatus` recorded by the most recent archive audit entry,
   * else ACTIVE. The audit lookup is tenant-scoped — an audit row is never read
   * across the tenant boundary.
   */
  async restore(id: string, dto: RestoreProjectDto, actor: AuditActor) {
    const before = await this.scope.assertProject(id, actor.tenantId)
    if (before.status !== 'ARCHIVED') {
      throw DomainError.conflict('PROJECT_NOT_ARCHIVED', 'הפרויקט אינו בארכיון.')
    }

    const target = dto.status ?? (await this.previousStatusFromAudit(id, actor.tenantId)) ?? 'ACTIVE'

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.project.update({
        where: { id },
        data: { status: target as any },
      })
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'Project', entityId: id,
        changes: { before: { status: 'ARCHIVED' }, after: { status: target } },
        metadata: {
          reason: 'RESTORE',
          restoredFromAudit: dto.status === undefined,
          note: dto.reason ?? null,
        },
      }, tx)
      return after
    })
  }

  /**
   * Reads the status a project held before its most recent archive.
   * Returns null when there is no usable record — the caller falls back to
   * ACTIVE rather than guessing.
   */
  private async previousStatusFromAudit(id: string, tenantId: string): Promise<string | null> {
    const row = await this.prisma.auditLog.findFirst({
      where: { tenantId, entity: 'Project', entityId: id, action: 'DELETE' },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    })
    const meta = row?.metadata as Record<string, unknown> | null | undefined
    const prev = meta?.previousStatus
    return typeof prev === 'string' && (PROJECT_RESTORE_STATUSES as readonly string[]).includes(prev)
      ? prev
      : null
  }

  /**
   * Hard delete — deliberately restricted to an EMPTY project.
   *
   * Two independent reasons this cannot be the general closure mechanism:
   * Complex/Building/Apartment cascade from Project, so deleting a populated
   * project would silently destroy an entire ownership tree; and `Resident`
   * references Apartment WITHOUT a cascade, so the delete would fail on a
   * foreign-key violation anyway once residents exist. Refusing with 409 and
   * naming what is in the way follows the precedent already set by meetings
   * (delete refused once anyone is invited).
   */
  async remove(id: string, actor: AuditActor) {
    const project = await this.scope.assertProject(id, actor.tenantId)

    const blockers: Record<string, number> = {}
    for (const check of PROJECT_CONTENT_CHECKS) {
      const n = await check.count(this.prisma, id)
      if (n > 0) blockers[check.label] = n
    }

    if (Object.keys(blockers).length) {
      throw DomainError.conflict(
        'PROJECT_NOT_EMPTY',
        'לא ניתן למחוק פרויקט שיש בו נתונים. יש להעביר אותו לארכיון במקום.',
      )
    }

    return this.prisma.$transaction(async (tx) => {
      // Stage history has no independent meaning once the project is gone and
      // is the one child an "empty" project always has (the opening entry
      // written by create()).
      await tx.projectStageHistory.deleteMany({ where: { projectId: id } })
      await tx.project.delete({ where: { id } })
      await this.audit.record(actor, {
        action: 'DELETE', entity: 'Project', entityId: id,
        changes: { before: { name: project.name, status: project.status, stage: project.stage } },
        metadata: { reason: 'HARD_DELETE', wasEmpty: true },
      }, tx)
      return { id, deleted: true }
    })
  }

  /** Assigns / clears the three scalar team FKs in one audited write. */
  async assignTeam(id: string, dto: AssignProjectTeamDto, actor: AuditActor) {
    const before = await this.prisma.project.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, projectManagerId: true, lawyerId: true, architectId: true },
    })
    if (!before) throw DomainError.notFound('PROJECT_NOT_FOUND', `פרויקט ${id} לא נמצא`)
    await this.assertTeamUsers([dto.projectManagerId, dto.lawyerId, dto.architectId], actor.tenantId)

    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: {
          ...(dto.projectManagerId !== undefined && { projectManagerId: dto.projectManagerId }),
          ...(dto.lawyerId !== undefined && { lawyerId: dto.lawyerId }),
          ...(dto.architectId !== undefined && { architectId: dto.architectId }),
        },
        select: { id: true, projectManagerId: true, lawyerId: true, architectId: true },
      })
      const changes = AuditService.diff(before, updated)
      if (changes) {
        await this.audit.record(actor, {
          action: 'UPDATE', entity: 'Project', entityId: id, changes,
          metadata: { reason: 'TEAM_ASSIGNMENT' },
        }, tx)
      }
      return updated
    })

    // Resolve the FKs to users through the existing batched helper.
    const [withTeam] = await this.attachTeam([after], actor.tenantId)
    return withTeam
  }

  // ── Members ──────────────────────────────────────────────────────────────

  async listMembers(id: string, tenantId: string) {
    await this.scope.assertProject(id, tenantId)
    return this.prisma.projectMember.findMany({
      where: { projectId: id },
      select: {
        id: true, role: true, addedAt: true,
        user: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, role: true, isActive: true,
          },
        },
      },
      orderBy: { addedAt: 'asc' },
    })
  }

  async addMember(id: string, dto: AddProjectMemberDto, actor: AuditActor) {
    await this.scope.assertProject(id, actor.tenantId)
    const user = await this.scope.assertUser(dto.userId, actor.tenantId)
    const existing = await this.prisma.projectMember.findFirst({
      where: { projectId: id, userId: dto.userId }, select: { id: true },
    })
    if (existing) {
      throw DomainError.conflict('PROJECT_MEMBER_EXISTS', 'המשתמש כבר חבר בצוות הפרויקט.')
    }

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.create({
        data: { projectId: id, userId: dto.userId, role: (dto.role ?? user.role) as any },
        select: {
          id: true, role: true, addedAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
      })
      await this.audit.record(actor, {
        action: 'CREATE', entity: 'ProjectMember', entityId: member.id,
        changes: { after: { projectId: id, userId: dto.userId, role: member.role } },
        metadata: { projectId: id },
      }, tx)
      return member
    })
  }

  async removeMember(id: string, memberId: string, actor: AuditActor) {
    await this.scope.assertProject(id, actor.tenantId)
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId: id }, select: { id: true, userId: true, role: true },
    })
    if (!member) throw DomainError.notFound('PROJECT_MEMBER_NOT_FOUND', 'חבר הצוות לא נמצא.')

    return this.prisma.$transaction(async (tx) => {
      await tx.projectMember.delete({ where: { id: memberId } })
      await this.audit.record(actor, {
        action: 'DELETE', entity: 'ProjectMember', entityId: memberId,
        changes: { before: { projectId: id, userId: member.userId, role: member.role } },
        metadata: { projectId: id },
      }, tx)
      return { id: memberId, removed: true }
    })
  }

  // ── Bulk ─────────────────────────────────────────────────────────────────

  /**
   * Bulk status / archive. One transaction: either every project moves or none
   * does, so a half-applied archive cannot leave the portfolio inconsistent.
   * Cross-tenant ids abort the whole batch with 404 before anything is written.
   */
  async bulkChangeStatus(dto: BulkProjectStatusDto, actor: AuditActor) {
    const ids = [...new Set(dto.ids)]
    await this.scope.assertProjects(ids, actor.tenantId)

    const action: AuditActionName = dto.status === 'ARCHIVED' ? 'DELETE' : 'UPDATE'

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.project.findMany({
        where: { id: { in: ids }, tenantId: actor.tenantId },
        select: { id: true, status: true, name: true },
      })
      await tx.project.updateMany({
        where: { id: { in: ids }, tenantId: actor.tenantId },
        data: {
          status: dto.status as any,
          ...(dto.status === 'COMPLETED' ? { actualEndDate: new Date() } : {}),
        },
      })
      await this.audit.recordMany(actor, before.map((p) => ({
        action,
        entity: 'Project', entityId: p.id,
        changes: { before: { status: p.status }, after: { status: dto.status } },
        metadata: { reason: 'BULK_STATUS_CHANGE', batchSize: ids.length, note: dto.reason ?? null },
      })), tx)
      return { updated: before.length, status: dto.status }
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * projectManagerId / lawyerId / architectId are scalar FKs with no Prisma
   * relation, so nothing stops them pointing at another tenant's user. One
   * batched, tenant-scoped query validates all of them at once (no N+1).
   */
  private async assertTeamUsers(ids: (string | null | undefined)[], tenantId: string) {
    const real = ids.filter((id): id is string => Boolean(id))
    if (!real.length) return
    await this.scope.assertUsers(real, tenantId)
  }

  async getSignatureReport(id: string, tenantId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
      select: { totalUnits: true, signedUnits: true, name: true },
    })
    if (!project) throw new NotFoundException()

    const residents = await this.prisma.resident.findMany({
      where: { apartment: { building: { complex: { projectId: id } } } },
      select: { id: true, firstName: true, lastName: true, signatureStatus: true, phone: true },
    })

    return {
      totalUnits:  project.totalUnits,
      signedUnits: project.signedUnits,
      percentage:  project.totalUnits ? Math.round((project.signedUnits / project.totalUnits) * 100) : 0,
      residents,
    }
  }
}
