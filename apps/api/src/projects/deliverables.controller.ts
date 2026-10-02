import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  linkDeliverableRequirementSchema,
  updateDeliverableSchema,
  type LinkDeliverableRequirementInput,
  type UpdateDeliverableInput,
} from "@clientos/shared";
import { DeliverablesService } from "./deliverables.service";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

@Controller("deliverables")
export class DeliverablesController {
  constructor(private readonly deliverablesService: DeliverablesService) {}

  @Get(":id")
  @RequirePermission("view", "deliverable")
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.deliverablesService.getOrThrow(tenant.organizationId, id);
  }

  @Patch(":id")
  @RequirePermission("edit", "deliverable")
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDeliverableSchema)) body: UpdateDeliverableInput,
  ) {
    return this.deliverablesService.update(tenant.organizationId, tenant.userId, id, body);
  }

  @Delete(":id")
  @RequirePermission("delete", "deliverable")
  delete(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.deliverablesService.delete(tenant.organizationId, tenant.userId, id);
  }

  @Post(":id/requirements")
  @RequirePermission("edit", "deliverable")
  linkRequirement(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(linkDeliverableRequirementSchema)) body: LinkDeliverableRequirementInput,
  ) {
    return this.deliverablesService.linkRequirement(tenant.organizationId, tenant.userId, id, body.requirementId);
  }

  @Delete(":id/requirements/:requirementId")
  @RequirePermission("edit", "deliverable")
  unlinkRequirement(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("requirementId") requirementId: string,
  ) {
    return this.deliverablesService.unlinkRequirement(tenant.organizationId, tenant.userId, id, requirementId);
  }
}
