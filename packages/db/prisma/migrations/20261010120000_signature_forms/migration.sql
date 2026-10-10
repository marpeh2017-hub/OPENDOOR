-- Digital forms on the signature tables (the representation-appointment
-- protocol first). Additive only: every column is nullable, so packages that
-- sign uploaded documents are untouched.

-- AlterTable
ALTER TABLE "signature_packages" ADD COLUMN     "formData" TEXT,
ADD COLUMN     "formType" TEXT,
ADD COLUMN     "formVersion" TEXT;

-- AlterTable
ALTER TABLE "signature_records" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveredVia" TEXT,
ADD COLUMN     "signatureImage" TEXT,
ADD COLUMN     "signerData" TEXT;

-- CreateIndex
CREATE INDEX "signature_packages_tenantId_formType_idx" ON "signature_packages"("tenantId", "formType");
