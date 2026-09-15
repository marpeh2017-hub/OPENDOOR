import { Logger } from '@nestjs/common'

const log = new Logger('SignatureConfigValidator')

export function validateSignatureConfig(): void {
  const isProduction = process.env.NODE_ENV === 'production'
  if (!isProduction) return

  const errors: string[] = []

  // SMS provider (at least one required)
  const hasSms = !!(
    process.env.VONAGE_API_KEY ||
    process.env.TWILIO_ACCOUNT_SID ||
    process.env.INFORU_USERNAME
  )
  if (!hasSms) {
    errors.push('No SMS provider configured (VONAGE_API_KEY, TWILIO_ACCOUNT_SID, or INFORU_USERNAME required)')
  }

  // Portal URL (for signing links in SMS)
  if (!process.env.PORTAL_URL) {
    errors.push('PORTAL_URL is required for sending signing invitations')
  }

  // Encryption key
  if (!process.env.FIELD_ENCRYPTION_KEY) {
    errors.push('FIELD_ENCRYPTION_KEY is required')
  }

  // S3 / storage
  const hasStorage = !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY &&
    process.env.S3_SECRET_KEY &&
    process.env.S3_BUCKET
  )
  if (!hasStorage) {
    log.warn('S3 storage not configured — evidence PDFs will be stored as base64 in database only')
  }

  // Webhook secrets (warn, not error — only required if provider is configured)
  const hasComSign  = !!process.env.COMSIGN_API_KEY
  const hasDocuSign = !!process.env.DOCUSIGN_CLIENT_ID
  if (hasComSign && !process.env.COMSIGN_WEBHOOK_SECRET) {
    errors.push('COMSIGN_WEBHOOK_SECRET required when COMSIGN_API_KEY is set')
  }
  if (hasDocuSign && !process.env.DOCUSIGN_HMAC_KEY) {
    errors.push('DOCUSIGN_HMAC_KEY required when DOCUSIGN_CLIENT_ID is set')
  }

  if (errors.length > 0) {
    log.error('=== SIGNATURE SYSTEM PRODUCTION CONFIGURATION ERRORS ===')
    errors.forEach(e => log.error(`  x ${e}`))
    log.error('========================================================')
    throw new Error(`Signature system misconfigured for production: ${errors.join('; ')}`)
  }
}
