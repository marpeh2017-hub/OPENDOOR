-- ============================================================================
-- Urban Renewal OS — STANDBY ADDITIVE MIGRATION 001
-- Signature hardening columns
-- ============================================================================
--
-- STATUS: STANDBY ARTIFACT. NOT APPLIED AUTOMATICALLY. NOT REQUIRED TODAY.
--
-- This file lives OUTSIDE `prisma/migrations/` on purpose. Prisma only scans
-- `prisma/migrations/<timestamp>_<name>/migration.sql`, so `prisma migrate
-- deploy` will NEVER discover or apply this file. It must be run by hand.
--
-- ----------------------------------------------------------------------------
-- WHEN TO USE THIS FILE
-- ----------------------------------------------------------------------------
-- ONLY against an EXISTING database that was provisioned with the OLD
-- hand-authored init SQL, archived at:
--   packages/db/prisma/migrations-sqlite/20260816000000_init_postgres_handauthored.sql.bak
--
-- That old script predates the signature-hardening work. Relative to the
-- canonical schema (packages/db/prisma/schema.postgres.prisma) it is missing:
--   * signature_records."openedAt"
--   * the ENTIRE "signature_evidence" table (and therefore its
--     "evidenceHash", "pdfBase64", "pdfS3Key" columns)
--
-- DO NOT RUN THIS AGAINST A FRESH / EMPTY DATABASE.
-- The regenerated init migration
--   packages/db/prisma/migrations/20260816000000_init_postgres/migration.sql
-- already creates all of the above. A first deploy needs nothing from here.
--
-- As of this writing NO production database exists, so this file is
-- precautionary only.
--
-- ----------------------------------------------------------------------------
-- SAFETY PROPERTIES
-- ----------------------------------------------------------------------------
--   * Purely additive. No DROP, no UPDATE, no DELETE, no type changes.
--   * Every added column is NULLABLE with NO DEFAULT, so PostgreSQL performs a
--     catalog-only change and does not rewrite existing rows.
--   * Fully idempotent: safe to run repeatedly; a second run is a no-op.
--   * Wrapped in a transaction — all-or-nothing.
--
-- ----------------------------------------------------------------------------
-- HOW TO RUN
-- ----------------------------------------------------------------------------
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f packages/db/prisma/manual/001_additive_hardening_columns.sql
--
-- Take a backup first. Verify afterwards with:
--   prisma migrate diff --from-url "$DATABASE_URL" \
--     --to-schema-datamodel packages/db/prisma/schema.postgres.prisma --exit-code
--
-- ----------------------------------------------------------------------------
-- RECORDING IT IN _prisma_migrations (only if needed)
-- ----------------------------------------------------------------------------
-- If the old database has a `_prisma_migrations` row for
-- `20260816000000_init_postgres`, then after running this file the database
-- matches the regenerated init migration and NOTHING further is needed —
-- Prisma already considers that migration applied.
--
-- If instead the old database has NO `_prisma_migrations` table (raw
-- hand-applied SQL), baseline it after running this file so `migrate deploy`
-- does not try to re-create every table:
--   npx prisma migrate resolve --applied 20260816000000_init_postgres \
--     --schema=packages/db/prisma/schema.postgres.prisma
--
-- Do NOT invent a `_prisma_migrations` row for this file itself — it is not a
-- Prisma migration and has no migration directory.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. signature_records."openedAt"
--    Prisma: SignatureRecord.openedAt DateTime?  ->  TIMESTAMP(3) NULL
-- ---------------------------------------------------------------------------
ALTER TABLE "signature_records"
  ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- 2. signature_evidence
--    The old init SQL never created this table at all, so create it first
--    (IF NOT EXISTS -> no-op where it already exists), then additively ensure
--    the three hardening columns. Definition mirrors the canonical init
--    migration exactly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "signature_evidence" (
    "id"           TEXT NOT NULL,
    "packageId"    TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "signedAt"     TIMESTAMP(3) NOT NULL,
    "signers"      TEXT NOT NULL,
    "auditLog"     TEXT NOT NULL,
    "ipAddresses"  TEXT NOT NULL,
    "s3Key"        TEXT,
    "evidenceHash" TEXT,
    "pdfBase64"    TEXT,
    "pdfS3Key"     TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "signature_evidence_packageId_key"
  ON "signature_evidence"("packageId");

-- Foreign key: added only if absent (ADD CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signature_evidence_packageId_fkey'
  ) THEN
    ALTER TABLE "signature_evidence"
      ADD CONSTRAINT "signature_evidence_packageId_fkey"
      FOREIGN KEY ("packageId") REFERENCES "signature_packages"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- The three hardening columns. Redundant when the CREATE TABLE above ran, but
-- required when the table already existed in an older, narrower form.
ALTER TABLE "signature_evidence"
  ADD COLUMN IF NOT EXISTS "evidenceHash" TEXT;

ALTER TABLE "signature_evidence"
  ADD COLUMN IF NOT EXISTS "pdfBase64" TEXT;

ALTER TABLE "signature_evidence"
  ADD COLUMN IF NOT EXISTS "pdfS3Key" TEXT;

COMMIT;

-- ============================================================================
-- REVERSAL (COMMENTED OUT — DESTRUCTIVE, DATA LOSS)
-- ----------------------------------------------------------------------------
-- Dropping these columns permanently destroys signature evidence integrity
-- data. Only run after a verified backup, and never on a database that has
-- already served production signature traffic.
--
-- BEGIN;
--
-- ALTER TABLE "signature_evidence" DROP COLUMN IF EXISTS "pdfS3Key";
-- ALTER TABLE "signature_evidence" DROP COLUMN IF EXISTS "pdfBase64";
-- ALTER TABLE "signature_evidence" DROP COLUMN IF EXISTS "evidenceHash";
-- ALTER TABLE "signature_records"  DROP COLUMN IF EXISTS "openedAt";
--
-- -- Only if this file also created the table and you want it gone entirely:
-- -- DROP TABLE IF EXISTS "signature_evidence";
--
-- COMMIT;
-- ============================================================================
