-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "MessageStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "meeting_attendees" ADD COLUMN     "respondedVia" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "isSimulated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "providerName" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "notificationRetentionDays" INTEGER;

-- CreateTable
CREATE TABLE "meeting_access_tokens" (
    "id" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "firstUsedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_reminder_dispatches" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffNotified" INTEGER NOT NULL DEFAULT 0,
    "residentsQueued" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "meeting_reminder_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_access_tokens_attendeeId_key" ON "meeting_access_tokens"("attendeeId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_access_tokens_token_key" ON "meeting_access_tokens"("token");

-- CreateIndex
CREATE INDEX "meeting_access_tokens_expiresAt_idx" ON "meeting_access_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_reminder_dispatches_meetingId_offsetMinutes_key" ON "meeting_reminder_dispatches"("meetingId", "offsetMinutes");

-- CreateIndex
CREATE INDEX "meetings_status_startTime_idx" ON "meetings"("status", "startTime");

-- CreateIndex
CREATE INDEX "messages_status_nextAttemptAt_idx" ON "messages"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_tenantId_idempotencyKey_key" ON "messages"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "meeting_access_tokens" ADD CONSTRAINT "meeting_access_tokens_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "meeting_attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reminder_dispatches" ADD CONSTRAINT "meeting_reminder_dispatches_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

