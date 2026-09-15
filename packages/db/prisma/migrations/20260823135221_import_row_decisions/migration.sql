-- CreateEnum
CREATE TYPE "ImportDecisionAction" AS ENUM ('UPDATE_EXISTING', 'CREATE_NEW', 'SKIP');

-- CreateTable
CREATE TABLE "import_row_decisions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "action" "ImportDecisionAction" NOT NULL,
    "targetEntityId" TEXT,
    "note" TEXT,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_row_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_row_decisions_jobId_idx" ON "import_row_decisions"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "import_row_decisions_jobId_rowNumber_key" ON "import_row_decisions"("jobId", "rowNumber");

-- AddForeignKey
ALTER TABLE "import_row_decisions" ADD CONSTRAINT "import_row_decisions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_row_decisions" ADD CONSTRAINT "import_row_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
