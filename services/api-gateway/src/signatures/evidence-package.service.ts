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

    /*
     * How each signer was authenticated, from the SIGNED event of their record.
     *
     * `SignatureRecord.ownerId` already says whose signature a record is. What
     * the evidence never said was who was authenticated when it was made — a
     * signature by somebody holding a link and a signature by somebody who had
     * proved their identity to the portal looked identical.
     *
     * Read from the event rather than stored a second time on the record: the
     * event is the contemporaneous account of what happened, and duplicating it
     * would create two places for the same fact to disagree.
     */
    const authenticationByRecord = new Map<string, Record<string, unknown>>()
    for (const event of pkg.events) {
      if (event.type !== 'SIGNED' || !event.recordId || !event.metadata) continue
      try {
        const meta = JSON.parse(event.metadata) as Record<string, unknown>
        if (meta.viaPortalSession) authenticationByRecord.set(event.recordId, meta)
      } catch {
        // A malformed metadata blob must not stop an evidence package being
        // generated — the package is the thing somebody needs in a dispute.
      }
    }

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
        /**
         * How this signature was authenticated.
         *
         * `TOKEN_AND_OTP` for every signature made by opening the emailed or
         * texted link — which is every signature made before this field
         * existed, and every one made by a resident who is not signed in.
         *
         * `PORTAL_SESSION_AND_TOKEN` additionally means the signer held a live
         * authenticated portal session, and `residentMatchesOwner` says whether
         * that session belonged to the resident linked to this owner.
         */
        authentication: authenticationOf(authenticationByRecord.get(r.id)),
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

/**
 * Describes how one signature was authenticated, for the evidence package.
 *
 * A record with no portal attribution reports `TOKEN_AND_OTP` — which is the
 * truth for it, and is what every signature made before this existed was. It
 * does NOT report "unknown": the token-and-OTP path is a known, deliberate
 * method, not an absence of information.
 */
export function authenticationOf(meta?: Record<string, unknown>) {
  if (!meta?.viaPortalSession) {
    return { method: 'TOKEN_AND_OTP' as const }
  }
  return {
    method: 'PORTAL_SESSION_AND_TOKEN' as const,
    sessionResidentId: meta.sessionResidentId ?? null,
    /**
     * Whether the authenticated resident is the one linked to this owner.
     * `false` is a real and ordinary outcome — a couple sharing a handset —
     * and is recorded rather than hidden, because an evidence package that
     * implied an identity match which did not occur would be worse than one
     * that says nothing.
     */
    residentMatchesOwner: meta.sessionMatchesOwner === true,
  }
}
