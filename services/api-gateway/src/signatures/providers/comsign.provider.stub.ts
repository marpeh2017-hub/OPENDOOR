import { NotImplementedException } from '@nestjs/common'
import {
  SignatureProvider,
  SignatureProviderResult,
  SignerStatus,
} from './signature-provider.interface'

/**
 * STUB — ComSign integration not yet implemented.
 *
 * To implement:
 *   1. Obtain ComSign API credentials (COMSIGN_API_KEY, COMSIGN_SIGNER_ID)
 *   2. Implement each method using the ComSign REST API docs
 *   3. Register in SignatureProviderFactory
 *
 * Required env vars: COMSIGN_API_KEY, COMSIGN_SIGNER_ID, COMSIGN_WEBHOOK_SECRET
 *
 * DO NOT use in production — throws on every call.
 */
export class ComSignProviderStub implements SignatureProvider {
  readonly name = 'COMSIGN'

  async createEnvelope(_opts: any): Promise<SignatureProviderResult> {
    throw new NotImplementedException('ComSign integration pending')
  }

  async getSignerStatuses(_externalId: string): Promise<SignerStatus[]> {
    throw new NotImplementedException('ComSign integration pending')
  }

  async voidEnvelope(_externalId: string, _reason: string): Promise<void> {
    throw new NotImplementedException('ComSign integration pending')
  }

  async downloadSignedDocument(_externalId: string): Promise<Buffer> {
    throw new NotImplementedException('ComSign integration pending')
  }

  validateWebhookSignature(_payload: Buffer, _signature: string, _secret: string): boolean {
    throw new NotImplementedException('ComSign integration pending')
  }

  async parseWebhookEvent(_payload: Buffer): Promise<{ externalId: string; eventType: string; signerId?: string; timestamp: Date }> {
    throw new NotImplementedException('ComSign integration pending')
  }
}
