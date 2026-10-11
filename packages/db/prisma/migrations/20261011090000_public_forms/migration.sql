-- Representation protocols started on the website (buildings that are not
-- yet projects) and the rows signed through their neighbours' link. New
-- tables only.

-- CreateTable
CREATE TABLE "public_forms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "formType" TEXT NOT NULL,
    "formVersion" TEXT NOT NULL,
    "formData" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_form_signatures" (
    "id" TEXT NOT NULL,
    "publicFormId" TEXT NOT NULL,
    "apartmentNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "signatureImage" TEXT NOT NULL,
    "isInitiator" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_form_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_forms_shareToken_key" ON "public_forms"("shareToken");

-- CreateIndex
CREATE INDEX "public_forms_tenantId_createdAt_idx" ON "public_forms"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "public_forms_leadId_idx" ON "public_forms"("leadId");

-- CreateIndex
CREATE INDEX "public_form_signatures_publicFormId_idx" ON "public_form_signatures"("publicFormId");

-- AddForeignKey
ALTER TABLE "public_form_signatures" ADD CONSTRAINT "public_form_signatures_publicFormId_fkey" FOREIGN KEY ("publicFormId") REFERENCES "public_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

