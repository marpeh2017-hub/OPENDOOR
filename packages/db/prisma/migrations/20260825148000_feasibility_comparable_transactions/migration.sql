CREATE TABLE "comparable_transactions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "feasibilityProfileId" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "transactionPrice" DECIMAL(18,2) NOT NULL,
  "saleableAreaSqm" DECIMAL(18,4) NOT NULL,
  "rooms" DECIMAL(5,2),
  "floor" INTEGER,
  "buildingAgeYears" INTEGER,
  "condition" TEXT,
  "hasParking" BOOLEAN NOT NULL DEFAULT false,
  "balconyAreaSqm" DECIMAL(18,4),
  "storageAreaSqm" DECIMAL(18,4),
  "sourceId" TEXT,
  "sourceUrl" TEXT,
  "reliability" "FeasibilityConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "comparable_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comparable_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comparable_transactions_feasibilityProfileId_fkey" FOREIGN KEY ("feasibilityProfileId") REFERENCES "feasibility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "comparable_transactions_tenantId_feasibilityProfileId_transactionDate_idx" ON "comparable_transactions"("tenantId", "feasibilityProfileId", "transactionDate");
CREATE INDEX "comparable_transactions_feasibilityProfileId_sourceId_idx" ON "comparable_transactions"("feasibilityProfileId", "sourceId");

CREATE TABLE "comparable_adjustments" (
  "id" TEXT NOT NULL,
  "comparableTransactionId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "factor" DECIMAL(12,8) NOT NULL,
  "description" TEXT,
  "classification" "FeasibilityDataClassification" NOT NULL DEFAULT 'ASSUMPTION',
  "confidence" "FeasibilityConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "sourceId" TEXT,
  "sourceDate" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "comparable_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comparable_adjustments_comparableTransactionId_fkey" FOREIGN KEY ("comparableTransactionId") REFERENCES "comparable_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "comparable_adjustments_comparableTransactionId_category_key" ON "comparable_adjustments"("comparableTransactionId", "category");
CREATE INDEX "comparable_adjustments_comparableTransactionId_idx" ON "comparable_adjustments"("comparableTransactionId");
