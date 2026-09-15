-- CreateEnum
CREATE TYPE "CmsContentKind" AS ENUM ('PAGE', 'PROJECT', 'ARTICLE', 'FAQ_ITEM', 'NAVIGATION', 'SETTINGS');

-- CreateEnum
CREATE TYPE "CmsPublicationState" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CmsRevisionReason" AS ENUM ('SAVE', 'PUBLISH', 'UNPUBLISH', 'RESTORE');

-- CreateEnum
CREATE TYPE "CmsVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'SELF_VERIFIED', 'SECOND_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "CmsVerificationEvent" AS ENUM ('EDITED', 'VERIFIED', 'INVALIDATED', 'REVIEW_REQUESTED');

-- CreateEnum
CREATE TYPE "CmsExposureLevel" AS ENUM ('PUBLIC', 'INTERNAL', 'FEASIBILITY');

-- CreateEnum
CREATE TYPE "CmsImageClaim" AS ENUM ('VERIFIED_PROJECT_PHOTO', 'EDITORIAL_CONTEXT', 'ARCHITECTURAL_PATTERN');

-- CreateTable
CREATE TABLE "cms_content" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "CmsContentKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "state" "CmsPublicationState" NOT NULL DEFAULT 'DRAFT',
    "exposure" "CmsExposureLevel" NOT NULL DEFAULT 'PUBLIC',
    "draft" JSONB NOT NULL,
    "seo" JSONB,
    "currentRevisionId" TEXT,
    "livePublicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,
    "firstPublishedAt" TIMESTAMP(3),

    CONSTRAINT "cms_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_revisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "reason" "CmsRevisionReason" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "seo" JSONB,
    "stateAtRevision" "CmsPublicationState" NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredFromRevisionId" TEXT,
    "summary" TEXT,

    CONSTRAINT "cms_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_publications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "seo" JSONB,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT NOT NULL,
    "unpublishedAt" TIMESTAMP(3),

    CONSTRAINT "cms_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_verifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "verifiedValue" JSONB,
    "status" "CmsVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "editedById" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "source" TEXT,
    "sourceReference" TEXT,

    CONSTRAINT "cms_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_verification_audit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "verificationId" TEXT,
    "field" TEXT NOT NULL,
    "event" "CmsVerificationEvent" NOT NULL,
    "status" "CmsVerificationStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousValueLabel" TEXT,
    "newValueLabel" TEXT,
    "source" TEXT,
    "sourceReference" TEXT,
    "note" TEXT,

    CONSTRAINT "cms_verification_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_media_references" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "classification" "CmsImageClaim" NOT NULL,
    "alt" JSONB NOT NULL,
    "caption" JSONB,
    "credit" TEXT,
    "takenOn" TIMESTAMP(3),
    "focalPoint" JSONB,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_media_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_content_currentRevisionId_key" ON "cms_content"("currentRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "cms_content_livePublicationId_key" ON "cms_content"("livePublicationId");

-- CreateIndex
CREATE INDEX "cms_content_tenantId_kind_state_idx" ON "cms_content"("tenantId", "kind", "state");

-- CreateIndex
CREATE INDEX "cms_content_tenantId_state_updatedAt_idx" ON "cms_content"("tenantId", "state", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cms_content_tenantId_kind_slug_key" ON "cms_content"("tenantId", "kind", "slug");

-- CreateIndex
CREATE INDEX "cms_revisions_tenantId_contentId_createdAt_idx" ON "cms_revisions"("tenantId", "contentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cms_revisions_contentId_sequence_key" ON "cms_revisions"("contentId", "sequence");

-- CreateIndex
CREATE INDEX "cms_publications_tenantId_contentId_publishedAt_idx" ON "cms_publications"("tenantId", "contentId", "publishedAt");

-- CreateIndex
CREATE INDEX "cms_verifications_tenantId_status_idx" ON "cms_verifications"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cms_verifications_contentId_field_key" ON "cms_verifications"("contentId", "field");

-- CreateIndex
CREATE INDEX "cms_verification_audit_tenantId_contentId_occurredAt_idx" ON "cms_verification_audit"("tenantId", "contentId", "occurredAt");

-- CreateIndex
CREATE INDEX "cms_verification_audit_tenantId_field_event_idx" ON "cms_verification_audit"("tenantId", "field", "event");

-- CreateIndex
CREATE INDEX "cms_media_references_tenantId_classification_idx" ON "cms_media_references"("tenantId", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "cms_media_references_contentId_field_storageKey_key" ON "cms_media_references"("contentId", "field", "storageKey");

-- AddForeignKey
ALTER TABLE "cms_content" ADD CONSTRAINT "cms_content_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_content" ADD CONSTRAINT "cms_content_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "cms_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_content" ADD CONSTRAINT "cms_content_livePublicationId_fkey" FOREIGN KEY ("livePublicationId") REFERENCES "cms_publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_content" ADD CONSTRAINT "cms_content_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_content" ADD CONSTRAINT "cms_content_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_revisions" ADD CONSTRAINT "cms_revisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_revisions" ADD CONSTRAINT "cms_revisions_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "cms_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_revisions" ADD CONSTRAINT "cms_revisions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_revisions" ADD CONSTRAINT "cms_revisions_restoredFromRevisionId_fkey" FOREIGN KEY ("restoredFromRevisionId") REFERENCES "cms_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_publications" ADD CONSTRAINT "cms_publications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_publications" ADD CONSTRAINT "cms_publications_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "cms_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_publications" ADD CONSTRAINT "cms_publications_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "cms_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_publications" ADD CONSTRAINT "cms_publications_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_verifications" ADD CONSTRAINT "cms_verifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_verifications" ADD CONSTRAINT "cms_verifications_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "cms_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_verifications" ADD CONSTRAINT "cms_verifications_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_verifications" ADD CONSTRAINT "cms_verifications_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_verification_audit" ADD CONSTRAINT "cms_verification_audit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_verification_audit" ADD CONSTRAINT "cms_verification_audit_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "cms_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_verification_audit" ADD CONSTRAINT "cms_verification_audit_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "cms_verifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_verification_audit" ADD CONSTRAINT "cms_verification_audit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_media_references" ADD CONSTRAINT "cms_media_references_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_media_references" ADD CONSTRAINT "cms_media_references_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "cms_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_media_references" ADD CONSTRAINT "cms_media_references_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
