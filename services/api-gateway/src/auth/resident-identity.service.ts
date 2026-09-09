import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../prisma.service'
import { hashOtp } from '../common/otp/otp'

/**
 * Who is signing in to the resident portal, and what may they see.
 *
 * ── THE RULE THIS SERVICE EXISTS TO ENFORCE ─────────────────────────────────
 *
 * A phone number is not an identity. It is not unique across tenants, family
 * members share handsets, and carriers recycle numbers. An OTP proves exactly
 * one thing — that whoever answered controls that handset — and nothing at all
 * about which resident file they are entitled to open.
 *
 * The previous login collapsed those two questions into
 * `findFirst({ where: { phone } })`, which issued a session for whichever row
 * the query planner happened to reach first, carrying that row's tenantId. With
 * two tenants holding the same number that is a cross-tenant account takeover
 * requiring no attacker effort.
 *
 * So resolution is separated from authentication. This service answers "which
 * resident contexts could this be?" and returns ALL of them. It never picks.
 * Choosing between two people's files is not a decision code is allowed to make
 * on a coin flip — either the caller narrowed it with an invitation or a tenant
 * context, or a human picks from a list, or nobody gets in.
 */

/** One resident file a phone could open, with just enough to choose between them. */
export interface ResidentContext {
  residentId: string
  tenantId: string
  tenantSlug: string
  projectId: string
  projectName: string
  buildingId: string
  buildingAddress: string
  apartmentId: string
  apartmentNumber: string
  residentName: string
}

/**
 * How long an invitation stays redeemable.
 *
 * Seven days is long enough to survive a weekend and a missed SMS, and short
 * enough that a link found in an old message thread months later is dead.
 */
const DEFAULT_INVITATION_TTL_HOURS = 24 * 7

export type NarrowedBy = 'INVITATION' | 'TENANT_CONTEXT' | 'PHONE_ONLY'

export interface Resolution {
  contexts: ResidentContext[]
  narrowedBy: NarrowedBy
}

export type InvitationRejection =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'REVOKED'
  | 'PHONE_MISMATCH'
  | 'RESIDENT_INACTIVE'

export type InvitationCheck =
  | { ok: true; invitationId: string; context: ResidentContext; phone: string }
  | { ok: false; reason: InvitationRejection }

