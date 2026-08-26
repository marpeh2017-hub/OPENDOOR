import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { hashPassword } from '../auth/auth.service'
import { AuditService, type AuditActor } from '../common/audit/audit.service'
import { TenantScopeService } from '../common/tenant/tenant-scope.service'
import { DomainError } from '../common/errors/domain-error'
import type {
  CreateUserDto, UpdateUserDto, ChangeUserRoleDto, SetUserActiveDto, ResetUserPasswordDto,
} from './dto/user.dto'

/**
 * The ONLY shape a user is ever returned in.
 *
 * `passwordHash`, `mfaSecret` and `nationalId` are absent by construction — a
 * `select` rather than a `delete` on the result, so a future field cannot leak
 * by being forgotten in an omit-list.
 */
const USER_PUBLIC_SELECT = {
  id: true, email: true, phone: true, firstName: true, lastName: true,
  role: true, language: true, isActive: true, isVerified: true,
  avatarUrl: true, lastLoginAt: true, createdAt: true, updatedAt: true,
} as const

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: TenantScopeService,
    private readonly audit: AuditService,
  ) {}

  // ── Reads ────────────────────────────────────────────────────────────────

  async findAll(tenantId: string, filters: { role?: string; isActive?: boolean; search?: string } = {}) {
    const { role, isActive, search } = filters
    return this.prisma.user.findMany({
      where: {
        tenantId,
        ...(role ? { role: role as never } : {}),
        ...(isActive === undefined ? {} : { isActive }),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { lastName: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: USER_PUBLIC_SELECT,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    })
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        ...USER_PUBLIC_SELECT,
        projectMemberships: {
          select: {
            id: true, role: true, addedAt: true,
            project: { select: { id: true, name: true, code: true, stage: true, status: true } },
          },
        },
      },
    })
    if (!user) throw DomainError.notFound('USER_NOT_FOUND', `משתמש ${id} לא נמצא`)
    return user
  }

  // ── Role escalation guard ────────────────────────────────────────────────

  /**
   * Only a SUPER_ADMIN may create or promote another SUPER_ADMIN.
   *
   * Without this a COMPANY_ADMIN — who legitimately holds ADMIN_ROLES and so
   * passes the RolesGuard on these endpoints — could mint a SUPER_ADMIN and
   * escalate past every check in the system.
   */
  private assertMayAssignRole(actor: AuditActor, role: string) {
    if (role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw DomainError.forbidden(
        'ROLE_ESCALATION_DENIED',
        'רק SUPER_ADMIN רשאי להעניק הרשאת SUPER_ADMIN.',
      )
    }
  }

  /** Nobody may lock themselves out or silently demote themselves. */
  private assertNotSelf(actor: AuditActor, targetId: string, code: string, message: string) {
    if (actor.userId === targetId) throw DomainError.validation(code, message)
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  async create(dto: CreateUserDto, actor: AuditActor) {
    this.assertMayAssignRole(actor, dto.role)
    if (!dto.email && !dto.phone) {
      throw DomainError.validation('USER_CONTACT_REQUIRED', 'נדרש אימייל או טלפון למשתמש.')
    }
    await this.assertContactAvailable(actor.tenantId, dto.email, dto.phone)

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          // tenantId comes from the JWT, never from the body.
          tenantId: actor.tenantId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role as never,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          language: (dto.language ?? 'he') as never,
          isActive: dto.isActive ?? true,
          // Reuses the existing scrypt hasher (maxmem already tuned for Node 24).
          passwordHash: dto.password ? hashPassword(dto.password) : null,
        },
        select: USER_PUBLIC_SELECT,
      })

      await this.audit.record(actor, {
        action: 'CREATE',
        entity: 'User',
        entityId: created.id,
        // `password` is not in the payload at all; `redactForAudit` is a second line.
        changes: { after: { ...created, passwordSet: Boolean(dto.password) } },
      }, tx)

      return created
    })

    return user
  }

  async update(id: string, dto: UpdateUserDto, actor: AuditActor) {
    const before = await this.prisma.user.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: USER_PUBLIC_SELECT,
    })
    if (!before) throw DomainError.notFound('USER_NOT_FOUND', `משתמש ${id} לא נמצא`)
    await this.assertContactAvailable(actor.tenantId, dto.email, dto.phone, id)

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.user.update({
        where: { id },
        // Explicit field list — no spread of client input.
        data: {
          ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.language !== undefined ? { language: dto.language as never } : {}),
          ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        },
        select: USER_PUBLIC_SELECT,
      })
      const changes = AuditService.diff(before, after)
      if (changes) {
        await this.audit.record(actor, { action: 'UPDATE', entity: 'User', entityId: id, changes }, tx)
      }
      return after
    })
  }

  async changeRole(id: string, dto: ChangeUserRoleDto, actor: AuditActor) {
    const before = await this.scope.assertUser(id, actor.tenantId)
    this.assertMayAssignRole(actor, dto.role)
    // Demoting the last active SUPER_ADMIN would leave the tenant unmanageable.
    if (before.role === 'SUPER_ADMIN' && dto.role !== 'SUPER_ADMIN') {
      await this.assertNotLastSuperAdmin(actor.tenantId, id)
    }
    this.assertNotSelf(actor, id, 'ROLE_SELF_CHANGE_DENIED', 'לא ניתן לשנות את ההרשאה של עצמך.')

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.user.update({
        where: { id }, data: { role: dto.role as never }, select: USER_PUBLIC_SELECT,
      })
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'User', entityId: id,
        changes: { before: { role: before.role }, after: { role: after.role } },
        metadata: { reason: 'ROLE_CHANGE' },
      }, tx)
      return after
    })
  }

  /**
   * Activate / deactivate — the soft alternative to deletion, and the only
   * "removal" this service performs. See `deactivateInsteadOfDelete` below.
   */
  async setActive(id: string, dto: SetUserActiveDto, actor: AuditActor) {
    const before = await this.scope.assertUser(id, actor.tenantId)
    if (!dto.isActive) {
      this.assertNotSelf(actor, id, 'DEACTIVATE_SELF_DENIED', 'לא ניתן להשבית את המשתמש שלך.')
      if (before.role === 'SUPER_ADMIN') await this.assertNotLastSuperAdmin(actor.tenantId, id)
    }
    if (before.isActive === dto.isActive) return this.findOne(id, actor.tenantId)

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.user.update({
        where: { id }, data: { isActive: dto.isActive }, select: USER_PUBLIC_SELECT,
      })
      // Sessions of a deactivated user are revoked in the same transaction —
      // otherwise an existing refresh token keeps the account alive.
      if (!dto.isActive) {
        await tx.session.deleteMany({ where: { userId: id } })
      }
      await this.audit.record(actor, {
        action: dto.isActive ? 'UPDATE' : 'DELETE',
        entity: 'User', entityId: id,
        changes: { before: { isActive: before.isActive }, after: { isActive: dto.isActive } },
        metadata: { reason: dto.isActive ? 'ACTIVATE' : 'DEACTIVATE', sessionsRevoked: !dto.isActive },
      }, tx)
      return after
    })
  }

  async resetPassword(id: string, dto: ResetUserPasswordDto, actor: AuditActor) {
    await this.scope.assertUser(id, actor.tenantId)
    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash: hashPassword(dto.password) } })
      // Force re-authentication everywhere with the old credential.
      await tx.session.deleteMany({ where: { userId: id } })
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'User', entityId: id,
        // No before/after: there is nothing about a credential worth recording.
        metadata: { reason: 'PASSWORD_RESET', sessionsRevoked: true },
      }, tx)
      return { id, passwordReset: true }
    })
  }

  /**
   * `DELETE /users/:id` deactivates rather than destroying.
   *
   * `AuditLog.userId` references `User` with no cascade, as do `Task` assignee
   * and creator links: a hard delete would either fail on the FK or, worse,
   * tear rows out of the audit trail — the one record that must survive
   * personnel changes. Deactivation revokes access immediately (sessions are
   * dropped, `isActive` gates login) while keeping history intact.
   */
  async deactivateInsteadOfDelete(id: string, actor: AuditActor) {
    return this.setActive(id, { isActive: false }, actor)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** `@@unique([tenantId, email])` / `([tenantId, phone])` — check before writing. */
  private async assertContactAvailable(
    tenantId: string,
    email?: string | null,
    phone?: string | null,
    excludeId?: string,
  ) {
    const or: Record<string, unknown>[] = []
    if (email) or.push({ email })
    if (phone) or.push({ phone })
    if (!or.length) return
    const clash = await this.prisma.user.findFirst({
      where: { tenantId, OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true, email: true, phone: true },
    })
    if (!clash) return
    throw DomainError.conflict(
      clash.email === email ? 'USER_EMAIL_TAKEN' : 'USER_PHONE_TAKEN',
      clash.email === email
        ? 'כתובת האימייל כבר משויכת למשתמש אחר בארגון.'
        : 'מספר הטלפון כבר משויך למשתמש אחר בארגון.',
    )
  }

  private async assertNotLastSuperAdmin(tenantId: string, excludeId: string) {
    const others = await this.prisma.user.count({
      where: { tenantId, role: 'SUPER_ADMIN', isActive: true, NOT: { id: excludeId } },
    })
    if (others === 0) {
      throw DomainError.validation(
        'LAST_SUPER_ADMIN',
        'לא ניתן להסיר את מנהל-העל האחרון הפעיל בארגון.',
      )
    }
  }
}

export { USER_PUBLIC_SELECT }
