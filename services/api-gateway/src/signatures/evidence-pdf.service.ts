/**
 * EvidencePdfService
 *
 * Generates a PDF evidence report for a completed signature package.
 * The PDF is generated server-side using pdfkit and uploaded to S3
 * (or stored as base64 in the database if S3 is not configured).
 */
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class EvidencePdfService {
  private readonly logger = new Logger(EvidencePdfService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async generateAndStore(packageId: string, tenantId: string): Promise<void> {
    const pkg = await (this.prisma as any).signaturePackage.findFirst({
      where: { id: packageId, tenantId },
      include: {
        records: {
          include: {
            owner: { select: { id: true, fullName: true, phone: true } },
          },
          orderBy: { signingOrder: 'asc' },
        },
        events:   { orderBy: { createdAt: 'asc' } },
        evidence: true,
      },
    })
    if (!pkg) {
      this.logger.warn(`EvidencePdfService: package ${packageId} not found`)
      return
    }

    const pdfBuffer = await this.buildPdf(pkg)

    // Attempt S3 upload
    let pdfS3Key: string | null = null
    let pdfBase64: string | null = null

    try {
      pdfS3Key = await this.storage.upload(
        tenantId,
        'evidence',
        `${packageId}-evidence.pdf`,
        pdfBuffer,
        'application/pdf',
      )
      this.logger.log(`Evidence PDF uploaded to S3 for package ${packageId}`)
    } catch (err) {
      this.logger.warn(
        `S3 upload failed — storing PDF as base64 for package ${packageId}: ${(err as Error).message}`,
      )
      pdfBase64 = pdfBuffer.toString('base64')
    }

    // Update SignatureEvidence with PDF references.
    // Exactly one storage location is authoritative: when the S3 upload
    // succeeds we clear any base64 blob left over from a previous fallback,
    // so the invariant "pdfS3Key set => pdfBase64 NULL" always holds and we
    // do not retain a redundant multi-MB blob in the database.
    await (this.prisma as any).signatureEvidence.updateMany({
      where: { packageId, tenantId },
      data: pdfS3Key
        ? { pdfS3Key, pdfBase64: null }
        : { pdfBase64 },
    })
  }

  private async buildPdf(pkg: any): Promise<Buffer> {
    // Dynamic import so the module is optional at startup
    let PDFDocument: any
    try {
       
      PDFDocument = require('pdfkit')
    } catch {
      throw new Error('pdfkit is not installed — run: pnpm add pdfkit @types/pdfkit in services/api-gateway')
    }

    return new Promise((resolve, reject) => {
      const doc     = new PDFDocument({ margin: 50, size: 'A4' })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end',  () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const now   = new Date().toISOString()
      const line  = '='.repeat(55)
      const dash  = '-'.repeat(55)

      // Compute evidence hash if evidence row has one
      const evidenceHash = pkg.evidence?.evidenceHash ?? 'N/A'

      // ── Header ─────────────────────────────────────────────
      doc
        .fontSize(14).font('Helvetica-Bold')
        .text('EVIDENCE REPORT — OpenDoor Digital Signature System')
        .fontSize(10).font('Helvetica')
        .text(line)
        .moveDown(0.5)
        .text(`Evidence Package Version: 1.0`)
        .text(`Generated: ${now}`)
        .moveDown(1)

      // ── Signature Request ───────────────────────────────────
      doc
        .fontSize(11).font('Helvetica-Bold').text('SIGNATURE REQUEST')
        .fontSize(10).font('Helvetica').text(dash)
        .moveDown(0.3)

      const field = (label: string, value: string | null | undefined) => {
        doc.text(`${(label + ':').padEnd(20)} ${value ?? '—'}`)
      }

      field('ID',          pkg.id)
      field('Title',       pkg.title)
      field('Tenant ID',   pkg.tenantId)
      field('Project',     pkg.projectId)
      field('Provider',    pkg.providerName ?? 'NATIVE')
      field('Provider ID', pkg.providerEnvelopeId ?? 'N/A')
      field('Status',      pkg.status)
      field('Created',     pkg.createdAt?.toISOString())
      field('Completed',   pkg.completedAt?.toISOString())
      field('Expires',     pkg.expiresAt?.toISOString())
      doc.moveDown(1)

      // ── Document ────────────────────────────────────────────
      doc
        .fontSize(11).font('Helvetica-Bold').text('DOCUMENT')
        .fontSize(10).font('Helvetica').text(dash)
        .moveDown(0.3)

      field('Name',         pkg.title)
      field('SHA-256 Hash', pkg.documentHash ?? '—')
      doc.text(`${'Storage Key:'.padEnd(20)} [REDACTED - internal use only]`)
      doc.moveDown(1)

      // ── Signers ─────────────────────────────────────────────
      doc
        .fontSize(11).font('Helvetica-Bold').text('SIGNERS')
        .fontSize(10).font('Helvetica').text(dash)
        .moveDown(0.3)

      for (const r of pkg.records ?? []) {
        field('Order',          String(r.signingOrder + 1))
        field('Name',           r.owner?.fullName ?? r.ownerId)
        field('Role',           r.signerRole)
        field('Required',       r.required ? 'Yes' : 'No')
        field('Status',         r.status)
        field('Session Opened', r.openedAt?.toISOString())
        field('Signed At',      r.signedAt?.toISOString())
        field('Decline Reason', r.declineReason)
        doc.moveDown(0.8)
      }

      // ── Audit Events ────────────────────────────────────────
      doc
        .fontSize(11).font('Helvetica-Bold').text('AUDIT EVENTS')
        .fontSize(10).font('Helvetica').text(dash)
        .moveDown(0.3)

      for (const e of pkg.events ?? []) {
        const meta = e.metadata ? ` [${e.metadata.slice(0, 80)}]` : ''
        doc.text(
          `${e.createdAt?.toISOString()}  ${e.type}  ${e.actorType}/${e.actorId ?? 'system'}  IP: ${e.ip ?? '—'}${meta}`,
          { lineGap: 2 },
        )
      }
      doc.moveDown(1)

      // ── Evidence Integrity ──────────────────────────────────
      doc
        .fontSize(11).font('Helvetica-Bold').text('EVIDENCE INTEGRITY')
        .fontSize(10).font('Helvetica').text(dash)
        .moveDown(0.3)

      field('Evidence Generated', now)
      field('Evidence Hash',      evidenceHash)
      doc.moveDown(1)

      // ── Legal Notice ────────────────────────────────────────
      doc
        .fontSize(11).font('Helvetica-Bold').text('LEGAL NOTICE')
        .fontSize(10).font('Helvetica').text(dash)
        .moveDown(0.3)

      doc.text(
        'This document constitutes an electronic evidence record under the Israeli\n' +
        'Electronic Signature Law (חוק חתימה אלקטרונית, התשס"א-2001).\n' +
        'SMS OTP verification to the signer\'s registered phone number constitutes a\n' +
        'regular electronic signature under this law.',
        { lineGap: 3 },
      )
      doc.moveDown(0.8)
      doc.text(
        'This evidence package is a technical record. For legal validity in court or\n' +
        'regulatory proceedings, consult a qualified Israeli attorney.',
        { lineGap: 3 },
      )
      doc.moveDown(0.8)
      doc.text(
        'The document hash above reflects the SHA-256 hash of the document at time of\n' +
        'signing. OpenDoor does not certify this hash against a trusted timestamp\n' +
        'authority (RFC 3161). For certified timestamps, use an approved CA provider.',
        { lineGap: 3 },
      )

      doc.end()
    })
  }
}
