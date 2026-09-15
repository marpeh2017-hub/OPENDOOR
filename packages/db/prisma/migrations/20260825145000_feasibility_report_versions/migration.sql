-- CreateTable
CREATE TABLE "feasibility_report_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feasibilityProfileId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "FeasibilityProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feasibility_report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feasibility_report_versions_snapshotId_key" ON "feasibility_report_versions"("snapshotId");

-- CreateIndex
CREATE INDEX "feasibility_report_versions_tenantId_feasibilityProfileId_s_idx" ON "feasibility_report_versions"("tenantId", "feasibilityProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "feasibility_report_versions_feasibilityProfileId_version_key" ON "feasibility_report_versions"("feasibilityProfileId", "version");

-- AddForeignKey
ALTER TABLE "feasibility_report_versions" ADD CONSTRAINT "feasibility_report_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feasibility_report_versions" ADD CONSTRAINT "feasibility_report_versions_feasibilityProfileId_fkey" FOREIGN KEY ("feasibilityProfileId") REFERENCES "feasibility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feasibility_report_versions" ADD CONSTRAINT "feasibility_report_versions_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "feasibility_calculation_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
