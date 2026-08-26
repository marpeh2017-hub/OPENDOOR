// This file runs before all test suites — sets required environment variables
// before any module is imported.

// Load .env the same way main.ts does. Needed so StorageService can initialise
// its S3 client against local MinIO — without it the document-upload suite
// would silently exercise an unconfigured storage layer instead of a real one.
// `dotenv` never overrides variables that are already set, so an explicit
// environment (e.g. CI) still wins.
 
require('dotenv/config')

process.env.NODE_ENV   = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e-only'

// Local dev/test runs against PostgreSQL (matches production architecture).
export const DEV_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = DEV_DATABASE_URL
}
