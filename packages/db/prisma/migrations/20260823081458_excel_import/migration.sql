-- CreateEnum
CREATE TYPE "ImportEntityType" AS ENUM ('OWNER', 'RESIDENT');

-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('ADD_ONLY', 'UPDATE_ONLY', 'ADD_AND_UPDATE');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('UPLOADED', 'MAPPED', 'PREVIEWED', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportIssueSeverity" AS ENUM ('ERROR', 'WARNING');

-- CreateEnum
CREATE TYPE "ImportRowOutcome" AS ENUM ('CREATE', 'UPDATE', 'SKIP_DUPLICATE', 'SKIP_MODE', 'INVALID', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "entityType" "ImportEntityType" NOT NULL DEFAULT 'OWNER',
    "mode" "ImportMode" NOT NULL DEFAULT 'ADD_AND_UPDATE',
    "status" "ImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT,
    "sheetName" TEXT,
    "columnMapping" JSONB,
    "sheetHeaders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" JSONB,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_row_issues" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "outcome" "ImportRowOutcome" NOT NULL,
    "severity" "ImportIssueSeverity" NOT NULL DEFAULT 'ERROR',
    "field" TEXT,
    "column" TEXT,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "currentValue" TEXT,
    "suggestion" TEXT,
    "matchedEntityId" TEXT,
    "matchReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_row_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_tenantId_projectId_createdAt_idx" ON "import_jobs"("tenantId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "import_jobs_tenantId_status_idx" ON "import_jobs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "import_row_issues_jobId_rowNumber_idx" ON "import_row_issues"("jobId", "rowNumber");

-- CreateIndex
CREATE INDEX "import_row_issues_jobId_severity_idx" ON "import_row_issues"("jobId", "severity");

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row_issues" ADD CONSTRAINT "import_row_issues_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
