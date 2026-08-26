import { Injectable, UnauthorizedException, Inject } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { REDIS } from '../../redis/redis.module'

export interface JwtPayload {
  sub: string          // userId
  email: string
  role: string
  tenantId: string
  sessionId: string
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
    return {
      userId:    payload.sub,
      email:     payload.email,
      role:      payload.role,
      tenantId:  payload.tenantId,
      sessionId: payload.sessionId,
    }
  }
}
