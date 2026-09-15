export interface SignatureProviderResult {
  externalId: string
  signingUrl?: string  // URL to redirect signer to provider UI (null for NATIVE)
  documentHash?: string
}

export interface SignerStatus {
  signerId: string
  status: 'PENDING' | 'SENT' | 'OPENED' | 'SIGNED' | 'DECLINED' | 'EXPIRED'
  signedAt?: Date
}

export interface SignatureProvider {
  readonly name: string

  createEnvelope(opts: {
    tenantId: string
    documentBuffer: Buffer
    documentName: string
    documentHash: string
    signers: Array<{
      id: string
      name: string
      email?: string
      phone: string
      role: string
      order: number
    }>
    expiresAt?: Date
    webhookUrl?: string
  }): Promise<SignatureProviderResult>

  getSignerStatuses(externalId: string): Promise<SignerStatus[]>
  voidEnvelope(externalId: string, reason: string): Promise<void>
  downloadSignedDocument(externalId: string): Promise<Buffer>
  validateWebhookSignature(payload: Buffer, signature: string, secret: string): boolean
  parseWebhookEvent(payload: Buffer): Promise<{
    externalId: string
    eventType: string
    signerId?: string
    timestamp: Date
  }>
}
