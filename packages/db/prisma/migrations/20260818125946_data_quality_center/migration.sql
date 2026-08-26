-- CreateEnum
CREATE TYPE "DataQualitySeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "DataQualityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "DataQualityCategory" AS ENUM ('COMPLETENESS', 'ACCURACY', 'CONSISTENCY', 'INTEGRITY', 'DUPLICATION', 'TIMELINESS', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "DataQualityEntityType" AS ENUM ('PROJECT', 'COMPLEX', 'BUILDING', 'APARTMENT', 'OWNER', 'OWNER_APARTMENT', 'RESIDENT', 'SIGNATURE_PACKAGE', 'SIGNATURE_RECORD', 'DOCUMENT', 'TASK', 'MESSAGE', 'MEETING', 'LEAD', 'USER');

-- CreateEnum
CREATE TYPE "DataQualityScanScope" AS ENUM ('PROJECT', 'TENANT', 'GLOBAL');

-- CreateEnum
CREATE TYPE "DataQualityScanStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "data_quality_issues" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "entityType" "DataQualityEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "category" "DataQualityCategory" NOT NULL,
    "severity" "DataQualitySeverity" NOT NULL,
    "status" "DataQualityStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT,
    "recommendation" TEXT,
    "deepLink" TEXT,
    "metadata" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "resolutionType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_quality_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_quality_scans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" "DataQualityScanScope" NOT NULL,
    "projectId" TEXT,
    "status" "DataQualityScanStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "rulesExecuted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ruleCount" INTEGER NOT NULL DEFAULT 0,
    "entitiesScanned" INTEGER NOT NULL DEFAULT 0,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "issuesNew" INTEGER NOT NULL DEFAULT 0,
    "issuesResolved" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "triggeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_quality_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_quality_issues_tenantId_status_idx" ON "data_quality_issues"("tenantId", "status");

-- CreateIndex
CREATE INDEX "data_quality_issues_tenantId_severity_idx" ON "data_quality_issues"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "data_quality_issues_tenantId_category_idx" ON "data_quality_issues"("tenantId", "category");

-- CreateIndex
CREATE INDEX "data_quality_issues_tenantId_issueType_idx" ON "data_quality_issues"("tenantId", "issueType");

-- CreateIndex
CREATE INDEX "data_quality_issues_tenantId_projectId_status_idx" ON "data_quality_issues"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "data_quality_issues_entityType_entityId_idx" ON "data_quality_issues"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "data_quality_issues_tenantId_detectedAt_idx" ON "data_quality_issues"("tenantId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "data_quality_issues_tenantId_issueType_entityType_entityId_key" ON "data_quality_issues"("tenantId", "issueType", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "data_quality_scans_tenantId_startedAt_idx" ON "data_quality_scans"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "data_quality_scans_tenantId_projectId_idx" ON "data_quality_scans"("tenantId", "projectId");
