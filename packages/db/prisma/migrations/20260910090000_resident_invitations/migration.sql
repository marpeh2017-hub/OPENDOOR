-- Resident portal invitations (Portal stage 1)
--
-- ADDITIVE ONLY. One new table plus its indexes and foreign keys. Nothing is
-- dropped, renamed, retyped or backfilled, so this cannot lose a row and is
-- safe to apply to a populated database.
--
-- The scope columns (tenantId … residentId) are deliberately denormalised:
-- this row is a credential, and what it grants must be legible without four
-- joins and must not change if the resident is later moved to another
-- apartment.

CREATE TABLE "resident_invitations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "apartmentId" TEXT NOT NULL,
  "residentId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "resident_invitations_pkey" PRIMARY KEY ("id")
);

-- The token is looked up by its hash, so this index is also the lookup path.
CREATE UNIQUE INDEX "resident_invitations_tokenHash_key" ON "resident_invitations"("tokenHash");
CREATE INDEX "resident_invitations_tenantId_residentId_idx" ON "resident_invitations"("tenantId", "residentId");
CREATE INDEX "resident_invitations_expiresAt_idx" ON "resident_invitations"("expiresAt");

ALTER TABLE "resident_invitations" ADD CONSTRAINT "resident_invitations_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resident_invitations" ADD CONSTRAINT "resident_invitations_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resident_invitations" ADD CONSTRAINT "resident_invitations_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resident_invitations" ADD CONSTRAINT "resident_invitations_apartmentId_fkey"
  FOREIGN KEY ("apartmentId") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resident_invitations" ADD CONSTRAINT "resident_invitations_residentId_fkey"
  FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
