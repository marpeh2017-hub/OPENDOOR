import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { PrismaService } from '../prisma.service'
import { REDIS } from '../redis/redis.module'
import { LoginDto } from './dto/login.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { PortalAuthService } from './portal-auth.service'
import { passwordProblem } from './password-policy'
import { REVOCATION_TTL_SECONDS, issuedBeforeRevocation, revokeAllSessionsOf } from './session-revocation'
import { AuditService, type AuditActor } from '../common/audit/audit.service'

/*
 * The resident OTP constants and flow moved to `PortalAuthService`.
 *
 * They did not move to sit beside newer code: the OTP is now only half of
 * resident sign-in — the other half decides WHICH resident file the proven
 * handset may open — and splitting those two halves across two services is how
 * the original `findFirst({ phone })` hole survived review in the first place.
 */

// A revoked session must stay revoked for at least as long as the longest-lived
// token that carries its sessionId. The refresh token lives 30 days, so a 24h
// revocation window would let a stolen refresh token resurrect the session on
// day 2. Keep REFRESH_TOKEN_TTL and REVOCATION_TTL_SECONDS (session-revocation.ts,
// 30 days) in lockstep.
const ACCESS_TOKEN_TTL   = '24h'
const REFRESH_TOKEN_TTL  = '30d'

// scrypt parameters: N=2^15, r=8, p=1, 32-byte key — OWASP-acceptable for interactive login
const SCRYPT_N  = 32768
const SCRYPT_MEM = 128 * SCRYPT_N * 8 * 2  // 2× the theoretical minimum (64 MB)

export function hashPassword(plain: string): string {
  const salt = randomBytes(16)
  const key  = scryptSync(plain, salt, 32, { N: SCRYPT_N, r: 8, p: 1, maxmem: SCRYPT_MEM })
  return `$scrypt$${SCRYPT_N}$${salt.toString('base64')}$${key.toString('base64')}`
}

