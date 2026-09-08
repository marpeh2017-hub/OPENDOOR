import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AutomationRunnerService } from '../automations/automation-runner.service'
import { PrismaService } from '../prisma.service'
import { AuditService } from '../common/audit/audit.service'
import type { PublicLeadDto } from './dto/public-lead.dto'

const MIN_TIME_ON_FORM_MS = 3_000
const MAX_TIME_ON_FORM_MS = 6 * 60 * 60 * 1_000

type SpamVerdict = 'HONEYPOT' | 'TOO_FAST' | 'STALE_TIMESTAMP' | null

export interface PublicLeadContext {
  ip: string | null
  userAgent: string | null
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('972')) return `0${digits.slice(3)}`
  if (digits.startsWith('00972')) return `0${digits.slice(5)}`
  return digits
}

function splitFullName(input: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = input.trim().split(/\s+/)
  return { firstName, lastName: rest.join(' ') }
}

@Injectable()
export class PublicLeadsService {
  private readonly logger = new Logger(PublicLeadsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly automations: AutomationRunnerService,
  ) {}

  private async resolveTenantId(): Promise<string> {
    const id = process.env.PUBLIC_LEAD_TENANT_ID?.trim()
    const slug = process.env.PUBLIC_LEAD_TENANT_SLUG?.trim()

    if (!id && !slug) {
      this.logger.error(
        'Public lead form is not configured: set PUBLIC_LEAD_TENANT_ID or PUBLIC_LEAD_TENANT_SLUG',
      )
      throw new ServiceUnavailableException('הטופס אינו זמין כרגע')
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: id ? { id } : { slug },
      select: { id: true, isActive: true },
    })
    if (!tenant?.isActive) {
      this.logger.error('Public lead destination tenant is missing or inactive')
      throw new ServiceUnavailableException('הטופס אינו זמין כרגע')
    }
    return tenant.id
  }

  private spamVerdict(dto: PublicLeadDto): SpamVerdict {
    if (dto.company?.trim()) return 'HONEYPOT'
    const elapsed = Date.now() - Date.parse(dto.renderedAt)
    if (elapsed < MIN_TIME_ON_FORM_MS) return 'TOO_FAST'
    if (elapsed > MAX_TIME_ON_FORM_MS) return 'STALE_TIMESTAMP'
    return null
  }

  private async findMatchedBuilding(
    tenantId: string,
    dto: PublicLeadDto,
  ): Promise<string | null> {
    if (dto.kind !== 'ELIGIBILITY' || !dto.address) return null
    const building = await this.prisma.building.findFirst({
      where: {
        address: { equals: dto.address, mode: 'insensitive' },
        ...(dto.city ? { city: { equals: dto.city, mode: 'insensitive' as const } } : {}),
        complex: { project: { tenantId } },
      },
      select: { id: true },
    })
    return building?.id ?? null
  }

  private async findPossibleDuplicate(
    tenantId: string,
    dto: PublicLeadDto,
    phone: string,
  ): Promise<string | null> {
    const candidates: Prisma.LeadWhereInput[] = [{ phone }]
    if (dto.email) candidates.push({ email: { equals: dto.email, mode: 'insensitive' } })
    if (dto.address) {
      candidates.push({
        address: { equals: dto.address, mode: 'insensitive' },
        ...(dto.city ? { city: { equals: dto.city, mode: 'insensitive' } } : {}),
      })
    }

    const duplicate = await this.prisma.lead.findFirst({
      where: { tenantId, OR: candidates },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    return duplicate?.id ?? null
  }

  async submit(dto: PublicLeadDto, ctx: PublicLeadContext): Promise<void> {
    const tenantId = await this.resolveTenantId()

    const verdict = this.spamVerdict(dto)
    if (verdict) {
      await this.audit.recordAnonymous(
        tenantId,
        { ip: ctx.ip, userAgent: ctx.userAgent },
        {
          action: 'CREATE',
          entity: 'PublicLeadSubmission',
          entityId: null,
          metadata: { outcome: 'DISCARDED', reason: verdict, source: 'WEBSITE' },
        },
      )
      this.logger.warn(`Public lead discarded: ${verdict}`)
      return
    }

    const replay = await this.prisma.lead.findUnique({
      where: { tenantId_submissionId: { tenantId, submissionId: dto.submissionId } },
      select: { id: true },
    })
    if (replay) return

    const phone = normalizePhone(dto.phone)
    const [matchedBuildingId, possibleDuplicateOfId] = await Promise.all([
      this.findMatchedBuilding(tenantId, dto),
      this.findPossibleDuplicate(tenantId, dto, phone),
    ])
    const { firstName, lastName } = splitFullName(dto.fullName)

    let lead: { id: string }
    try {
      lead = await this.prisma.$transaction(async (tx) => {
        const created = await tx.lead.create({
          data: {
            tenantId,
            firstName,
            lastName,
            phone,
            email: dto.email?.toLowerCase() ?? null,
            address: dto.address ?? null,
            city: dto.city ?? null,
            formType: dto.kind,
            submissionId: dto.submissionId,
            estimatedUnits: dto.estimatedUnits ?? null,
            leadType: dto.leadType ?? null,
            projectType: dto.projectType ?? null,
            organizingStatus: dto.organizingStatus ?? null,
            consentContact: true,
            consentPrivacy: true,
            consentRecordedAt: new Date(),
            privacyPolicyVersion: dto.privacyPolicyVersion,
            utmSource: dto.utmSource ?? null,
            utmMedium: dto.utmMedium ?? null,
            utmCampaign: dto.utmCampaign ?? null,
            matchedBuildingId,
            possibleDuplicateOfId,
            source: 'WEBSITE',
            status: 'NEW',
            language: dto.locale,
            notes: dto.message ?? null,
            tags: possibleDuplicateOfId ? ['possible-duplicate'] : [],
          },
          select: { id: true },
        })

        await tx.leadActivity.create({
          data: {
            leadId: created.id,
            type: 'public_form_submission',
            note: 'ליד נוצר מטופס באתר השיווקי',
            metadata: {
              formType: dto.kind,
              sourcePage: dto.sourcePage,
              submittedAt: dto.submittedAt,
              estimatedUnits: dto.estimatedUnits ?? null,
              leadType: dto.leadType ?? null,
              projectType: dto.projectType ?? null,
              organizingStatus: dto.organizingStatus ?? null,
              utmSource: dto.utmSource ?? null,
              utmMedium: dto.utmMedium ?? null,
              utmCampaign: dto.utmCampaign ?? null,
              consentContact: true,
              consentPrivacy: true,
              privacyPolicyVersion: dto.privacyPolicyVersion,
              matchedBuildingId,
              possibleDuplicateOfId,
            },
            createdById: null,
          },
        })

        await this.audit.recordAnonymous(
          tenantId,
          { ip: ctx.ip, userAgent: ctx.userAgent },
          {
            action: 'CREATE',
            entity: 'Lead',
            entityId: created.id,
            metadata: {
              outcome: 'CREATED',
              source: 'WEBSITE',
              channel: 'public-marketing-form',
              formType: dto.kind,
              possibleDuplicate: Boolean(possibleDuplicateOfId),
            },
          },
          tx,
        )
        return created
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // A concurrent retry won the unique (tenantId, submissionId) race.
        return
      }
      throw error
    }

    await this.automations.dispatch({
      trigger: 'LEAD_CREATED',
      tenantId,
      subjectId: lead.id,
      context: {
        leadFirstName: firstName,
        leadLastName: lastName,
        leadCity: dto.city ?? '',
        leadSource: 'WEBSITE',
      },
    })
  }
}
