-- Digital Zero Report / Feasibility Engine — Phase 1 foundation.
-- This migration is additive. It introduces source inputs only; it does not
-- alter existing operational Project, Building, Apartment, Owner or Document
-- data, and it stores no calculated financial output.

CREATE TYPE "FeasibilityDataClassification" AS ENUM ('FACT', 'SOURCE_DATA', 'ASSUMPTION', 'CALCULATED', 'USER_OVERRIDE', 'ESTIMATE', 'NOT_AVAILABLE');
CREATE TYPE "FeasibilityConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');
CREATE TYPE "FeasibilityProjectType" AS ENUM ('TAMA_38_1', 'TAMA_38_2', 'PINUY_BINUY', 'NEW_CONSTRUCTION', 'COMBINATION', 'LAND', 'OTHER');
CREATE TYPE "FeasibilityReportType" AS ENUM ('PRELIMINARY', 'ZERO_REPORT', 'VALUATION_MEMO', 'INTERNAL_FEASIBILITY');
CREATE TYPE "FeasibilityProfileStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'LOCKED');
CREATE TYPE "PlanningRightStatus" AS ENUM ('EXISTING', 'APPROVED', 'PROPOSED', 'PENDING', 'ASSUMED', 'UNCERTAIN');
CREATE TYPE "FeasibilityAreaType" AS ENUM ('REGISTERED', 'MEASURED', 'PLANNING', 'MAIN', 'SERVICE', 'GROSS', 'SALEABLE', 'MARKETING', 'BALCONY', 'GARDEN', 'ROOF', 'PARKING', 'STORAGE', 'COMMERCIAL', 'COMMON');
CREATE TYPE "FeasibilitySourceType" AS ENUM ('TABU', 'PLANNING', 'APPRAISAL', 'TRANSACTION', 'CONTRACTOR_QUOTE', 'GOVERNMENT', 'USER', 'MARKET_RESEARCH', 'OTHER');

