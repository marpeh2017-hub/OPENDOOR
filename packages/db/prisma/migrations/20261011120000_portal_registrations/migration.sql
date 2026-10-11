-- Requests for the personal area from people the sign-in cannot find yet,
-- waiting for staff to put them on an apartment. New table only.

-- CreateTable
CREATE TABLE "portal_registrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "idNumber" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "apartmentNumber" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "verifiedVia" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "matchedBuildingId" TEXT,
    "leadId" TEXT,
    "residentId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "submissionId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_registrations_tenantId_submissionId_key" ON "portal_registrations"("tenantId", "submissionId");

-- CreateIndex
CREATE INDEX "portal_registrations_tenantId_status_createdAt_idx" ON "portal_registrations"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "portal_registrations_tenantId_phone_idx" ON "portal_registrations"("tenantId", "phone");
