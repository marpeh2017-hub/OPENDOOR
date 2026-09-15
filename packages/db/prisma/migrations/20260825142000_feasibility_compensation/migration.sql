-- CreateEnum
CREATE TYPE "FeasibilityCompensationStatus" AS ENUM ('DRAFT', 'PROPOSED', 'AGREED', 'DISPUTED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "feasibility_compensation_lines" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "ownerApartmentId" TEXT NOT NULL,
    "status" "FeasibilityCompensationStatus" NOT NULL DEFAULT 'DRAFT',
    "replacementAreaSqm" DECIMAL(18,4),
    "additionalAreaSqm" DECIMAL(18,4),
    "balconyAreaSqm" DECIMAL(18,4),
    "parkingSpaces" INTEGER NOT NULL DEFAULT 0,
    "storageAreaSqm" DECIMAL(18,4),
    "newFloor" INTEGER,
    "replacementValue" DECIMAL(18,2),
    "parkingValue" DECIMAL(18,2),
    "storageValue" DECIMAL(18,2),
    "balconyValue" DECIMAL(18,2),
    "cashCompensation" DECIMAL(18,2),
    "monthlyRelocationRent" DECIMAL(18,2),
    "relocationMonths" INTEGER,
    "movingCost" DECIMAL(18,2),
    "temporaryHousingCost" DECIMAL(18,2),
    "legalCost" DECIMAL(18,2),
    "inspectionCost" DECIMAL(18,2),
    "otherCost" DECIMAL(18,2),
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

    CONSTRAINT "feasibility_compensation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feasibility_compensation_lines_ownerApartmentId_idx" ON "feasibility_compensation_lines"("ownerApartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "feasibility_compensation_lines_scenarioId_ownerApartmentId_key" ON "feasibility_compensation_lines"("scenarioId", "ownerApartmentId");

-- AddForeignKey
ALTER TABLE "feasibility_compensation_lines" ADD CONSTRAINT "feasibility_compensation_lines_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "feasibility_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feasibility_compensation_lines" ADD CONSTRAINT "feasibility_compensation_lines_ownerApartmentId_fkey" FOREIGN KEY ("ownerApartmentId") REFERENCES "owner_apartments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