@Injectable()
export class ResidentIdentityService {
  private readonly logger = new Logger(ResidentIdentityService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The one shape a resident context is built in.
   *
   * Every field is read through the apartment → building → complex → project
   * chain rather than from `Resident.tenantId`, because that column is a plain
   * scalar with no foreign key: it can disagree with where the apartment
   * actually sits, and the traversal is the authoritative answer.
   */
  private static readonly RESIDENT_SCOPE = {
    id: true,
    firstName: true,
    lastName: true,
    isActive: true,
    apartment: {
      select: {
        id: true,
        apartmentNumber: true,
        building: {
          select: {
            id: true,
            address: true,
            complex: {
              select: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    tenant: { select: { id: true, slug: true } },
                  },
                },
              },
            },
          },
        },
      },
    },
  } as const

  private toContext(row: {
    id: string; firstName: string; lastName: string
    apartment: {
      id: string; apartmentNumber: string
      building: {
        id: string; address: string
        complex: { project: { id: string; name: string; tenant: { id: string; slug: string } } }
      }
    }
  }): ResidentContext {
    const building = row.apartment.building
    const project = building.complex.project
    return {
      residentId: row.id,
      tenantId: project.tenant.id,
      tenantSlug: project.tenant.slug,
      projectId: project.id,
      projectName: project.name,
      buildingId: building.id,
      buildingAddress: building.address,
      apartmentId: row.apartment.id,
      apartmentNumber: row.apartment.apartmentNumber,
      residentName: `${row.firstName} ${row.lastName}`.trim(),
    }
  }

  /**
   * Every resident file the given phone could open, optionally narrowed.
   *
   * Archived residents are excluded: `isActive: false` is a former resident,
   * and a former resident is not a login.
   */
  async resolveByPhone(phone: string, tenantSlug?: string | null): Promise<Resolution> {
    const rows = await this.prisma.resident.findMany({
      where: {
        phone,
        isActive: true,
        ...(tenantSlug
          ? { apartment: { building: { complex: { project: { tenant: { slug: tenantSlug } } } } } }
          : {}),
      },
      select: ResidentIdentityService.RESIDENT_SCOPE,
    })
    return {
      contexts: rows.map((r) => this.toContext(r)),
      narrowedBy: tenantSlug ? 'TENANT_CONTEXT' : 'PHONE_ONLY',
    }
  }

  /**
   * Validates an invitation token and returns the single context it grants.
   *
   * Rejection reasons are distinguished internally so operators can diagnose a
   * resident's "the link doesn't work", but callers must collapse them to one
   * message: telling an anonymous caller whether a token exists, has expired,
   * or belongs to a different phone is an oracle.
   */
  async checkInvitation(token: string, phone?: string | null): Promise<InvitationCheck> {
    if (!token || token.length < 20 || token.length > 200) return { ok: false, reason: 'NOT_FOUND' }

    const row = await this.prisma.residentInvitation.findUnique({
      where: { tokenHash: hashOtp(token) },
      select: {
        id: true, phone: true, expiresAt: true, usedAt: true, revokedAt: true,
        tenantId: true, projectId: true, buildingId: true, apartmentId: true, residentId: true,
        resident: { select: ResidentIdentityService.RESIDENT_SCOPE },
      },
    })
    if (!row) return { ok: false, reason: 'NOT_FOUND' }
    if (row.revokedAt) return { ok: false, reason: 'REVOKED' }
    if (row.usedAt) return { ok: false, reason: 'ALREADY_USED' }
    if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' }
    if (!row.resident.isActive) return { ok: false, reason: 'RESIDENT_INACTIVE' }

    // A leaked link must not be redeemable from a different handset. The OTP
    // still has to succeed on the invitation's OWN number.
    if (phone && phone !== row.phone) return { ok: false, reason: 'PHONE_MISMATCH' }

    const context = this.toContext(row.resident)

    /*
     * The invitation names its scope explicitly, and the resident's current
     * placement is derived. If they disagree the resident has been moved since
     * the invitation was issued, and the invitation no longer describes
     * reality — refuse rather than grant either version. A credential grants
     * what it says or it grants nothing.
     */
    if (
      context.tenantId !== row.tenantId ||
      context.projectId !== row.projectId ||
      context.buildingId !== row.buildingId ||
      context.apartmentId !== row.apartmentId
    ) {
      this.logger.warn(
        `Invitation ${row.id} no longer matches resident ${row.residentId}'s placement — refusing. ` +
        'The resident was most likely moved to another apartment after it was issued.',
      )
      return { ok: false, reason: 'NOT_FOUND' }
    }

    return { ok: true, invitationId: row.id, context, phone: row.phone }
  }

  /**
   * Issues an invitation for one resident, and returns the raw token ONCE.
   *
   * ── WHAT THE CALLER IS AND IS NOT ALLOWED TO DECIDE ─────────────────────────
   *
   * The caller names a resident. That is all. Every scope field on the row is
   * derived here from that resident's apartment traversal, and the phone comes
   * from the resident's own record — because an endpoint that accepted a
   * caller-supplied tenantId, projectId or phone would let a staff member of
   * tenant A mint a credential into tenant B's data, or redirect a resident's
   * login link to a handset of their choosing. Neither is a scenario worth
   * leaving open for the convenience of a parameter.
   *
   * `actorTenantId` is the authenticated staff member's tenant, and it must
   * match the resident's DERIVED tenant. This is the same isolation rule the
   * rest of the API enforces, applied at the point where a credential is
   * created rather than where data is read.
   */
  async issueInvitation(params: {
    residentId: string
    actorTenantId: string
    actorUserId: string
    ttlHours?: number
  }): Promise<{ token: string; invitationId: string; expiresAt: Date; context: ResidentContext; phone: string }> {
    const resident = await this.prisma.resident.findUnique({
      where: { id: params.residentId },
      select: { ...ResidentIdentityService.RESIDENT_SCOPE, phone: true },
    })
    if (!resident) throw new NotFoundException({ code: 'RESIDENT_NOT_FOUND', message: 'דייר לא נמצא' })
    if (!resident.isActive) {
      throw new BadRequestException({
        code: 'RESIDENT_INACTIVE',
        message: 'לא ניתן להנפיק קישור לדייר שהועבר לארכיון',
      })
    }

    const context = this.toContext(resident)
    if (context.tenantId !== params.actorTenantId) {
      // Not 404: the caller supplied an id, and the honest answer to "may I
      // create a credential here" is no. It is logged because a staff account
      // reaching across tenants is worth seeing.
      this.logger.warn(
        `User ${params.actorUserId} (tenant ${params.actorTenantId}) tried to issue an invitation ` +
        `for resident ${params.residentId} in tenant ${context.tenantId} — refused.`,
      )
      throw new ForbiddenException({ code: 'CROSS_TENANT_DENIED', message: 'אין הרשאה לדייר זה' })
    }

    if (!resident.phone) {
      // The invitation is redeemed by OTP to the number it names. Without one
      // it would be a link nobody could ever complete.
      throw new BadRequestException({
        code: 'RESIDENT_HAS_NO_PHONE',
        message: 'לדייר אין מספר טלפון — לא ניתן להנפיק קישור כניסה',
      })
    }

    // 32 bytes from the CSPRNG. Long enough that the unique index on the hash
    // is the only collision handling this needs.
    const token = randomBytes(32).toString('base64url')
    const ttlHours = params.ttlHours ?? DEFAULT_INVITATION_TTL_HOURS
    const expiresAt = new Date(Date.now() + ttlHours * 3_600_000)

    /*
     * Issuing a new link kills the outstanding ones for this resident.
     *
     * Re-sending is what people do when a link "didn't arrive", and every
     * un-revoked predecessor stays a live bearer token in somebody's SMS
     * history until it expires. One resident should have at most one way in at
     * a time.
     */
    const superseded = await this.prisma.residentInvitation.updateMany({
      where: { residentId: params.residentId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'SUPERSEDED_BY_NEW_INVITATION' },
    })

    const row = await this.prisma.residentInvitation.create({
      data: {
        tenantId: context.tenantId,
        projectId: context.projectId,
        buildingId: context.buildingId,
        apartmentId: context.apartmentId,
        residentId: context.residentId,
        tokenHash: hashOtp(token),
        phone: resident.phone,
        expiresAt,
        createdById: params.actorUserId,
      },
      select: { id: true },
    })

    this.logger.log(
      `Invitation ${row.id} issued for resident ${context.residentId} by ${params.actorUserId}` +
      (superseded.count > 0 ? `, revoking ${superseded.count} outstanding link(s)` : ''),
    )

    // The raw token is returned here and nowhere else — only its hash is stored.
    return { token, invitationId: row.id, expiresAt, context, phone: resident.phone }
  }

  /** Revokes an outstanding invitation. Scoped to the actor's tenant. */
  async revokeInvitation(invitationId: string, actorTenantId: string, reason: string): Promise<void> {
    const done = await this.prisma.residentInvitation.updateMany({
      where: { id: invitationId, tenantId: actorTenantId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    })
    if (done.count === 0) {
      throw new NotFoundException({ code: 'INVITATION_NOT_FOUND', message: 'הזמנה לא נמצאה או שאינה פעילה' })
    }
  }

  /** Marks an invitation redeemed. Single use: afterwards the phone is the key. */
  async consumeInvitation(invitationId: string): Promise<void> {
    await this.prisma.residentInvitation.updateMany({
      where: { id: invitationId, usedAt: null },
      data: { usedAt: new Date() },
    })
  }

  /**
   * Re-reads one context by id, for the selection step.
   *
   * Deliberately re-derives it from the database instead of trusting anything
   * the caller held between requests: the selection token says WHICH contexts
   * were on offer, and this says what each one currently grants.
   */
  async contextForResident(residentId: string): Promise<ResidentContext | null> {
    const row = await this.prisma.resident.findFirst({
      where: { id: residentId, isActive: true },
      select: ResidentIdentityService.RESIDENT_SCOPE,
    })
    return row ? this.toContext(row) : null
  }
}
