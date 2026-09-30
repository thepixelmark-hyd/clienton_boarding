import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  createClientSchema,
  createContactSchema,
  updateClientSchema,
  type CreateClientInput,
  type CreateContactInput,
  type UpdateClientInput,
} from "@clientos/shared";
import { ClientsService } from "./clients.service";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

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
}
