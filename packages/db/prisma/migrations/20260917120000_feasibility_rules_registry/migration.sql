-- Regulatory rules registry: thresholds versioned by the date they take effect.
--
-- ADDITIVE. A new type and a new table; nothing existing is altered, so no
-- current project's numbers change on apply. Until rules are entered the
-- registry is simply empty and the engine keeps using per-profile assumptions.
CREATE TYPE "FeasibilityRuleAuthority" AS ENUM (
  'STATUTE', 'REGULATION', 'MUNICIPAL_PLAN', 'BANK_GUIDANCE', 'COMPANY_STANDARD', 'MARKET_CONVENTION'
);

CREATE TABLE "feasibility_rules" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "code"            TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "authority"       "FeasibilityRuleAuthority" NOT NULL,
  "jurisdiction"    TEXT,
  "numericValue"    DECIMAL(18,6),
  "textValue"       TEXT,
  "unit"            TEXT,
  "effectiveFrom"   TIMESTAMP(3) NOT NULL,
  "effectiveUntil"  TIMESTAMP(3),
  "sourceReference" TEXT NOT NULL,
  "sourceUrl"       TEXT,
  "notes"           TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdById"     TEXT NOT NULL,
  "updatedById"     TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feasibility_rules_pkey" PRIMARY KEY ("id")
);

-- The lookup the resolver performs on every calculation: tenant + code, then
-- the newest window that started on or before the determining date.
CREATE INDEX "feasibility_rules_tenantId_code_effectiveFrom_idx"
  ON "feasibility_rules"("tenantId", "code", "effectiveFrom");

ALTER TABLE "feasibility_rules"
  ADD CONSTRAINT "feasibility_rules_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A window that ends before it starts is not a rule, it is a typo that would
-- silently never resolve. Refused at the database, not only in the service.
ALTER TABLE "feasibility_rules"
  ADD CONSTRAINT "feasibility_rules_window_ordered"
  CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom");
