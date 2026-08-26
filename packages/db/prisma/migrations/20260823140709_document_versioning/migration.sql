-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "documents_tenantId_isLatest_idx" ON "documents"("tenantId", "isLatest");

-- CreateIndex
CREATE INDEX "documents_parentId_version_idx" ON "documents"("parentId", "version");
