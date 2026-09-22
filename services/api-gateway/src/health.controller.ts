import { Controller, Get, Inject, HttpStatus, Res } from '@nestjs/common'
import { Response } from 'express'
import { Public } from './auth/decorators/public.decorator'
import { PrismaService } from './prisma.service'
import { REDIS, REDIS_IN_MEMORY } from './redis/redis.module'

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: any,
  ) {}

  @Get()
  @Public()
  async check(@Res() res: Response) {
    const checks: Record<string, 'ok' | 'error'> = {
      api:      'ok',
      database: 'ok',
      redis:    'ok',
    }

    // Database check
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      checks.database = 'error'
    }

    // Redis check
    try {
      await this.redis.setex('health:ping', 10, '1')
      const val = await this.redis.get('health:ping')
      if (val !== '1') checks.redis = 'error'
    } catch {
      checks.redis = 'error'
    }

    const allOk   = Object.values(checks).every(v => v === 'ok')
    const status  = allOk ? 'healthy' : 'degraded'
    const httpCode = allOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE

    // Which implementation answered, not just whether it answered. A passing
    // probe against the in-memory stand-in looks exactly like a passing probe
    // against Redis, and the difference is whether session revocation and OTP
    // limits survive a second process. Reported rather than inferred.
    const redisMode = (this.redis as Record<PropertyKey, unknown>)[REDIS_IN_MEMORY]
      ? 'in-memory-fallback'
      : 'client'

    return res.status(httpCode).json({
      status,
      checks,
      redisMode,
      timestamp: new Date().toISOString(),
    })
  }
}
