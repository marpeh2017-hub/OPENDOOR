import { Logger } from '@nestjs/common'
import {
  SignatureProvider,
  SignatureProviderResult,
  SignerStatus,
} from './signature-provider.interface'
import { randomBytes, createHash } from 'crypto'

export class MockSignatureProvider implements SignatureProvider {
  readonly name = 'MOCK'
  private readonly logger = new Logger('MockSignatureProvider')

  async createEnvelope(opts: {
    tenantId: string
    documentBuffer: Buffer
    documentName: string
    documentHash: string
    signers: Array<{ id: string; name: string; email?: string; phone: string; role: string; order: number }>
    expiresAt?: Date
    webhookUrl?: string
  }): Promise<SignatureProviderResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'MockSignatureProvider must not be used in production. Configure COMSIGN_API_KEY or DOCUSIGN_CLIENT_ID.',
      )
    }
    this.logger.warn('[MOCK] createEnvelope — not a real legal signature')
    return {
      externalId:   `mock_${randomBytes(8).toString('hex')}`,
      signingUrl:   undefined,
      documentHash: opts.documentHash || createHash('sha256').update(opts.documentBuffer ?? Buffer.from('')).digest('hex'),
    }
  }

  async getSignerStatuses(_externalId: string): Promise<SignerStatus[]> {
    return []
  }

  async voidEnvelope(_id: string, _reason: string): Promise<void> {
    this.logger.warn('[MOCK] voidEnvelope')
  }

  async downloadSignedDocument(_externalId: string): Promise<Buffer> {
    return Buffer.from('[MOCK] signed document placeholder')
  }

  validateWebhookSignature(_payload: Buffer, _signature: string, _secret: string): boolean {
    return false
  }

  async parseWebhookEvent(_payload: Buffer) {
    return {
      externalId: 'mock_unknown',
      eventType:  'UNKNOWN',
      timestamp:  new Date(),
    }
  }
}
