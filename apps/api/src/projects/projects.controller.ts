import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  addProjectMemberSchema,
  createDeliverableSchema,
  createMilestoneSchema,
  createPhaseSchema,
  createProjectSchema,
  createTaskSchema,
  reorderPhasesSchema,
  updateMilestoneSchema,
  updatePhaseSchema,
  updateProjectMemberSchema,
  updateProjectSchema,
  type AddProjectMemberInput,
  type CreateDeliverableInput,
  type CreateMilestoneInput,
  type CreatePhaseInput,
  type CreateProjectInput,
  type CreateTaskInput,
  type ReorderPhasesInput,
  type UpdateMilestoneInput,
  type UpdatePhaseInput,
  type UpdateProjectMemberInput,
  type UpdateProjectInput,
} from "@clientos/shared";
import { ProjectsService } from "./projects.service";
import { TasksService } from "./tasks.service";
import { DeliverablesService } from "./deliverables.service";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
    private readonly deliverablesService: DeliverablesService,
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

  // -----------------------------------------------------------------------
  // Phases
  // -----------------------------------------------------------------------

  @Get(":id/phases")
  @RequirePermission("view", "project")
  listPhases(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.projectsService.listPhases(tenant.organizationId, id);
  }

  @Post(":id/phases")
  @RequirePermission("edit", "project")
  addPhase(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createPhaseSchema)) body: CreatePhaseInput,
  ) {
    return this.projectsService.addPhase(tenant.organizationId, tenant.userId, id, body);
  }

  @Patch(":id/phases/:phaseId")
  @RequirePermission("edit", "project")
  updatePhase(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("phaseId") phaseId: string,
    @Body(new ZodValidationPipe(updatePhaseSchema)) body: UpdatePhaseInput,
  ) {
    return this.projectsService.updatePhase(tenant.organizationId, tenant.userId, id, phaseId, body);
  }

  @Delete(":id/phases/:phaseId")
  @RequirePermission("edit", "project")
  deletePhase(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Param("phaseId") phaseId: string) {
    return this.projectsService.deletePhase(tenant.organizationId, tenant.userId, id, phaseId);
  }

  @Patch(":id/phases-order")
  @RequirePermission("edit", "project")
  reorderPhases(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reorderPhasesSchema)) body: ReorderPhasesInput,
  ) {
    return this.projectsService.reorderPhases(tenant.organizationId, tenant.userId, id, body);
  }

  // -----------------------------------------------------------------------
  // Milestones
  // -----------------------------------------------------------------------

  @Patch(":id/milestones/:milestoneId")
  @RequirePermission("edit", "project")
  updateMilestone(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("milestoneId") milestoneId: string,
    @Body(new ZodValidationPipe(updateMilestoneSchema)) body: UpdateMilestoneInput,
  ) {
    return this.projectsService.updateMilestone(tenant.organizationId, tenant.userId, id, milestoneId, body);
  }

  @Delete(":id/milestones/:milestoneId")
  @RequirePermission("edit", "project")
  deleteMilestone(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("milestoneId") milestoneId: string,
  ) {
    return this.projectsService.deleteMilestone(tenant.organizationId, tenant.userId, id, milestoneId);
  }

  // -----------------------------------------------------------------------
  // Members (assignments)
  // -----------------------------------------------------------------------

  @Get(":id/members")
  @RequirePermission("view", "project")
  listMembers(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.projectsService.listMembers(tenant.organizationId, id);
  }

  @Post(":id/members")
  @RequirePermission("manage", "project")
  addMember(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addProjectMemberSchema)) body: AddProjectMemberInput,
  ) {
    return this.projectsService.addMember(tenant.organizationId, tenant.userId, id, body);
  }

  @Patch(":id/members/:userId")
  @RequirePermission("manage", "project")
  updateMember(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(updateProjectMemberSchema)) body: UpdateProjectMemberInput,
  ) {
    return this.projectsService.updateMember(tenant.organizationId, tenant.userId, id, userId, body);
  }

  @Delete(":id/members/:userId")
  @RequirePermission("manage", "project")
  removeMember(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Param("userId") userId: string) {
    return this.projectsService.removeMember(tenant.organizationId, tenant.userId, id, userId);
  }

  // -----------------------------------------------------------------------
  // Deliverables
  // -----------------------------------------------------------------------

  @Get(":id/deliverables")
  @RequirePermission("view", "deliverable")
  listDeliverables(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.deliverablesService.listForProject(tenant.organizationId, id);
  }

  @Post(":id/deliverables")
  @RequirePermission("create", "deliverable")
  createDeliverable(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createDeliverableSchema)) body: CreateDeliverableInput,
  ) {
    return this.deliverablesService.create(tenant.organizationId, tenant.userId, id, body);
  }

  // -----------------------------------------------------------------------
  // Activity + dashboard
  // -----------------------------------------------------------------------

  @Get(":id/activity")
  @RequirePermission("view", "project")
  listActivity(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.projectsService.listActivity(tenant.organizationId, id);
  }

  @Get(":id/dashboard")
  @RequirePermission("view", "project")
  getDashboard(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.projectsService.getDashboard(tenant.organizationId, id);
  }

  @Get(":id/traceability")
  @RequirePermission("view", "deliverable")
  getTraceability(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.deliverablesService.getProjectTraceability(tenant.organizationId, id);
  }
}
