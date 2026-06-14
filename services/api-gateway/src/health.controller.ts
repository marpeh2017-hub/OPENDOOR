import { Controller, Get } from '@nestjs/common'
import { Public } from './auth/decorators/public.decorator'
import { PrismaService } from './prisma.service'

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
