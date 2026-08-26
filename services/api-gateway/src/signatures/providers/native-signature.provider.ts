/**
 * NativeSignatureProvider — production implementation for UROS.
 *
 * Implements the SignatureProvider interface using the existing OTP-based
 * signing workflow (SMS OTP → verified session → signed record).
 *
 * Under Israeli Electronic Signature Law (חוק חתימה אלקטרונית, 2001) this
 * constitutes a "regular electronic signature" because:
 *   1. The signer is identified by their registered phone number.
 *   2. A 6-digit OTP sent to that phone and verified by the server proves
 *      possession of the device.
 *   3. The full audit trail (IP, timestamp, OTP hash, device fingerprint) is
 *      stored immutably in the SignatureEvent log.
 *
 * To upgrade to "advanced" or "certified" level, swap in ComSign or DocuSign
 * by implementing this same interface and pointing the factory to the new class.
 */

import { createHmac, createHash } from 'crypto'
import {
  SignatureProvider,
  SignatureProviderResult,
  SignerStatus,
} from './signature-provider.interface'
import { Logger } from '@nestjs/common'

export class NativeSignatureProvider implements SignatureProvider {
  readonly name = 'NATIVE'
  private readonly logger = new Logger('NativeSignatureProvider')

  async createEnvelope(opts: {
    tenantId: string
    documentBuffer: Buffer
    documentName: string
    documentHash: string
    signers: Array<{ id: string; name: string; email?: string; phone: string; role: string; order: number }>
    expiresAt?: Date
    webhookUrl?: string
  }): Promise<SignatureProviderResult> {
    // Native provider: envelope = the SignaturePackage itself.
    // Signing sessions are issued separately by SigningSessionService.
    // externalId is the tenantId-scoped document hash — stable, deterministic.
    const envelopeId = `native_${opts.tenantId}_${opts.documentHash.slice(0, 16)}`
    this.logger.log(`[NATIVE] Created envelope ${envelopeId} for ${opts.signers.length} signer(s)`)
    return {
      externalId:   envelopeId,
      signingUrl:   undefined, // Signers use their token-based portal URL
      documentHash: opts.documentHash,
    }
  }

  async getSignerStatuses(_externalId: string): Promise<SignerStatus[]> {
    // Native provider: status is read directly from SignatureRecord in DB.
    // This method is a no-op for NATIVE; the controller reads DB directly.
    return []
  }

  async voidEnvelope(_externalId: string, _reason: string): Promise<void> {
    // Native: voiding = cancelling the SignaturePackage via state machine.
    // Handled by SignaturePackageService.cancel().
  }

  async downloadSignedDocument(_externalId: string): Promise<Buffer> {
    // Native: the original document + evidence JSON constitute the signed record.
    // Downloading from S3 is handled by StorageService.getSignedUrl().
    throw new Error('Use StorageService.getSignedUrl() to download documents in NATIVE mode')
  }

  validateWebhookSignature(payload: Buffer, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    return expected === signature
  }

  async parseWebhookEvent(payload: Buffer) {
    const body = JSON.parse(payload.toString('utf-8'))
    return {
      externalId: body.externalId ?? '',
      eventType:  body.eventType ?? 'UNKNOWN',
      signerId:   body.signerId,
      timestamp:  body.timestamp ? new Date(body.timestamp) : new Date(),
    }
  }

  /** Hash a document buffer to sha256 hex */
  static hashDocument(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }
}
