import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { ProjectHealthService } from "./project-health.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [ProjectsController, TasksController],
  providers: [ProjectsService, TasksService, ProjectHealthService],
  exports: [ProjectsService, TasksService],
})
export class ProjectsModule {}
