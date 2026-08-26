import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { AutomationRunnerService } from '../automations/automation-runner.service'
import { SignatureStateMachineService } from './signature-state-machine.service'
import { SigningSessionService } from './signing-session.service'
import { EvidencePackageService } from './evidence-package.service'
import { CreatePackageDto } from './dto/create-package.dto'

/**
 * `evidencePackageKey` is a raw object-storage path. It must never reach the
 * browser — downloads go through the /download endpoint, which mints a
 * short-lived signed URL server-side.
 */
function stripEvidenceKey<T extends Record<string, any>>(pkg: T): Omit<T, 'evidencePackageKey'> {
  const { evidencePackageKey: _omitted, ...safe } = pkg
  return safe
}

@Injectable()
export class SignaturePackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sm: SignatureStateMachineService,
    private readonly sessions: SigningSessionService,
    private readonly evidence: EvidencePackageService,
    private readonly automations: AutomationRunnerService,
  ) {}

  async create(dto: CreatePackageDto, userId: string, tenantId: string) {
    const pkg = await this.prisma.signaturePackage.create({
      data: {
        tenantId,
        projectId:          dto.projectId,
        title:              dto.title,
        signingOrder:       dto.signingOrder ?? 'PARALLEL',
        verificationMethod: dto.verificationMethod ?? 'SMS_OTP',
        expiresAt:          dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById:        userId,
        status:             'DRAFT',
      } as any,
      include: { records: true },
    })

    // Add initial signers from DTO if provided
    if (dto.signers?.length) {
      for (const signer of dto.signers) {
        await this.addSignerToPackage(pkg.id, signer, tenantId)
      }
    }

    await this.sm.logEvent(pkg.id, 'CREATED', { actorType: 'USER', actorId: userId })

    return this.findOne(pkg.id, tenantId)
  }

  async findAll(tenantId: string, projectId?: string) {
    const packages = await this.prisma.signaturePackage.findMany({
      where: { tenantId, ...(projectId ? { projectId } : {}) },
      include: { records: { select: { id: true, status: true, required: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return packages.map(stripEvidenceKey)
  }

  /**
   * Internal-only lookup of the raw object-storage key for the evidence
   * package. Kept separate from findAll/findOne so the storage path is never
   * part of a normal API response — callers must ask for it deliberately.
   */
  async getEvidencePackageKey(id: string, tenantId: string): Promise<string | null> {
    const pkg = await this.prisma.signaturePackage.findFirst({
      where:  { id, tenantId },
      select: { evidencePackageKey: true },
    })
    if (!pkg) throw new NotFoundException('חבילת חתימות לא נמצאה')
    return (pkg as { evidencePackageKey: string | null }).evidencePackageKey
  }

  async findOne(id: string, tenantId: string) {
    const pkg = await this.prisma.signaturePackage.findFirst({
      where: { id, tenantId },
      include: {
        records: {
          include: {
            owner: { select: { id: true, fullName: true, phone: true } },
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!pkg) throw new NotFoundException('חבילת חתימות לא נמצאה')

    // SignaturePackage has no `project` relation in the schema (projectId is a
    // plain column), so the name is resolved with one extra scoped lookup
    // rather than an include. One query per detail view — not an N+1.
    const project = await this.prisma.project.findFirst({
      where:  { id: pkg.projectId, tenantId },
      select: { id: true, name: true, code: true },
    })

    return { ...stripEvidenceKey(pkg), project }
  }

  async submitForReview(id: string, userId: string, tenantId: string) {
    await this.assertPackageAccess(id, tenantId)
    return this.sm.transition(id, 'INTERNAL_REVIEW', { actorType: 'USER', actorId: userId })
  }

  async approve(id: string, userId: string, tenantId: string) {
    await this.assertPackageAccess(id, tenantId)
    return this.sm.transition(id, 'APPROVED', {
      actorType: 'USER',
      actorId:   userId,
      eventType: 'APPROVED',
    })
  }

  /** Send — transition to SENT and issue signing sessions for all records */
  async send(id: string, userId: string, tenantId: string) {
    const pkg = await this.assertPackageAccess(id, tenantId)
    await this.sm.transition(id, 'SENT', {
      actorType: 'USER',
      actorId:   userId,
      eventType: 'SENT',
    })

    // Issue session tokens for every record
    const tokens: Record<string, string> = {}
    for (const record of pkg.records) {
      const { token } = await this.sessions.issueSession(record.id)
      tokens[record.id] = token
    }

    /**
      * Dispatched after the package is SENT and its session tokens exist.
      *
      * Deliberately does NOT carry the signing tokens in `context`: those are
      * bearer credentials that let anyone holding them sign on a resident's
      * behalf, and automation context is rendered into templates and copied
      * into audit metadata. The signing link reaches the resident through the
      * portal delivery path, which is built to handle a token safely.
      */
    await this.automations.dispatch({
      trigger: 'SIGNATURE_SENT',
      tenantId,
      projectId: pkg.projectId ?? null,
      subjectId: pkg.id,
      context: {
        packageTitle: pkg.title ?? '',
        signerCount: pkg.records.length,
      },
    })

    return { sent: true, recordTokens: tokens }
  }

  async cancel(id: string, userId: string, tenantId: string) {
    await this.assertPackageAccess(id, tenantId)
    return this.sm.transition(id, 'CANCELLED', {
      actorType: 'USER',
      actorId:   userId,
      eventType: 'CANCELLED',
    })
  }

  async getEvents(id: string, tenantId: string) {
    await this.assertPackageAccess(id, tenantId)
    return this.prisma.signatureEvent.findMany({
      where:   { packageId: id },
      orderBy: { createdAt: 'asc' },
    })
  }

  /** Add a signer to a DRAFT package */
  async addSigner(
    packageId: string,
    signerData: {
      ownerId: string
      apartmentId: string
      signerRole?: string
      required?: boolean
      signingOrder?: number
    },
    tenantId: string,
  ) {
    const pkg = await this.assertPackageAccess(packageId, tenantId)
    if (pkg.status !== 'DRAFT') {
      throw new BadRequestException('ניתן להוסיף חותמים רק לחבילה בסטטוס DRAFT')
    }
    return this.addSignerToPackage(packageId, signerData, tenantId)
  }

  private async addSignerToPackage(
    packageId: string,
    signerData: {
      ownerId: string
      apartmentId?: string
      ownerApartmentId?: string
      signerRole?: string
      required?: boolean
      signingOrder?: number
    },
    tenantId: string,
  ) {
    const apartmentId = signerData.apartmentId ?? signerData.ownerApartmentId
    if (!apartmentId) throw new BadRequestException('apartmentId נדרש')

    return this.prisma.signatureRecord.create({
      data: {
        tenantId,
        packageId,
        ownerId:      signerData.ownerId,
        apartmentId,
        signerRole:   signerData.signerRole ?? 'OWNER',
        required:     signerData.required ?? true,
        signingOrder: signerData.signingOrder ?? 0,
        status:       'PENDING',
        method:       'DIGITAL',
      },
    })
  }

  /** Remove a signer from a DRAFT package */
  async removeSigner(packageId: string, recordId: string, tenantId: string) {
    const pkg = await this.assertPackageAccess(packageId, tenantId)
    if (pkg.status !== 'DRAFT') {
      throw new BadRequestException('ניתן להסיר חותמים רק מחבילה בסטטוס DRAFT')
    }
    const record = await this.prisma.signatureRecord.findFirst({
      where: { id: recordId, packageId, tenantId },
    })
    if (!record) throw new NotFoundException('רשומת חתימה לא נמצאה')
    await this.prisma.signatureRecord.delete({ where: { id: recordId } })
    return { removed: true }
  }

  /** Get signing progress summary */
  async getSigningProgress(packageId: string, tenantId: string) {
    await this.assertPackageAccess(packageId, tenantId)
    const records = await this.prisma.signatureRecord.findMany({
      where: { packageId, tenantId },
    })
    const total    = records.length
    const required = records.filter(r => r.required).length
    const signed   = records.filter(r => r.status === 'SIGNED').length
    const signedRequired = records.filter(r => r.required && r.status === 'SIGNED').length
    const declined = records.filter(r => r.status === 'DECLINED').length
    const pending  = records.filter(r => r.status === 'PENDING').length

    return {
      total,
      required,
      signed,
      signedRequired,
      declined,
      pending,
      percentComplete: total > 0 ? Math.round((signed / total) * 100) : 0,
      requiredComplete: required > 0 ? Math.round((signedRequired / required) * 100) : 0,
      allRequiredSigned: signedRequired === required && required > 0,
    }
  }

  /** Reissue (resend) signing invitation to one signer */
  async reissueSession(packageId: string, recordId: string, tenantId: string) {
    const pkg = await this.assertPackageAccess(packageId, tenantId)
    if (!['SENT', 'PARTIALLY_SIGNED'].includes(pkg.status)) {
      throw new BadRequestException('ניתן לשלוח מחדש רק לחבילה שנשלחה')
    }
    const record = pkg.records.find(r => r.id === recordId)
    if (!record) throw new NotFoundException('רשומת חתימה לא נמצאה')
    if (record.status === 'SIGNED') throw new BadRequestException('הרשומה כבר חתומה')

    const { token } = await this.sessions.issueSession(recordId)
    await this.sm.logEvent(packageId, 'RESENT', {
      recordId,
      actorType: 'SYSTEM',
      metadata:  { action: 'reissue' },
    })
    return { token, sent: true }
  }

  /** Generate compiled evidence package after completion */
  async generateEvidencePackage(packageId: string, tenantId: string) {
    await this.assertPackageAccess(packageId, tenantId)
    await this.evidence.generate(packageId, tenantId)
    return { generated: true }
  }

  /** Retrieve compiled evidence */
  async getEvidence(packageId: string, tenantId: string) {
    await this.assertPackageAccess(packageId, tenantId)
    const ev = await this.evidence.getEvidence(packageId, tenantId)
    if (!ev) throw new NotFoundException('ראיות החתימה טרם נוצרו')
    return ev
  }

  private async assertPackageAccess(id: string, tenantId: string) {
    const pkg = await this.prisma.signaturePackage.findFirst({
      where:   { id, tenantId },
      include: { records: { select: { id: true, ownerId: true, status: true } } },
    })
    if (!pkg) throw new NotFoundException('חבילת חתימות לא נמצאה')
    return pkg
  }
}
