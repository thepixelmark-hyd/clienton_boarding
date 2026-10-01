import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { saveResponsesSchema, type SaveResponsesInput } from "@clientos/shared";
import { ClientsService } from "../clients/clients.service";
import { FormsService } from "../forms/forms.service";
import { FormsUploadService } from "../forms/forms-upload.service";
import { Public } from "../common/decorators/public.decorator";
import { Errors } from "../common/errors";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { RequirePortalAuth } from "./require-portal-auth.decorator";
import { RequirePortalPermission } from "./require-portal-permission.decorator";
import { PortalPermissionsGuard } from "./portal-permissions.guard";
import { CurrentPortal, type PortalContext } from "./current-portal.decorator";

const FILE_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;

/**
 * Everything here is scoped to the authenticated portal user's own
 * `clientId` — never just `organizationId`, which (correctly) isn't strict
 * enough once more than one Client in the same org exists. Every handler
 * either queries through a *Service method that already takes `clientId`,
 * or calls `formsService.assertFormBelongsToClient` before delegating to an
 * internal FormsService method that only checks `organizationId` — see that
 * method's own comment for why both checks exist.
 */
@Controller("portal")
@Public()
@RequirePortalAuth()
@UseGuards(PortalPermissionsGuard)
export class PortalController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly formsService: FormsService,
    private readonly formsUploadService: FormsUploadService,
  ) {}

  @Get("onboarding")
  @RequirePortalPermission("view", "onboarding")
  listOnboarding(@CurrentPortal() portal: PortalContext) {
    return this.clientsService.listOnboarding(portal.organizationId, portal.clientId);
  }

  @Get("requirements")
  @RequirePortalPermission("view", "requirement")
  listRequirements(@CurrentPortal() portal: PortalContext) {
    return this.formsService.listForClientPortal(portal.organizationId, portal.clientId);
  }

  @Get("forms/:formId/submissions/:submissionId")
  @RequirePortalPermission("view", "requirement")
  async getSubmission(
    @CurrentPortal() portal: PortalContext,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
  ) {
    await this.formsService.assertFormBelongsToClient(portal.organizationId, portal.clientId, formId);
    return this.formsService.getSubmission(portal.organizationId, formId, submissionId);
  }

  @Put("forms/:formId/submissions/:submissionId/responses")
  @RequirePortalPermission("edit", "requirement")
  async saveResponses(
    @CurrentPortal() portal: PortalContext,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
    @Body(new ZodValidationPipe(saveResponsesSchema)) body: SaveResponsesInput,
  ) {
    await this.formsService.assertFormBelongsToClient(portal.organizationId, portal.clientId, formId);
    return this.formsService.saveResponses(portal.organizationId, formId, submissionId, body.responses);
  }

  @Post("forms/:formId/submissions/:submissionId/submit")
  @RequirePortalPermission("edit", "requirement")
  async submit(
    @CurrentPortal() portal: PortalContext,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
  ) {
    await this.formsService.assertFormBelongsToClient(portal.organizationId, portal.clientId, formId);
    return this.formsService.submit(
      portal.organizationId,
      undefined,
      formId,
      submissionId,
      portal.contactId ?? undefined,
    );
  }

  @Post("forms/:formId/submissions/:submissionId/fields/:fieldId/files")
  @RequirePortalPermission("upload", "requirement")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: FILE_UPLOAD_LIMIT_BYTES } }))
  async uploadFile(
    @CurrentPortal() portal: PortalContext,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
    @Param("fieldId") fieldId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw Errors.validation("No file was uploaded.");
    await this.formsService.assertFormBelongsToClient(portal.organizationId, portal.clientId, formId);
    return this.formsUploadService.uploadFile(
      portal.organizationId,
      undefined,
      formId,
      submissionId,
      fieldId,
      file,
    );
  }

  @Get("forms/:formId/submissions/:submissionId/fields/:fieldId/files")
  @RequirePortalPermission("view", "requirement")
  async listFiles(
    @CurrentPortal() portal: PortalContext,
    @Param("formId") formId: string,
    @Param("submissionId") submissionId: string,
    @Param("fieldId") fieldId: string,
  ) {
    await this.formsService.assertFormBelongsToClient(portal.organizationId, portal.clientId, formId);
    return this.formsUploadService.listFiles(portal.organizationId, formId, submissionId, fieldId);
  }

  @Get("files/:fileId")
  @RequirePortalPermission("view", "requirement")
  async downloadFile(
    @CurrentPortal() portal: PortalContext,
    @Param("fileId") fileId: string,
    @Res() res: Response,
  ) {
    const { file, data } = await this.formsUploadService.getFileForClient(
      portal.organizationId,
      portal.clientId,
      fileId,
    );
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.send(data);
  }

  @Delete("files/:fileId")
  @RequirePortalPermission("upload", "requirement")
  async deleteFile(@CurrentPortal() portal: PortalContext, @Param("fileId") fileId: string) {
    await this.formsUploadService.assertFileBelongsToClient(portal.organizationId, portal.clientId, fileId);
    return this.formsUploadService.deleteFile(portal.organizationId, fileId);
  }
}
