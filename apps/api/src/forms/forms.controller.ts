import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import {
  instantiateFormSchema,
  saveResponsesSchema,
  type InstantiateFormInput,
  type SaveResponsesInput,
} from "@clientos/shared";
import { FormsService } from "./forms.service";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

@Controller()
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get("forms/templates")
  @RequirePermission("view", "requirement")
  listTemplates() {
    return this.formsService.listTemplates();
  }

  @Post("projects/:projectId/requirements")
  @RequirePermission("create", "requirement")
  instantiate(
    @CurrentTenant() tenant: TenantContext,
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(instantiateFormSchema)) body: InstantiateFormInput,
  ) {
    return this.formsService.instantiateOnProject(
      tenant.organizationId,
      tenant.userId,
      projectId,
      body.templateKey,
    );
  }

  @Get("requirements")
  @RequirePermission("view", "requirement")
  listRequirements(@CurrentTenant() tenant: TenantContext, @Query("projectId") projectId: string) {
    return this.formsService.listForProject(tenant.organizationId, projectId);
  }

  @Get("requirements/:id")
  @RequirePermission("view", "requirement")
  getRequirement(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.formsService.getRequirement(tenant.organizationId, id);
  }

  @Get("forms/:formId/submissions/:submissionId")
  @RequirePermission("view", "requirement")
  getSubmission(
    @CurrentTenant() tenant: TenantContext,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
  ) {
    return this.formsService.getSubmission(tenant.organizationId, formId, submissionId);
  }

  @Put("forms/:formId/submissions/:submissionId/responses")
  @RequirePermission("edit", "requirement")
  saveResponses(
    @CurrentTenant() tenant: TenantContext,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
    @Body(new ZodValidationPipe(saveResponsesSchema)) body: SaveResponsesInput,
  ) {
    return this.formsService.saveResponses(tenant.organizationId, formId, submissionId, body.responses);
  }

  @Post("forms/:formId/submissions/:submissionId/submit")
  @RequirePermission("edit", "requirement")
  submit(
    @CurrentTenant() tenant: TenantContext,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
  ) {
    return this.formsService.submit(tenant.organizationId, tenant.userId, formId, submissionId);
  }
}
