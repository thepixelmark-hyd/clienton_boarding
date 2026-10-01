import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import {
  createFormFieldSchema,
  createFormSchema,
  createSubmissionSchema,
  instantiateFormSchema,
  reorderFormFieldsSchema,
  reviewRequirementSchema,
  saveResponsesSchema,
  updateFormFieldSchema,
  updateRequirementSummarySchema,
  type CreateFormFieldInput,
  type CreateFormInput,
  type CreateSubmissionInput,
  type InstantiateFormInput,
  type ReorderFormFieldsInput,
  type ReviewRequirementInput,
  type SaveResponsesInput,
  type UpdateFormFieldInput,
  type UpdateRequirementSummaryInput,
} from "@clientos/shared";
import { FormsService } from "./forms.service";
import { FormsUploadService } from "./forms-upload.service";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { Errors } from "../common/errors";

const FILE_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;

@Controller()
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly formsUploadService: FormsUploadService,
  ) {}

  // -------------------------------------------------------------------
  // Form builder
  // -------------------------------------------------------------------

  @Get("forms")
  @RequirePermission("view", "requirement")
  listForms(@CurrentTenant() tenant: TenantContext, @Query("isTemplate") isTemplate?: string) {
    return this.formsService.listForms(
      tenant.organizationId,
      isTemplate === undefined ? undefined : isTemplate === "true",
    );
  }

  @Post("forms")
  @RequirePermission("create", "requirement")
  createForm(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(createFormSchema)) body: CreateFormInput,
  ) {
    return this.formsService.createForm(tenant.organizationId, tenant.userId, body);
  }

  @Post("forms/:formId/fields")
  @RequirePermission("edit", "requirement")
  addField(
    @CurrentTenant() tenant: TenantContext,
    @Param("formId") formId: string,
    @Body(new ZodValidationPipe(createFormFieldSchema)) body: CreateFormFieldInput,
  ) {
    return this.formsService.addField(tenant.organizationId, tenant.userId, formId, body);
  }

  @Patch("forms/:formId/fields/:fieldId")
  @RequirePermission("edit", "requirement")
  updateField(
    @CurrentTenant() tenant: TenantContext,
    @Param("formId") formId: string,
    @Param("fieldId") fieldId: string,
    @Body(new ZodValidationPipe(updateFormFieldSchema)) body: UpdateFormFieldInput,
  ) {
    return this.formsService.updateField(tenant.organizationId, tenant.userId, formId, fieldId, body);
  }

  @Delete("forms/:formId/fields/:fieldId")
  @RequirePermission("edit", "requirement")
  deleteField(
    @CurrentTenant() tenant: TenantContext,
    @Param("formId") formId: string,
    @Param("fieldId") fieldId: string,
  ) {
    return this.formsService.deleteField(tenant.organizationId, tenant.userId, formId, fieldId);
  }

  @Patch("forms/:formId/fields-order")
  @RequirePermission("edit", "requirement")
  reorderFields(
    @CurrentTenant() tenant: TenantContext,
    @Param("formId") formId: string,
    @Body(new ZodValidationPipe(reorderFormFieldsSchema)) body: ReorderFormFieldsInput,
  ) {
    return this.formsService.reorderFields(tenant.organizationId, tenant.userId, formId, body.fieldIds);
  }

  @Post("forms/:formId/submissions")
  @RequirePermission("create", "requirement")
  createSubmission(
    @CurrentTenant() tenant: TenantContext,
    @Param("formId") formId: string,
    @Body(new ZodValidationPipe(createSubmissionSchema)) body: CreateSubmissionInput,
  ) {
    return this.formsService.createSubmission(tenant.organizationId, tenant.userId, formId, body.projectId);
  }

  @Get("forms/templates")
  @RequirePermission("view", "requirement")
  listTemplates() {
    return this.formsService.listTemplates();
  }

  // Must stay registered after the "forms/templates" literal route above —
  // Nest/Express match routes in declaration order for a given method, so a
  // ":formId" param route declared first would swallow "templates" as if it
  // were a form id.
  @Get("forms/:formId")
  @RequirePermission("view", "requirement")
  getForm(@CurrentTenant() tenant: TenantContext, @Param("formId") formId: string) {
    return this.formsService.getFormOrThrow(tenant.organizationId, formId);
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

  // -------------------------------------------------------------------
  // File uploads (FILE_UPLOAD / IMAGE_UPLOAD / VIDEO_UPLOAD fields only)
  // -------------------------------------------------------------------

  @Post("forms/:formId/submissions/:submissionId/fields/:fieldId/files")
  @RequirePermission("edit", "requirement")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: FILE_UPLOAD_LIMIT_BYTES } }))
  uploadFile(
    @CurrentTenant() tenant: TenantContext,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
    @Param("fieldId") fieldId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw Errors.validation("No file was uploaded.");
    return this.formsUploadService.uploadFile(tenant.organizationId, tenant.userId, formId, submissionId, fieldId, file);
  }

  @Get("forms/:formId/submissions/:submissionId/fields/:fieldId/files")
  @RequirePermission("view", "requirement")
  listFiles(
    @CurrentTenant() tenant: TenantContext,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
    @Param("fieldId") fieldId: string,
  ) {
    return this.formsUploadService.listFiles(tenant.organizationId, formId, submissionId, fieldId);
  }

  @Get("files/:fileId")
  @RequirePermission("view", "requirement")
  async downloadFile(@CurrentTenant() tenant: TenantContext, @Param("fileId") fileId: string, @Res() res: Response) {
    const { file, data } = await this.formsUploadService.getFileOrThrow(tenant.organizationId, fileId);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.send(data);
  }

  @Delete("files/:fileId")
  @RequirePermission("edit", "requirement")
  deleteFile(@CurrentTenant() tenant: TenantContext, @Param("fileId") fileId: string) {
    return this.formsUploadService.deleteFile(tenant.organizationId, fileId);
  }

  // -------------------------------------------------------------------
  // Requirement review, reopen, summary, versions
  // -------------------------------------------------------------------

  @Post("requirements/:id/review")
  @RequirePermission("edit", "requirement")
  reviewRequirement(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reviewRequirementSchema)) body: ReviewRequirementInput,
  ) {
    return this.formsService.reviewRequirement(tenant.organizationId, tenant.userId, id, body);
  }

  @Post("requirements/:id/reopen")
  @RequirePermission("edit", "requirement")
  reopenSubmission(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.formsService.reopenSubmission(tenant.organizationId, tenant.userId, id);
  }

  @Patch("requirements/:id/summary")
  @RequirePermission("edit", "requirement")
  updateSummary(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRequirementSummarySchema)) body: UpdateRequirementSummaryInput,
  ) {
    return this.formsService.updateSummary(tenant.organizationId, tenant.userId, id, body.summary);
  }

  @Get("requirements/:id/versions")
  @RequirePermission("view", "requirement")
  listVersions(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.formsService.listVersions(tenant.organizationId, id);
  }
}
