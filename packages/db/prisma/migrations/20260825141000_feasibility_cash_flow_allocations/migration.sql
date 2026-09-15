-- CreateEnum
CREATE TYPE "FeasibilityCashFlowDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "FeasibilityCashFlowSourceKind" AS ENUM ('REVENUE', 'COST', 'EQUITY', 'DEBT', 'OTHER');

-- CreateTable
CREATE TABLE "feasibility_cash_flow_allocations" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "direction" "FeasibilityCashFlowDirection" NOT NULL,
    "sourceKind" "FeasibilityCashFlowSourceKind" NOT NULL,
    "sourceLineId" TEXT,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
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

    CONSTRAINT "feasibility_cash_flow_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feasibility_cash_flow_allocations_scenarioId_periodStart_idx" ON "feasibility_cash_flow_allocations"("scenarioId", "periodStart");

-- CreateIndex
CREATE INDEX "feasibility_cash_flow_allocations_scenarioId_sourceKind_sou_idx" ON "feasibility_cash_flow_allocations"("scenarioId", "sourceKind", "sourceLineId");

-- AddForeignKey
ALTER TABLE "feasibility_cash_flow_allocations" ADD CONSTRAINT "feasibility_cash_flow_allocations_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "feasibility_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
