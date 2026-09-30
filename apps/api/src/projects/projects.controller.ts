import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  createMilestoneSchema,
  createProjectSchema,
  createTaskSchema,
  updateProjectSchema,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type CreateTaskInput,
  type UpdateProjectInput,
} from "@clientos/shared";
import { ProjectsService } from "./projects.service";
import { TasksService } from "./tasks.service";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
  ) {}

  @Get()
  @RequirePermission("view", "project")
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
    @Query("clientId") clientId?: string,
  ) {
    return this.projectsService.list(
      tenant.organizationId,
      { page: Math.max(1, Number(page) || 1), pageSize: Math.min(100, Math.max(1, Number(pageSize) || 20)) },
      clientId,
    );
  }

  @Get(":id")
  @RequirePermission("view", "project")
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.projectsService.getOrThrow(tenant.organizationId, id);
  }

  @Post()
  @RequirePermission("create", "project")
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ) {
    return this.projectsService.create(tenant.organizationId, tenant.userId, body);
  }

  @Patch(":id")
  @RequirePermission("edit", "project")
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ) {
    return this.projectsService.update(tenant.organizationId, tenant.userId, id, body);
  }

  @Post(":id/milestones")
  @RequirePermission("edit", "project")
  addMilestone(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createMilestoneSchema)) body: CreateMilestoneInput,
  ) {
    return this.projectsService.addMilestone(tenant.organizationId, tenant.userId, id, body);
  }

  @Get(":id/tasks")
  @RequirePermission("view", "task")
  listTasks(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.tasksService.listForProject(tenant.organizationId, id);
  }

  @Post(":id/tasks")
  @RequirePermission("create", "task")
  createTask(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput,
  ) {
    return this.tasksService.create(tenant.organizationId, tenant.userId, id, body);
  }
}
