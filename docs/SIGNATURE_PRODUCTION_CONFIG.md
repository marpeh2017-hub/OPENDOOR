# Signature System — Production Configuration

## Required (all environments)
| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| JWT_SECRET | Minimum 32 chars, random |
| FIELD_ENCRYPTION_KEY | 32-byte hex, for nationalId encryption |
| REDIS_URL | Redis for OTP storage and session revocation |

## Required in production
| Variable | Description |
|----------|-------------|
| PORTAL_URL | Base URL of the resident portal (e.g. https://portal.opendoor.co.il) |
| NODE_ENV=production | Enables production mode |

## SMS Provider (one required in production)
| Variable | Description |
|----------|-------------|
| VONAGE_API_KEY + VONAGE_API_SECRET | Vonage (Nexmo) SMS |
| TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM | Twilio SMS |
| INFORU_USERNAME + INFORU_API_KEY | InfoRu (Israeli) SMS |

## Storage (optional but strongly recommended)
| Variable | Description |
|----------|-------------|
| S3_ENDPOINT | S3-compatible endpoint (Cloudflare R2, AWS S3) |
| S3_ACCESS_KEY | Access key |
| S3_SECRET_KEY | Secret key |
| S3_BUCKET | Bucket name |
| S3_REGION | Region (default: auto) |

Without S3, evidence PDFs are stored as base64 in the database. This is not recommended for production.

## Signature Provider (optional — native OTP is default)
| Variable | Description |
|----------|-------------|
| COMSIGN_API_KEY | Enables ComSign provider |
| COMSIGN_SIGNER_ID | ComSign signer identity |
| COMSIGN_WEBHOOK_SECRET | Required if COMSIGN_API_KEY is set |
| DOCUSIGN_CLIENT_ID | Enables DocuSign provider |
| DOCUSIGN_CLIENT_SECRET | DocuSign client secret |
| DOCUSIGN_ACCOUNT_ID | DocuSign account ID |
| DOCUSIGN_HMAC_KEY | Required if DOCUSIGN_CLIENT_ID is set |

## OTP Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| OTP_LENGTH | OTP digit count | 6 |
| OTP_TTL_SECONDS | OTP validity window | 300 (5 min) |
| OTP_MAX_ATTEMPTS | Max incorrect attempts | 5 |
| OTP_RATE_LIMIT_HOUR | Max OTP requests per phone/hour | 3 |

## Security
| Variable | Description |
|----------|-------------|
| SIGNING_TOKEN_BYTES | Bytes for token generation | 48 |
| SIGNING_SESSION_TTL_DAYS | Session validity | 7 |
