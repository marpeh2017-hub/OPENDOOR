// This file runs before all test suites — sets required environment variables
// before any module is imported.

// Load .env the same way main.ts does. Needed so StorageService can initialise
// its S3 client against local MinIO — without it the document-upload suite
// would silently exercise an unconfigured storage layer instead of a real one.
// `dotenv` never overrides variables that are already set, so an explicit
// environment (e.g. CI) still wins.

require('dotenv/config')

process.env.NODE_ENV   = 'test'
process.env.MESSAGING_SIMULATE = 'true'
// Integration tests must never select a real OTP transport from a local .env.
for (const key of ['VONAGE_API_KEY', 'TWILIO_ACCOUNT_SID', 'INFORU_USERNAME']) {
  delete process.env[key]
}
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-e2e-only'

// Local dev/test runs against PostgreSQL (matches production architecture).
export const DEV_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os?schema=public'

/**
 * ── RUNNING TWO TEST PROCESSES AT ONCE ──────────────────────────────────────
 *
 * `TEST_DATABASE_URL` points the whole suite at a different database.
 *
 * This exists because more than one tool works in this repository, and every
 * suite here is DESTRUCTIVE by design: each purges by tenant slug in `beforeAll`
 * and `afterAll`, and several delete by title prefix or by `createdAt` window.
 * Two runs against one database interleave those purges, and the result is a
 * phantom failure in whichever run lost the race — an assertion that fails for
 * reasons entirely outside the code under test. That has already happened here
 * and cost real debugging time.
 *
 * It is opt-in rather than automatic: silently inventing a database name would
 * mean a developer runs migrations against one database and tests against
 * another, and then cannot understand why a new column "does not exist".
 *
 *   # one-time
 *   createdb urban_renewal_os_test          # or CREATE DATABASE via psql
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/urban_renewal_os_test?schema=public \
 *     pnpm --filter @urban-renewal/db db:deploy
 *
 *   # every run thereafter
 *   TEST_DATABASE_URL=...urban_renewal_os_test?schema=public pnpm test
 *
 * NOTE: this isolates PostgreSQL only. Redis and MinIO are still shared, so two
 * concurrent runs can still collide on the OTP resend cap and on document
 * objects. Those are far rarer, and fixing them needs a key prefix and a bucket
 * prefix respectively — worth doing if this becomes a routine workflow.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
} else if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = DEV_DATABASE_URL
}
