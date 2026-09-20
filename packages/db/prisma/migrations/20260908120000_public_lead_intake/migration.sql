-- Durable public-form attribution and consent. A raw enquiry is still a Lead;
-- it may point at an existing verified Building, but never creates one.
ALTER TABLE "leads"
  ADD COLUMN "formType" TEXT,
  ADD COLUMN "submissionId" TEXT,
  ADD COLUMN "estimatedUnits" INTEGER,
  ADD COLUMN "leadType" TEXT,
  ADD COLUMN "projectType" TEXT,
  ADD COLUMN "organizingStatus" TEXT,
  ADD COLUMN "consentContact" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consentPrivacy" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consentRecordedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyVersion" TEXT,
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "matchedBuildingId" TEXT,
  ADD COLUMN "possibleDuplicateOfId" TEXT;

CREATE UNIQUE INDEX "leads_tenantId_submissionId_key"
  ON "leads"("tenantId", "submissionId");
CREATE INDEX "leads_tenantId_matchedBuildingId_idx"
  ON "leads"("tenantId", "matchedBuildingId");
CREATE INDEX "leads_tenantId_possibleDuplicateOfId_idx"
  ON "leads"("tenantId", "possibleDuplicateOfId");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_matchedBuildingId_fkey"
  FOREIGN KEY ("matchedBuildingId") REFERENCES "buildings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_possibleDuplicateOfId_fkey"
  FOREIGN KEY ("possibleDuplicateOfId") REFERENCES "leads"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
