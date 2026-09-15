# Signature Provider Integration Guide

## Overview

The Urban Renewal OS signature module uses a provider abstraction that allows plugging in any e-signature backend (DocuSign, ComSign, SignNow, etc.) without changing the core business logic.

## Interface

Every provider must implement `SignatureProvider` from `services/api-gateway/src/signatures/providers/signature-provider.interface.ts`:

```typescript
export interface SignatureProvider {
  name: string

  // Create a signing envelope and return external ID + signing URL
  createEnvelope(opts: {
    documentBuffer: Buffer
    documentName: string
    signers: Array<{ name: string; email: string; phone: string }>
    webhookUrl?: string
  }): Promise<SignatureProviderResult>

  // Void/cancel an existing envelope by its external ID
  voidEnvelope(externalId: string): Promise<void>

  // Poll envelope status
  getStatus(externalId: string): Promise<'PENDING' | 'SIGNED' | 'DECLINED' | 'EXPIRED'>

  // Validate inbound webhook signature to confirm it came from the provider
  validateWebhookSignature(payload: Buffer, signature: string): boolean
}

export interface SignatureProviderResult {
  externalId: string   // Provider's envelope/document ID
  signingUrl: string   // Direct URL for the signer
  documentHash?: string
}
```

## Adding a New Provider

1. Create the provider file at `services/api-gateway/src/signatures/providers/<name>.provider.ts`
2. Implement all four interface methods
3. Register the provider in `SignatureProviderFactory` (select based on `SIGNATURE_PROVIDER` env var)
4. Add required environment variables to Railway / production secrets

## ComSign Integration

ComSign is the primary target for Israeli regulatory compliance.

Required environment variables:
- `COMSIGN_API_KEY` — ComSign API key
- `COMSIGN_SIGNER_ID` — Signer/account ID
- `COMSIGN_WEBHOOK_SECRET` — Shared secret for webhook HMAC verification

Stub location: `services/api-gateway/src/signatures/providers/comsign.provider.stub.ts`

The stub throws `NotImplementedException` on every call and is not registered in production. Replace it with a real implementation once ComSign credentials are obtained.

## Mock Provider (Development)

The mock provider (`mock.provider.ts`, if present) is blocked in production via an env check. Do not set `SIGNATURE_PROVIDER=MOCK` in any production or staging environment.

## Webhook Security

All webhook endpoints must:
1. Call `provider.validateWebhookSignature(rawBody, headerSignature)` before processing
2. Return HTTP 200 immediately; do async processing in a queue
3. Be idempotent (duplicate webhooks from provider retries must be safe)

## Testing

Use the mock provider in tests. Never send real envelope requests in CI.
