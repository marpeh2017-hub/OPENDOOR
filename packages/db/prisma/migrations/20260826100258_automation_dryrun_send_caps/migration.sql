-- AlterTable
ALTER TABLE "automations" ADD COLUMN     "dryRun" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sendCapPerDay" INTEGER,
ADD COLUMN     "sendCapPerHour" INTEGER;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "automationId" TEXT;

-- CreateIndex
CREATE INDEX "messages_automationId_createdAt_idx" ON "messages"("automationId", "createdAt");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "comparable_transactions_tenantId_feasibilityProfileId_transacti" RENAME TO "comparable_transactions_tenantId_feasibilityProfileId_trans_idx";
