import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import {
  createClientSchema,
  createContactSchema,
  inviteClientPortalUserSchema,
  updateClientSchema,
  updateContactSchema,
  updateOnboardingItemSchema,
  type CreateClientInput,
  type CreateContactInput,
  type InviteClientPortalUserInput,
  type UpdateClientInput,
  type UpdateContactInput,
  type UpdateOnboardingItemInput,
} from "@clientos/shared";
import { ClientsService } from "./clients.service";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { Errors } from "../common/errors";

const LOGO_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;

@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermission("view", "client")
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
    @Query("search") search?: string,
  ) {
    return this.clientsService.list(
      tenant.organizationId,
      { page: Math.max(1, Number(page) || 1), pageSize: Math.min(100, Math.max(1, Number(pageSize) || 20)) },
      search,
    );
  }

  @Get(":id")
  @RequirePermission("view", "client")
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.clientsService.getOrThrow(tenant.organizationId, id);
  }

  @Post()
  @RequirePermission("create", "client")
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(createClientSchema)) body: CreateClientInput,
  ) {
    return this.clientsService.create(tenant.organizationId, tenant.userId, body);
  }

  @Patch(":id")
  @RequirePermission("edit", "client")
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateClientSchema)) body: UpdateClientInput,
  ) {
    return this.clientsService.update(tenant.organizationId, tenant.userId, id, body);
  }

  @Delete(":id")
  @RequirePermission("delete", "client")
  remove(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.clientsService.softDelete(tenant.organizationId, tenant.userId, id);
  }

  @Post(":id/contacts")
  @RequirePermission("edit", "client")
  addContact(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createContactSchema)) body: CreateContactInput,
  ) {
    return this.clientsService.addContact(tenant.organizationId, tenant.userId, id, body);
  }

  @Patch(":id/contacts/:contactId")
  @RequirePermission("edit", "client")
  updateContact(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Body(new ZodValidationPipe(updateContactSchema)) body: UpdateContactInput,
  ) {
    return this.clientsService.updateContact(tenant.organizationId, tenant.userId, id, contactId, body);
  }

  @Delete(":id/contacts/:contactId")
  @RequirePermission("delete", "client")
  removeContact(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("contactId") contactId: string,
  ) {
    return this.clientsService.deleteContact(tenant.organizationId, tenant.userId, id, contactId);
  }

  @Post(":id/logo")
  @RequirePermission("edit", "client")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: LOGO_UPLOAD_LIMIT_BYTES } }))
  uploadLogo(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw Errors.validation("No file was uploaded.");
    return this.clientsService.setLogo(tenant.organizationId, tenant.userId, id, file);
  }

  @Get(":id/logo")
  @RequirePermission("view", "client")
  async downloadLogo(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Res() res: Response) {
    const { data, mimeType } = await this.clientsService.getLogo(tenant.organizationId, id);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(data);
  }

  @Post(":id/onboarding/start")
  @RequirePermission("edit", "client")
  startOnboarding(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.clientsService.startOnboarding(tenant.organizationId, tenant.userId, id);
  }

  @Get(":id/onboarding")
  @RequirePermission("view", "client")
  listOnboarding(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.clientsService.listOnboarding(tenant.organizationId, id);
  }

  @Patch(":id/onboarding/:itemId")
  @RequirePermission("edit", "client")
  updateOnboardingItem(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body(new ZodValidationPipe(updateOnboardingItemSchema)) body: UpdateOnboardingItemInput,
  ) {
    return this.clientsService.updateOnboardingItem(tenant.organizationId, tenant.userId, id, itemId, body.status);
  }

  @Post(":id/invitations")
  @RequirePermission("invite", "client")
  invitePortalUser(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(inviteClientPortalUserSchema)) body: InviteClientPortalUserInput,
  ) {
    return this.clientsService.invitePortalUser(tenant.organizationId, tenant.userId, id, body);
  }

  @Get(":id/invitations")
  @RequirePermission("view", "client")
  listPortalInvitations(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.clientsService.listPortalInvitations(tenant.organizationId, id);
  }

  @Get(":id/portal-users")
  @RequirePermission("view", "client")
  listPortalUsers(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.clientsService.listPortalUsers(tenant.organizationId, id);
  }

  @Delete(":id/invitations/:invitationId")
  @RequirePermission("invite", "client")
  revokePortalInvitation(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Param("invitationId") invitationId: string,
  ) {
    return this.clientsService.revokePortalInvitation(tenant.organizationId, tenant.userId, id, invitationId);
  }
}
