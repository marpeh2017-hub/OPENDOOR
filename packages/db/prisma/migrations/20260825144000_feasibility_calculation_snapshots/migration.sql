-- CreateTable
CREATE TABLE "feasibility_calculation_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feasibilityProfileId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "outputSnapshot" JSONB NOT NULL,
    "validationSnapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feasibility_calculation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feasibility_calculation_snapshots_tenantId_feasibilityProfi_idx" ON "feasibility_calculation_snapshots"("tenantId", "feasibilityProfileId", "scenarioId", "createdAt");

-- AddForeignKey
ALTER TABLE "feasibility_calculation_snapshots" ADD CONSTRAINT "feasibility_calculation_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feasibility_calculation_snapshots" ADD CONSTRAINT "feasibility_calculation_snapshots_feasibilityProfileId_fkey" FOREIGN KEY ("feasibilityProfileId") REFERENCES "feasibility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feasibility_calculation_snapshots" ADD CONSTRAINT "feasibility_calculation_snapshots_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "feasibility_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
