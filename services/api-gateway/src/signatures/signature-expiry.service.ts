import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { SignatureStateMachineService } from './signature-state-machine.service'

@Injectable()
export class SignatureExpiryService {
  private readonly logger = new Logger(SignatureExpiryService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly sm: SignatureStateMachineService,
  ) {}

  /**
   * Expire any packages that have passed their expiresAt.
   * Call this from a cron or on read — lightweight enough to run per-tenant.
   */
  async expireOverduePackages(tenantId: string): Promise<number> {
    const expired = await this.prisma.signaturePackage.findMany({
      where: {
        tenantId,
        status:    { in: ['SENT', 'PARTIALLY_SIGNED'] },
        expiresAt: { lt: new Date() },
      },
      select: { id: true },
    })

    let count = 0
    for (const pkg of expired) {
      try {
        await this.sm.transition(pkg.id, 'EXPIRED', {
          actorType: 'SYSTEM',
          eventType: 'EXPIRED',
        })
        count++
      } catch (err) {
        this.logger.error(`Failed to expire package ${pkg.id}: ${(err as Error).message}`)
      }
    }

    if (count > 0) {
      this.logger.log(`Expired ${count} package(s) for tenant ${tenantId}`)
    }
    return count
  }
}
