-- AlterTable
ALTER TABLE "meeting_attendees" ADD COLUMN     "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "rsvpStatus" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "meeting_attendees_meetingId_rsvpStatus_idx" ON "meeting_attendees"("meetingId", "rsvpStatus");

-- CreateIndex
CREATE INDEX "meetings_tenantId_startTime_idx" ON "meetings"("tenantId", "startTime");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
