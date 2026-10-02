import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createProjectTemplateSchema,
  instantiateProjectTemplateSchema,
  updateProjectTemplateSchema,
  type CreateProjectTemplateInput,
  type InstantiateProjectTemplateInput,
  type UpdateProjectTemplateInput,
} from "@clientos/shared";
import { ProjectTemplatesService } from "./project-templates.service";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

@Controller("project-templates")
export class ProjectTemplatesController {
  constructor(private readonly templatesService: ProjectTemplatesService) {}

  @Get()
  @RequirePermission("view", "projectTemplate")
  list(@CurrentTenant() tenant: TenantContext) {
    return this.templatesService.list(tenant.organizationId);
  }

  @Get(":id")
  @RequirePermission("view", "projectTemplate")
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.templatesService.getOrThrow(tenant.organizationId, id);
  }

  @Post()
  @RequirePermission("create", "projectTemplate")
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(createProjectTemplateSchema)) body: CreateProjectTemplateInput,
  ) {
    return this.templatesService.create(tenant.organizationId, tenant.userId, body);
  }

  @Patch(":id")
  @RequirePermission("edit", "projectTemplate")
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectTemplateSchema)) body: UpdateProjectTemplateInput,
  ) {
    return this.templatesService.update(tenant.organizationId, tenant.userId, id, body);
  }

  @Delete(":id")
  @RequirePermission("delete", "projectTemplate")
  delete(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.templatesService.delete(tenant.organizationId, tenant.userId, id);
  }

  @Post(":id/instantiate")
  @RequirePermission("create", "project")
  instantiate(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(instantiateProjectTemplateSchema)) body: InstantiateProjectTemplateInput,
  ) {
    return this.templatesService.instantiate(tenant.organizationId, tenant.userId, id, body);
  }
}
