import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { createCommentSchema, updateTaskSchema, type CreateCommentInput, type UpdateTaskInput } from "@clientos/shared";
import { TasksService } from "./tasks.service";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(":id")
  @RequirePermission("view", "task")
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.tasksService.getOrThrow(tenant.organizationId, id);
  }

  @Patch(":id")
  @RequirePermission("edit", "task")
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: UpdateTaskInput,
  ) {
    return this.tasksService.update(tenant.organizationId, tenant.userId, id, body);
  }

  @Delete(":id")
  @RequirePermission("delete", "task")
  delete(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.tasksService.delete(tenant.organizationId, tenant.userId, id);
  }

  @Get(":id/comments")
  @RequirePermission("view", "task")
  listComments(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.tasksService.listComments(tenant.organizationId, id);
  }

  @Post(":id/comments")
  @RequirePermission("comment", "task")
  addComment(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createCommentSchema)) body: CreateCommentInput,
  ) {
    return this.tasksService.addComment(tenant.organizationId, tenant.userId, id, body);
  }

  @Delete(":id/comments/:commentId")
  @RequirePermission("comment", "task")
  deleteComment(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("commentId") commentId: string,
  ) {
    return this.tasksService.deleteComment(tenant.organizationId, tenant.userId, id, commentId);
  }
}
