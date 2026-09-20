import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export type PackageStatus =
  | 'DRAFT'
  | 'INTERNAL_REVIEW'
  | 'APPROVED'
  | 'SENT'
  | 'PARTIALLY_SIGNED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SUPERSEDED'

export type SignatureEventType =
  | 'CREATED' | 'SUBMITTED_FOR_REVIEW' | 'APPROVED' | 'SENT' | 'DELIVERED' | 'OPENED'
  | 'OTP_REQUESTED' | 'OTP_VERIFIED' | 'OTP_FAILED'
  | 'SIGNED' | 'DECLINED' | 'REMINDER_SENT'
  | 'EXPIRED' | 'CANCELLED' | 'COMPLETED' | 'RESENT'

const VALID_TRANSITIONS: Record<PackageStatus, PackageStatus[]> = {
  DRAFT:            ['INTERNAL_REVIEW', 'CANCELLED'],
  INTERNAL_REVIEW:  ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED:         ['SENT', 'CANCELLED'],
  SENT:             ['PARTIALLY_SIGNED', 'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'],
  PARTIALLY_SIGNED: ['COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'],
  COMPLETED:        [],
  DECLINED:         [],
  EXPIRED:          [],
  CANCELLED:        [],
  SUPERSEDED:       [],
}

@Injectable()
export class SignatureStateMachineService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(
    packageId: string,
    to: PackageStatus,
    opts: {
      actorType?: string
      actorId?: string
      ip?: string
      userAgent?: string
      metadata?: Record<string, unknown>
      recordId?: string
      eventType?: SignatureEventType
    } = {},
  ) {
    const pkg = await this.prisma.signaturePackage.findUniqueOrThrow({
      where: { id: packageId },
      select: { status: true },
    })

    const from = pkg.status as PackageStatus
    if (!VALID_TRANSITIONS[from]?.includes(to)) {
      throw new BadRequestException(
        `Transition ${from} → ${to} is not allowed`,
      )
    }

    const STATUS_EVENT_MAP: Partial<Record<PackageStatus, SignatureEventType>> = {
      // Submitting for review is NOT an approval. Mapping it to 'APPROVED'
      // made the audit trail log APPROVED twice — once on submit and once on
      // the real approval — so the trail could not distinguish the two.
      INTERNAL_REVIEW:  'SUBMITTED_FOR_REVIEW',
      APPROVED:         'APPROVED',
      SENT:             'SENT',
      PARTIALLY_SIGNED: 'SIGNED',
      COMPLETED:        'COMPLETED',
      CANCELLED:        'CANCELLED',
      EXPIRED:          'EXPIRED',
      DECLINED:         'DECLINED',
      DRAFT:            'CREATED',
      SUPERSEDED:       'CANCELLED',
    }
    const eventType: SignatureEventType =
      opts.eventType ?? STATUS_EVENT_MAP[to] ?? 'CREATED'

    const [updated] = await this.prisma.$transaction([
      this.prisma.signaturePackage.update({
        where: { id: packageId },
        data: {
          status: to,
          ...(to === 'COMPLETED' ? { completedAt: new Date() } : {}),
          ...(to === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
        },
      }),
      this.prisma.signatureEvent.create({
        data: {
          packageId,
          recordId:  opts.recordId ?? null,
          type:      eventType,
          actorType: opts.actorType ?? 'SYSTEM',
          actorId:   opts.actorId ?? null,
          ip:        opts.ip ?? null,
          userAgent: opts.userAgent ?? null,
          metadata:  opts.metadata ? JSON.stringify(opts.metadata) : null,
        },
      }),
    ])

    return updated
  }

  async logEvent(
    packageId: string,
    type: SignatureEventType,
    opts: {
      recordId?: string
      actorType?: string
      actorId?: string
      ip?: string
      userAgent?: string
      metadata?: Record<string, unknown>
    } = {},
  ) {
    return this.prisma.signatureEvent.create({
      data: {
        packageId,
        recordId:  opts.recordId ?? null,
        type,
        actorType: opts.actorType ?? 'SYSTEM',
        actorId:   opts.actorId ?? null,
        ip:        opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
        metadata:  opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    })
  }
}
