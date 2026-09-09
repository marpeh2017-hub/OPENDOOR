import { Injectable, UnauthorizedException, Inject } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { REDIS } from '../../redis/redis.module'

export interface JwtPayload {
  sub: string          // userId, or residentId on a portal session
  email: string
  role: string
  tenantId: string
  sessionId: string
  /** Portal sessions only — see the RESIDENT branch in `validate`. */
  projectId?: string
  residentId?: string
  iat?: number
  exp?: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(REDIS) private readonly redis: any) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    })
  }

  async validate(payload: JwtPayload) {
    // sessionId is mandatory: without it the revocation check below is a no-op,
    // so a token lacking the claim could never be logged out.
    if (!payload.sub || !payload.tenantId || !payload.sessionId) {
      throw new UnauthorizedException('Invalid token payload')
    }
    // Session revocation — logout writes jwt:revoked:{sessionId} in Redis.
    const revoked = await this.redis.exists(`jwt:revoked:${payload.sessionId}`)
    if (revoked) throw new UnauthorizedException('Session has been revoked')

    /*
     * ── A RESIDENT SESSION MUST CARRY ITS FULL SCOPE ────────────────────────
     *
     * Portal endpoints filter by projectId and residentId taken from HERE, and
     * never from the request. If either claim were missing, those filters would
     * be built from `undefined` — and an `undefined` in a Prisma `where` is not
     * an empty result set, it is an absent condition. The query silently widens
     * to the whole project, or the whole tenant.
     *
     * Resident tokens minted before the portal login existed have exactly that
     * shape, and some are still inside their 30-day refresh window. So the
     * claim is REQUIRED rather than defaulted: an old token is rejected and the
     * resident signs in again, which costs one OTP and closes the hole.
     */
    if (payload.role === 'RESIDENT' && (!payload.projectId || !payload.residentId)) {
      throw new UnauthorizedException('Resident session is missing its scope — sign in again')
    }

    return {
      userId:     payload.sub,
      email:      payload.email,
      role:       payload.role,
      tenantId:   payload.tenantId,
      sessionId:  payload.sessionId,
      projectId:  payload.projectId,
      residentId: payload.residentId,
    }
  }
}
