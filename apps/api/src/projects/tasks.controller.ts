import { Body, Controller, Param, Patch } from "@nestjs/common";
import { updateTaskSchema, type UpdateTaskInput } from "@clientos/shared";
import { TasksService } from "./tasks.service";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Patch(":id")
  @RequirePermission("edit", "task")
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: UpdateTaskInput,
  ) {
    return this.tasksService.update(tenant.organizationId, tenant.userId, id, body);
  }
}
