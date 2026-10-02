import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { DeliverablesController } from "./deliverables.controller";
import { DeliverablesService } from "./deliverables.service";
import { ProjectTemplatesController } from "./project-templates.controller";
import { ProjectTemplatesService } from "./project-templates.service";
import { ProjectHealthService } from "./project-health.service";
import { ProjectActivityService } from "./project-activity.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [ProjectsController, TasksController, DeliverablesController, ProjectTemplatesController],
  providers: [
    ProjectsService,
    TasksService,
    DeliverablesService,
    ProjectTemplatesService,
    ProjectHealthService,
    ProjectActivityService,
  ],
  exports: [ProjectsService, TasksService, DeliverablesService, ProjectActivityService],
})
export class ProjectsModule {}
