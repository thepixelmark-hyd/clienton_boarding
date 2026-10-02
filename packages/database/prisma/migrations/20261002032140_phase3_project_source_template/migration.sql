-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "sourceTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "project_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
