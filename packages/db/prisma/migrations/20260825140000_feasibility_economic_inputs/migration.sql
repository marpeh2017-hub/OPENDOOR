-- CreateEnum
CREATE TYPE "FeasibilityRevenueCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'EMPLOYMENT', 'PARKING', 'STORAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "FeasibilityCostCategory" AS ENUM ('LAND', 'EXISTING_OWNER_CONSIDERATION', 'DEMOLITION', 'CONSTRUCTION', 'DEVELOPMENT', 'PLANNING', 'ARCHITECT', 'ENGINEERING', 'SUPERVISION', 'LEGAL', 'MARKETING', 'SALES', 'INSURANCE', 'TAXES', 'LEVIES', 'BETTERMENT_LEVY', 'FEES', 'FINANCING', 'GUARANTEES', 'CONTINGENCY', 'MANAGEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FeasibilityVatTreatment" AS ENUM ('VAT_EXCLUDED', 'VAT_INCLUDED', 'VAT_NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FeasibilityTimelinePhaseKind" AS ENUM ('INITIAL_FEASIBILITY', 'RESIDENT_ORGANIZATION', 'PLANNING', 'STATUTORY_APPROVALS', 'PERMIT', 'DEVELOPER_SELECTION', 'FINANCING', 'EVACUATION', 'DEMOLITION', 'CONSTRUCTION', 'MARKETING', 'SALES', 'COMPLETION', 'OCCUPANCY', 'OTHER');

-- CreateTable
CREATE TABLE "feasibility_revenue_lines" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "category" "FeasibilityRevenueCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "saleableAreaSqm" DECIMAL(18,4),
    "pricePerSqm" DECIMAL(18,4),
    "fixedUnitPrice" DECIMAL(18,2),
    "annualNoi" DECIMAL(18,2),
    "capitalizationRate" DECIMAL(12,8),
    "vatTreatment" "FeasibilityVatTreatment" NOT NULL DEFAULT 'VAT_EXCLUDED',
    "vatRate" DECIMAL(7,6),
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

    CONSTRAINT "feasibility_revenue_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feasibility_cost_lines" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "category" "FeasibilityCostCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "unitCost" DECIMAL(18,4),
    "fixedAmount" DECIMAL(18,2),
    "percentage" DECIMAL(12,8),
    "percentageBase" TEXT,
    "vatTreatment" "FeasibilityVatTreatment" NOT NULL DEFAULT 'VAT_EXCLUDED',
    "vatRate" DECIMAL(7,6),
    "escalationRate" DECIMAL(12,8),
    "contingencyRate" DECIMAL(12,8),
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

    CONSTRAINT "feasibility_cost_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feasibility_financing_assumptions" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "debtAmount" DECIMAL(18,2),
    "equityAmount" DECIMAL(18,2),
    "ltc" DECIMAL(12,8),
    "ltv" DECIMAL(12,8),
    "annualInterestRate" DECIMAL(12,8),
    "arrangementFeeRate" DECIMAL(12,8),
    "guaranteeFeeRate" DECIMAL(12,8),
    "graceMonths" INTEGER,
    "financingMonths" INTEGER,
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

    CONSTRAINT "feasibility_financing_assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feasibility_timeline_phases" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "kind" "FeasibilityTimelinePhaseKind" NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "durationMonths" INTEGER,
    "dependencyPhaseId" TEXT,
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

    CONSTRAINT "feasibility_timeline_phases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feasibility_revenue_lines_scenarioId_category_idx" ON "feasibility_revenue_lines"("scenarioId", "category");

-- CreateIndex
CREATE INDEX "feasibility_cost_lines_scenarioId_category_idx" ON "feasibility_cost_lines"("scenarioId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "feasibility_financing_assumptions_scenarioId_key" ON "feasibility_financing_assumptions"("scenarioId");

-- CreateIndex
CREATE INDEX "feasibility_timeline_phases_scenarioId_kind_idx" ON "feasibility_timeline_phases"("scenarioId", "kind");

-- AddForeignKey
ALTER TABLE "feasibility_revenue_lines" ADD CONSTRAINT "feasibility_revenue_lines_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "feasibility_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feasibility_cost_lines" ADD CONSTRAINT "feasibility_cost_lines_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "feasibility_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feasibility_financing_assumptions" ADD CONSTRAINT "feasibility_financing_assumptions_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "feasibility_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feasibility_timeline_phases" ADD CONSTRAINT "feasibility_timeline_phases_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "feasibility_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "gush_chelka_records_feasibilityProfileId_gush_chelka_subChelka_" RENAME TO "gush_chelka_records_feasibilityProfileId_gush_chelka_subChe_key";
