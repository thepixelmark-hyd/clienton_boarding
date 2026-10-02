-- AlterTable
ALTER TABLE "deliverables" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "waitingOnClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waitingOnClientNote" TEXT;

-- CreateTable
CREATE TABLE "project_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "phases" JSONB NOT NULL,
    "milestones" JSONB NOT NULL,
    "tasks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_activity_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actorUserId" TEXT,
    "actorContactId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "project_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_templates_organizationId_idx" ON "project_templates"("organizationId");

-- CreateIndex
CREATE INDEX "project_activity_events_projectId_occurredAt_idx" ON "project_activity_events"("projectId", "occurredAt");

-- AddForeignKey
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activity_events" ADD CONSTRAINT "project_activity_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
