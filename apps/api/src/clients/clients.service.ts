import { Injectable } from "@nestjs/common";
import type { CreateClientInput, CreateContactInput, UpdateClientInput } from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { Errors } from "../common/errors";

export interface Pagination {
  page: number;
  pageSize: number;
}

/**
 * Every query here filters by organizationId first — this is the "query
 * layer" enforcement described in docs/architecture.md. A lookup for a
 * record belonging to another organization returns null/NOT_FOUND, never a
 * 403, so a cross-tenant caller cannot learn the record exists at all.
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string, pagination: Pagination, search?: string) {
    const where = {
      organizationId,
      deletedAt: null,
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.client.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        include: { _count: { select: { projects: true, contacts: true } } },
      }),
      this.prisma.client.client.count({ where }),
    ]);
    return { data, page: pagination.page, pageSize: pagination.pageSize, total };
  }

  async getOrThrow(organizationId: string, id: string) {
    const client = await this.prisma.client.client.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        contacts: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
        projects: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        timelineEvents: { orderBy: { occurredAt: "desc" }, take: 25 },
      },
    });
    if (!client) throw Errors.notFound("Client");
    return client;
  }

  async create(organizationId: string, actorUserId: string, input: CreateClientInput) {
    const client = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          organizationId,
          name: input.name,
          website: input.website || undefined,
          industry: input.industry,
          description: input.description,
          timezone: input.timezone,
          status: input.status,
        },
      });
      await tx.clientTimelineEvent.create({
        data: {
          organizationId,
          clientId: created.id,
          type: "CLIENT_CREATED",
          title: "Client created",
        },
      });
      return created;
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Client",
      entityId: client.id,
      action: "CREATED",
      after: { name: client.name },
    });

    return client;
  }

  async update(organizationId: string, actorUserId: string, id: string, input: UpdateClientInput) {
    const existing = await this.prisma.client.client.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw Errors.notFound("Client");
    if (existing.version !== input.version) throw Errors.conflictVersion();

    const { version: _version, ...rest } = input;
    const updated = await this.prisma.client.client.update({
      where: { id },
      data: {
        ...rest,
        website: rest.website || undefined,
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Client",
      entityId: id,
      action: "UPDATED",
      before: existing,
      after: updated,
    });

    return updated;
  }

  async softDelete(organizationId: string, actorUserId: string, id: string) {
    const existing = await this.prisma.client.client.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw Errors.notFound("Client");

    await this.prisma.client.client.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Client",
      entityId: id,
      action: "DELETED",
    });
    return { success: true };
  }

  async addContact(organizationId: string, actorUserId: string, clientId: string, input: CreateContactInput) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
    });
    if (!client) throw Errors.notFound("Client");

    const contact = await this.prisma.client.contact.create({
      data: { organizationId, clientId, ...input },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Contact",
      entityId: contact.id,
      action: "CREATED",
      after: { fullName: contact.fullName, email: contact.email },
    });

    return contact;
  }
}
