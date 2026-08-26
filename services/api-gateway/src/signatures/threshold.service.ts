import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { Fraction, compareToThreshold, ratio } from '../common/fractions'

export interface ThresholdResult {
  scope: 'PROJECT' | 'BUILDING'
  buildingId?: string
  requiredPct: number
  basis: 'SHARES' | 'UNITS'
  signedPct: number
  reached: boolean
  totalUnits: number
  signedUnits: number
}

/**
 * Threshold engine — the heartbeat of every project.
 *
 * Computes the live signed percentage per project (and per building)
 * based on ownership SHARES, not resident head-count. An apartment
 * counts as "signed" proportionally to the sum of the ownership
 * fractions whose owners have a SIGNED SignatureRecord in the
 * project's latest APPROVED/LOCKED SignaturePackage.
 */
@Injectable()
export class ThresholdService {
  constructor(private readonly prisma: PrismaService) {}

  async computeForProject(projectId: string, tenantId: string): Promise<ThresholdResult[]> {
    const rules = await this.prisma.thresholdRule.findMany({ where: { projectId, tenantId } })
    // Default rule if none configured: 67% of shares, project-wide
    const effective = rules.length > 0 ? rules : [{
      scope: 'PROJECT', buildingId: null, requiredPct: 67, basis: 'SHARES',
    } as any]

    // Latest non-draft package for the project
    const pkg = await this.prisma.signaturePackage.findFirst({
      where: { projectId, tenantId, status: { in: ['APPROVED', 'LOCKED'] } },
      orderBy: { version: 'desc' },
    })

    // All apartments in the project with their ownership rows
    const apartments = await this.prisma.apartment.findMany({
      where: { building: { complex: { projectId } } },
      select: {
        id: true,
        buildingId: true,
        owners: { select: { ownerId: true, shareNumerator: true, shareDenominator: true } },
      },
    })

    const signedOwners = pkg
      ? new Set(
          (await this.prisma.signatureRecord.findMany({
            where: { packageId: pkg.id, status: 'SIGNED' },
            select: { ownerId: true, apartmentId: true },
          })).map(r => `${r.ownerId}:${r.apartmentId}`),
        )
      : new Set<string>()

    const results: ThresholdResult[] = []
    for (const rule of effective) {
      const scoped = rule.scope === 'BUILDING'
        ? apartments.filter(a => a.buildingId === rule.buildingId)
        : apartments

      let signedWeight = Fraction.ZERO
      let totalWeight = 0
      let signedUnits = 0

      for (const apt of scoped) {
        if (apt.owners.length === 0) {
          // No ownership data yet — apartment counts as fully unsigned
          totalWeight += 1
          continue
        }
        // Exact rational sum of the signed owners' shares. No floats, no
        // epsilon: an apartment is fully signed only when the signed shares
        // sum to EXACTLY 1, so 999/1000 signed is NOT a signed unit.
        let aptSignedFraction = Fraction.ZERO
        for (const o of apt.owners) {
          if (!signedOwners.has(`${o.ownerId}:${apt.id}`)) continue
          const share = Fraction.tryFrom(o.shareNumerator, o.shareDenominator)
          if (share === null) continue
          aptSignedFraction = aptSignedFraction.add(share)
        }
        // Over-registered ownership (sum > 1) is a Data Quality issue in its
        // own right; clamp so it cannot inflate the threshold.
        aptSignedFraction = aptSignedFraction.clamp01()
        totalWeight += 1
        const fullySigned = aptSignedFraction.isOne()
        if (rule.basis === 'UNITS') {
          // Unit counts as signed only when ALL its shares are signed
          if (fullySigned) { signedWeight = signedWeight.add(Fraction.ONE); signedUnits += 1 }
        } else {
          signedWeight = signedWeight.add(aptSignedFraction)
          if (fullySigned) signedUnits += 1
        }
      }

      // `reached` is decided by exact rational comparison; `signedPct` is
      // derived from the SAME ratio and truncated toward the failing side, so
      // the displayed number can never contradict the decision.
      const achieved = ratio(signedWeight, totalWeight)
      const { reached, displayPct } = compareToThreshold(achieved, rule.requiredPct)

      results.push({
        scope: rule.scope,
        buildingId: rule.buildingId ?? undefined,
        requiredPct: rule.requiredPct,
        basis: rule.basis,
        signedPct: displayPct,
        reached,
        totalUnits: scoped.length,
        signedUnits,
      })
    }
    return results
  }
}