function checkPassword(plain: string, stored: string): boolean {
  if (stored.startsWith('$scrypt$')) {
    const [, , n, saltB64, keyB64] = stored.split('$')
    const salt     = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(keyB64, 'base64')
    const actual   = scryptSync(plain, salt, expected.length, { N: Number(n), r: 8, p: 1, maxmem: SCRYPT_MEM })
    return timingSafeEqual(actual, expected)
  }
  // Legacy dev-seed formats — verified then upgraded on login
  if (stored.startsWith('$sha256$')) {
    const hash = '$sha256$' + createHash('sha256').update(plain).digest('hex')
    return hash === stored
  }
  return plain === stored
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly portal: PortalAuthService,
    @Inject(REDIS) private readonly redis: any,
    private readonly audit: AuditService,
  ) {}

  /* ─── Email / password login (CRM staff) ───────────────────────── */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
    })

    if (!user || !user.passwordHash || !checkPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('אימייל או סיסמה שגויים')
    }

    const sessionId = randomUUID()

    const payload = {
      sub:       user.id,
      email:     user.email,
      role:      user.role,
      tenantId:  user.tenantId,
      sessionId,
    }

    const accessToken  = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL })
    const refreshToken = this.jwtService.sign(
      { sub: user.id, sessionId },
      { expiresIn: REFRESH_TOKEN_TTL },
    )

    // Update last login; transparently upgrade legacy hashes to scrypt
    await this.prisma.user.update({
      where: { id: user.id },
      data:  {
        lastLoginAt: new Date(),
        ...(user.passwordHash.startsWith('$scrypt$')
          ? {}
          : { passwordHash: hashPassword(dto.password) }),
      },
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id:        user.id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role:      user.role,
        tenantId:  user.tenantId,
      },
    }
  }

  /* ─── Refresh tokens ────────────────────────────────────────────── */
  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string; sessionId: string; role?: string; iat?: number }>(refreshToken)

      // A refresh token must carry a sessionId, otherwise it can never be
      // revoked. Reject legacy/forged tokens that omit it.
      if (!payload.sessionId) throw new UnauthorizedException('Refresh token לא תקין')

      // Logout revokes the whole session — the refresh token must not be able
      // to mint a fresh access token for a session that was already revoked.
      const revoked = await this.redis.exists(`jwt:revoked:${payload.sessionId}`)
      if (revoked) throw new UnauthorizedException('הסשן בוטל — יש להתחבר מחדש')
      // Nor for any session of a user signed out everywhere since it was
      // issued: the new access token would carry a fresh `iat` and pass.
      if (await issuedBeforeRevocation(this.redis, payload.sub, payload.iat)) {
        throw new UnauthorizedException('הסשן בוטל — יש להתחבר מחדש')
      }

      /*
       * A resident refresh token's `sub` is a residentId, not a userId, so the
       * staff lookup below would never find it — resident sessions simply died
       * after 12 hours with no way back except a fresh OTP.
       *
       * The scope is RE-DERIVED from the database rather than copied out of the
       * old token. A refresh is a good moment to notice that the resident was
       * archived or moved: carrying forward yesterday's tenantId and projectId
       * would keep a stale grant alive for the full 30-day refresh window.
       */
      if (payload.role === 'RESIDENT') {
        return this.portal.refreshSession(payload.sub, payload.sessionId)
      }

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user) throw new UnauthorizedException('משתמש לא נמצא')
      // A deactivated user must not be able to keep refreshing access.
      if (!user.isActive) throw new UnauthorizedException('החשבון אינו פעיל')

      const accessToken = this.jwtService.sign(
        {
          sub:       user.id,
          email:     user.email,
          role:      user.role,
          tenantId:  user.tenantId,
          sessionId: payload.sessionId,
        },
        { expiresIn: ACCESS_TOKEN_TTL },
      )

      return { accessToken }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err
      throw new UnauthorizedException('Refresh token לא תקין')
    }
  }

  /* ─── Change own password (CRM staff) ──────────────────────────── */
  /**
   * The signed-in user replaces their own password.
   *
   * The current password is required although the request is authenticated:
   * a session left open on a shared screen must not be enough to take the
   * account. A wrong one answers 400, not 401, because the CRM treats any 401
   * as an expired session and signs the user out.
   *
   * Success signs the user out everywhere, this session included
   * (session-revocation.ts), so a stolen session cannot outlive the change;
   * the CRM then asks them to sign in with the new password.
   */
  async changePassword(actor: AuditActor, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId } })
    if (!user || !user.isActive || user.tenantId !== actor.tenantId) {
      throw new UnauthorizedException('משתמש לא נמצא')
    }
    if (!user.passwordHash || !checkPassword(dto.currentPassword, user.passwordHash)) {
      throw new BadRequestException('הסיסמה הנוכחית שגויה.')
    }
    const problem = passwordProblem(dto.newPassword)
    if (problem) throw new BadRequestException(problem)
    if (checkPassword(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('הסיסמה החדשה זהה לנוכחית. בחרו סיסמה אחרת.')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(dto.newPassword) } })
      await this.audit.record(actor, {
        action: 'UPDATE', entity: 'User', entityId: user.id,
        // No before/after: there is nothing about a credential worth recording.
        metadata: { reason: 'PASSWORD_CHANGED_BY_USER', sessionsRevoked: true },
      }, tx)
    })
    await revokeAllSessionsOf(this.redis, user.id)
    return { passwordChanged: true }
  }

  /* ─── Logout — revoke session in Redis ─────────────────────────── */
  async logout(sessionId: string) {
    if (!sessionId) return
    // Revoke for the full refresh-token lifetime, not just the access-token
    // lifetime — otherwise the session resurrects once the marker expires.
    await this.redis.setex(`jwt:revoked:${sessionId}`, REVOCATION_TTL_SECONDS, '1')
  }
}