CREATE TABLE "feasibility_profiles" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "projectType" "FeasibilityProjectType" NOT NULL,
  "reportType" "FeasibilityReportType" NOT NULL DEFAULT 'ZERO_REPORT',
  "status" "FeasibilityProfileStatus" NOT NULL DEFAULT 'DRAFT',
  "purpose" TEXT NOT NULL,
  "valuationDate" TIMESTAMP(3) NOT NULL,
  "reportDate" TIMESTAMP(3) NOT NULL,
  "clientName" TEXT,
  "developerName" TEXT,
  "appraiserName" TEXT,
  "neighborhood" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feasibility_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gush_chelka_records" (
  "id" TEXT NOT NULL,
  "feasibilityProfileId" TEXT NOT NULL,
  "gush" TEXT NOT NULL,
  "chelka" TEXT NOT NULL,
  "subChelka" TEXT,
  "landAreaSqm" DECIMAL(18,4),
  "address" TEXT,
  "notes" TEXT,
  "classification" "FeasibilityDataClassification" NOT NULL DEFAULT 'FACT',
  "confidence" "FeasibilityConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "sourceId" TEXT,
  "sourceDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gush_chelka_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feasibility_sources" (
  "id" TEXT NOT NULL,
  "feasibilityProfileId" TEXT NOT NULL,
  "type" "FeasibilitySourceType" NOT NULL,
  "title" TEXT NOT NULL,
  "issuer" TEXT,
  "sourceDate" TIMESTAMP(3),
  "documentId" TEXT,
  "sourceUrl" TEXT,
  "pageReference" TEXT,
  "extractedValue" TEXT,
  "notes" TEXT,
  "reliability" "FeasibilityConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feasibility_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feasibility_assumptions" (
  "id" TEXT NOT NULL,
  "feasibilityProfileId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" DECIMAL(24,8),
  "textValue" TEXT,
  "unit" TEXT,
  "classification" "FeasibilityDataClassification" NOT NULL DEFAULT 'ASSUMPTION',
  "confidence" "FeasibilityConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "sourceId" TEXT,
  "sourceDate" TIMESTAMP(3),
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "impact" TEXT,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feasibility_assumptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feasibility_area_lines" (
  "id" TEXT NOT NULL,
  "feasibilityProfileId" TEXT NOT NULL,
  "areaType" "FeasibilityAreaType" NOT NULL,
  "label" TEXT,
  "valueSqm" DECIMAL(18,4) NOT NULL,
  "classification" "FeasibilityDataClassification" NOT NULL DEFAULT 'FACT',
  "confidence" "FeasibilityConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "sourceId" TEXT,
  "sourceDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feasibility_area_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "planning_rights" (
  "id" TEXT NOT NULL,
  "feasibilityProfileId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" "PlanningRightStatus" NOT NULL,
  "areaSqm" DECIMAL(18,4),
  "unitCount" INTEGER,
  "floorLimit" INTEGER,
  "heightMeters" DECIMAL(10,2),
  "planNumber" TEXT,
  "landUse" TEXT,
  "classification" "FeasibilityDataClassification" NOT NULL DEFAULT 'SOURCE_DATA',
  "confidence" "FeasibilityConfidence" NOT NULL DEFAULT 'UNKNOWN',
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "sourceId" TEXT,
  "sourceDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planning_rights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feasibility_profiles_projectId_key" ON "feasibility_profiles"("projectId");
CREATE INDEX "feasibility_profiles_tenantId_status_idx" ON "feasibility_profiles"("tenantId", "status");
CREATE UNIQUE INDEX "gush_chelka_records_feasibilityProfileId_gush_chelka_subChelka_key" ON "gush_chelka_records"("feasibilityProfileId", "gush", "chelka", "subChelka");
CREATE INDEX "gush_chelka_records_feasibilityProfileId_idx" ON "gush_chelka_records"("feasibilityProfileId");
CREATE INDEX "feasibility_sources_feasibilityProfileId_type_idx" ON "feasibility_sources"("feasibilityProfileId", "type");
CREATE INDEX "feasibility_sources_feasibilityProfileId_documentId_idx" ON "feasibility_sources"("feasibilityProfileId", "documentId");
CREATE UNIQUE INDEX "feasibility_assumptions_feasibilityProfileId_key_key" ON "feasibility_assumptions"("feasibilityProfileId", "key");
CREATE INDEX "feasibility_assumptions_feasibilityProfileId_classification_idx" ON "feasibility_assumptions"("feasibilityProfileId", "classification");
CREATE INDEX "feasibility_area_lines_feasibilityProfileId_areaType_idx" ON "feasibility_area_lines"("feasibilityProfileId", "areaType");
CREATE INDEX "planning_rights_feasibilityProfileId_status_idx" ON "planning_rights"("feasibilityProfileId", "status");

ALTER TABLE "feasibility_profiles" ADD CONSTRAINT "feasibility_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feasibility_profiles" ADD CONSTRAINT "feasibility_profiles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gush_chelka_records" ADD CONSTRAINT "gush_chelka_records_feasibilityProfileId_fkey" FOREIGN KEY ("feasibilityProfileId") REFERENCES "feasibility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feasibility_sources" ADD CONSTRAINT "feasibility_sources_feasibilityProfileId_fkey" FOREIGN KEY ("feasibilityProfileId") REFERENCES "feasibility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feasibility_assumptions" ADD CONSTRAINT "feasibility_assumptions_feasibilityProfileId_fkey" FOREIGN KEY ("feasibilityProfileId") REFERENCES "feasibility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feasibility_area_lines" ADD CONSTRAINT "feasibility_area_lines_feasibilityProfileId_fkey" FOREIGN KEY ("feasibilityProfileId") REFERENCES "feasibility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planning_rights" ADD CONSTRAINT "planning_rights_feasibilityProfileId_fkey" FOREIGN KEY ("feasibilityProfileId") REFERENCES "feasibility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
