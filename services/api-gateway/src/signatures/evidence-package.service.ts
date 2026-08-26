import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import { PrismaService } from '../prisma.service'
import { StorageService } from '../storage/storage.service'
import { EvidencePdfService } from './evidence-pdf.service'

@Injectable()
export class EvidencePackageService {
  private readonly logger = new Logger(EvidencePackageService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pdfSvc: EvidencePdfService,
  ) {}

  async generate(packageId: string, tenantId: string): Promise<void> {
    const pkg = await this.prisma.signaturePackage.findFirst({
      where: { id: packageId, tenantId },
      include: {
        records: {
          include: {
            owner: { select: { id: true, fullName: true, phone: true } },
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!pkg) throw new Error('Package not found')

    const generatedAt = new Date().toISOString()

    const evidence = {
      packageId:    pkg.id,
      title:        pkg.title,
      tenantId:     pkg.tenantId,
      documentHash: pkg.documentHash,
      completedAt:  pkg.completedAt?.toISOString(),
      providerName: (pkg as any).providerName ?? 'NATIVE',
      signers: pkg.records.map(r => ({
        recordId:      r.id,
        ownerName:     r.owner?.fullName,
        ownerId:       r.ownerId,
        apartmentId:   r.apartmentId,
        signerRole:    r.signerRole,
        method:        r.method,
        required:      r.required,
        status:        r.status,
        openedAt:      r.openedAt?.toISOString(),
        signedAt:      r.signedAt?.toISOString(),
        declineReason: r.declineReason,
      })),
      auditEvents: pkg.events.map(e => ({
        type:      e.type,
        actorType: e.actorType,
        actorId:   e.actorId,
        ip:        e.ip,
        timestamp: e.createdAt.toISOString(),
        metadata:  e.metadata ? JSON.parse(e.metadata) : null,
      })),
      generatedAt,
    }

    // Compute evidence integrity hash before adding integrity block
    const evidenceJson   = JSON.stringify(evidence, null, 2)
    const evidenceBuffer = Buffer.from(evidenceJson, 'utf-8')
    const evidenceHash   = createHash('sha256').update(evidenceBuffer).digest('hex')

    // Append integrity block (after computing hash — so hash reflects the body without the block)
    ;(evidence as any).evidenceIntegrity = {
      documentHash:  pkg.documentHash,
      evidenceHash,
      generatedAt,
      hashAlgorithm: 'SHA-256',
      legalNotice:   'Technical record only. For legal use, consult an Israeli attorney.',
    }

    let s3Key: string | null = null
    try {
      s3Key = await this.storage.upload(
        tenantId,
        'signature-evidence',
        `${packageId}-evidence.json`,
        evidenceBuffer,
        'application/json',
      )
      // Update package with S3 key
      await this.prisma.signaturePackage.update({
        where: { id: packageId },
        data:  { evidencePackageKey: s3Key } as any,
      })
    } catch (err) {
      this.logger.warn(`Evidence S3 upload skipped (storage not configured): ${(err as Error).message}`)
    }

    await (this.prisma as any).signatureEvidence.upsert({
      where:  { packageId },
      create: {
        packageId,
        tenantId,
        documentHash: pkg.documentHash ?? evidenceHash,
        signedAt:     pkg.completedAt ?? new Date(),
        signers:      JSON.stringify(evidence.signers),
        auditLog:     JSON.stringify(evidence.auditEvents),
        ipAddresses:  JSON.stringify(
          [...new Set(pkg.events.filter(e => e.ip).map(e => e.ip!))]
        ),
        s3Key,
        evidenceHash,
      },
      update: {
        signers:      JSON.stringify(evidence.signers),
        auditLog:     JSON.stringify(evidence.auditEvents),
        ipAddresses:  JSON.stringify(
          [...new Set(pkg.events.filter(e => e.ip).map(e => e.ip!))]
        ),
        s3Key,
        evidenceHash,
      },
    })

    this.logger.log(`Evidence package generated for ${packageId}`)

    // Generate PDF evidence report (fire-and-forget — runs after JSON evidence is stored)
    this.pdfSvc.generateAndStore(packageId, tenantId)
      .catch(err => this.logger.error(`PDF generation failed for ${packageId}: ${(err as Error).message}`))
  }

  async getEvidence(packageId: string, tenantId: string) {
    const evidence = await (this.prisma as any).signatureEvidence.findFirst({
      where: { packageId, tenantId },
    })
    if (!evidence) return null

    // Redact internal storage keys — never expose raw S3 keys to API consumers
    const { s3Key: _s3Key, pdfBase64: _pdfBase64, pdfS3Key: _pdfS3Key, ...safeEvidence } = evidence

    return {
      ...safeEvidence,
      signers:      JSON.parse(evidence.signers),
      auditLog:     JSON.parse(evidence.auditLog),
      ipAddresses:  JSON.parse(evidence.ipAddresses),
      evidenceHash: evidence.evidenceHash ?? null,
    }
  }

  /** Returns a signed URL (or base64 fallback) for the evidence PDF. */
  async downloadEvidencePdf(packageId: string, tenantId: string): Promise<{ url?: string; base64?: string; expiresIn?: number }> {
    const ev = await (this.prisma as any).signatureEvidence.findFirst({
      where: { packageId, tenantId },
    })
    if (!ev) return {}

    if (ev.pdfS3Key) {
      try {
        const url = await this.storage.getSignedUrl(tenantId, ev.pdfS3Key, 900)
        return { url, expiresIn: 900 }
      } catch (err) {
        this.logger.warn(`Could not generate PDF signed URL: ${(err as Error).message}`)
      }
    }

    if (ev.pdfBase64) {
      return { base64: ev.pdfBase64 }
    }

    return {}
  }
}
