-- Equity tranches: the TERMS of each layer of equity, not its money.
--
-- The money already exists. A tranche's contributions are the scenario's
-- EQUITY INFLOW rows in feasibility_cash_flow_allocations, attributed to a
-- tranche through the sourceLineId column those rows already carry for exactly
-- this purpose (it points at a revenue or cost line for the other kinds). No
-- parallel cash-flow model is introduced, and nothing about an existing
-- allocation changes.
--
-- Purely additive: one new table and two new enums. A scenario with no
-- tranches computes exactly as it did before — the waterfall reports that
-- there is no structure to apply rather than inventing one.
CREATE TYPE "FeasibilityEquityTrancheKind" AS ENUM ('SENIOR', 'JUNIOR', 'SPONSOR');

CREATE TYPE "FeasibilityPreferredReturnAccrual" AS ENUM ('SIMPLE', 'COMPOUNDED');

CREATE TABLE "feasibility_equity_tranches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FeasibilityEquityTrancheKind" NOT NULL DEFAULT 'SENIOR',
    -- Lower is paid first. Not unique: two tranches may genuinely rank equally
    -- (pari passu), and the engine reports that rather than the database
    -- refusing to store a real structure.
    "priority" INTEGER NOT NULL,
    "commitment" DECIMAL(18,2),
    -- Null means this tranche has no preferred return at all, which is the
    -- ordinary shape of sponsor equity. Zero would mean a 0% hurdle, which is
    -- a different statement, so the column is nullable rather than defaulted.
    "preferredReturnRate" DECIMAL(12,8),
    "preferredReturnAccrual" "FeasibilityPreferredReturnAccrual" NOT NULL DEFAULT 'COMPOUNDED',
    "profitSharePercent" DECIMAL(12,8) NOT NULL,
    "classification" "FeasibilityDataClassification" NOT NULL DEFAULT 'ASSUMPTION',
    "confidence" "FeasibilityConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feasibility_equity_tranches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feasibility_equity_tranches_scenarioId_name_key"
    ON "feasibility_equity_tranches"("scenarioId", "name");

CREATE INDEX "feasibility_equity_tranches_scenarioId_priority_idx"
    ON "feasibility_equity_tranches"("scenarioId", "priority");

CREATE INDEX "feasibility_equity_tranches_tenantId_idx"
    ON "feasibility_equity_tranches"("tenantId");

ALTER TABLE "feasibility_equity_tranches"
    ADD CONSTRAINT "feasibility_equity_tranches_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CASCADE from the scenario: a tranche is a term of one scenario's capital
-- structure and has no meaning without it.
ALTER TABLE "feasibility_equity_tranches"
    ADD CONSTRAINT "feasibility_equity_tranches_scenarioId_fkey"
    FOREIGN KEY ("scenarioId") REFERENCES "feasibility_scenarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
