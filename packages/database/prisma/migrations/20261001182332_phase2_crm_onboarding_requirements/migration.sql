-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('DECISION_MAKER', 'CHAMPION', 'INFLUENCER', 'TECHNICAL_CONTACT', 'END_USER', 'BILLING', 'LEGAL', 'APPROVER', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED');

-- AlterTable
ALTER TABLE "client_portal_users" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "role" "ContactRole" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "forms" ADD COLUMN     "conflictRules" JSONB;

-- AlterTable
ALTER TABLE "requirements" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "client_onboarding_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" "OnboardingItemStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "relatedFormId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_onboarding_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" TEXT NOT NULL,
    "role" "ClientPortalRole" NOT NULL DEFAULT 'STAKEHOLDER',
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "client_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_response_files" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_response_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_versions" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "summary" TEXT,
    "readiness" "RequirementReadiness" NOT NULL,
    "missingFields" JSONB,
    "conflicts" JSONB,
    "changedById" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "metadata" JSONB,
    "provider" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_onboarding_items_clientId_idx" ON "client_onboarding_items"("clientId");

-- CreateIndex
CREATE INDEX "client_onboarding_items_organizationId_idx" ON "client_onboarding_items"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "client_onboarding_items_clientId_key_key" ON "client_onboarding_items"("clientId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "client_invitations_tokenHash_key" ON "client_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "client_invitations_organizationId_idx" ON "client_invitations"("organizationId");

-- CreateIndex
CREATE INDEX "client_invitations_clientId_idx" ON "client_invitations"("clientId");

-- CreateIndex
CREATE INDEX "client_invitations_email_idx" ON "client_invitations"("email");

-- CreateIndex
CREATE INDEX "form_response_files_responseId_idx" ON "form_response_files"("responseId");

-- CreateIndex
CREATE INDEX "requirement_versions_requirementId_idx" ON "requirement_versions"("requirementId");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_versions_requirementId_version_key" ON "requirement_versions"("requirementId", "version");

-- CreateIndex
CREATE INDEX "email_logs_organizationId_idx" ON "email_logs"("organizationId");

-- CreateIndex
CREATE INDEX "email_logs_to_idx" ON "email_logs"("to");

-- AddForeignKey
ALTER TABLE "client_onboarding_items" ADD CONSTRAINT "client_onboarding_items_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_items" ADD CONSTRAINT "client_onboarding_items_relatedFormId_fkey" FOREIGN KEY ("relatedFormId") REFERENCES "forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invitations" ADD CONSTRAINT "client_invitations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invitations" ADD CONSTRAINT "client_invitations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invitations" ADD CONSTRAINT "client_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_response_files" ADD CONSTRAINT "form_response_files_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "form_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_versions" ADD CONSTRAINT "requirement_versions_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
