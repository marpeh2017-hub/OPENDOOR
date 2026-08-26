-- Digital Zero Report / Feasibility Engine — independent scenarios and unit mix.
-- Additive only: existing feasibility source inputs are unchanged.

CREATE TYPE "FeasibilityScenarioKind" AS ENUM ('BASE', 'CONSERVATIVE', 'OPTIMISTIC', 'CUSTOM');

CREATE TABLE "feasibility_scenarios" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "feasibilityProfileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "FeasibilityScenarioKind" NOT NULL DEFAULT 'CUSTOM',
  "description" TEXT,
  "probability" DECIMAL(7,6),
  "isBaseline" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feasibility_scenarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feasibility_unit_mix_lines" (
  "id" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "rooms" DECIMAL(5,2),
  "unitCount" INTEGER NOT NULL,
  "netAreaSqm" DECIMAL(18,4),
  "grossAreaSqm" DECIMAL(18,4),
  "saleableAreaSqm" DECIMAL(18,4),
  "balconyAreaSqm" DECIMAL(18,4),
  "storageAreaSqm" DECIMAL(18,4),
  "parkingSpaces" INTEGER NOT NULL DEFAULT 0,
  "floorFrom" INTEGER,
  "floorTo" INTEGER,
  "orientation" TEXT,
  "pricePerSqm" DECIMAL(18,4),
  "fixedUnitPrice" DECIMAL(18,2),
  "balconyPricePerSqm" DECIMAL(18,4),
  "parkingPrice" DECIMAL(18,2),
  "storagePricePerSqm" DECIMAL(18,4),
  "adjustmentFactor" DECIMAL(12,8),
  "classification" "FeasibilityDataClassification" NOT NULL DEFAULT 'ASSUMPTION',
  "confidence" "FeasibilityConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "sourceId" TEXT,
  "sourceDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feasibility_unit_mix_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feasibility_scenarios_feasibilityProfileId_name_key" ON "feasibility_scenarios"("feasibilityProfileId", "name");
CREATE INDEX "feasibility_scenarios_tenantId_feasibilityProfileId_idx" ON "feasibility_scenarios"("tenantId", "feasibilityProfileId");
CREATE INDEX "feasibility_scenarios_feasibilityProfileId_kind_idx" ON "feasibility_scenarios"("feasibilityProfileId", "kind");
CREATE INDEX "feasibility_unit_mix_lines_scenarioId_idx" ON "feasibility_unit_mix_lines"("scenarioId");

ALTER TABLE "feasibility_scenarios" ADD CONSTRAINT "feasibility_scenarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feasibility_scenarios" ADD CONSTRAINT "feasibility_scenarios_feasibilityProfileId_fkey" FOREIGN KEY ("feasibilityProfileId") REFERENCES "feasibility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feasibility_unit_mix_lines" ADD CONSTRAINT "feasibility_unit_mix_lines_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "feasibility_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
