import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_ONBOARDING_CHECKLIST,
  type CreateClientInput,
  type CreateContactInput,
  type InviteClientPortalUserInput,
  type OnboardingItemStatus,
  type UpdateClientInput,
  type UpdateContactInput,
} from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { STORAGE_PROVIDER, type StorageProvider } from "../storage/storage-provider.interface";
import { sniffMimeType } from "../storage/file-signature";
import { generateSessionToken, hashToken, INVITATION_TTL_MS } from "../auth/session.util";
import { Errors } from "../common/errors";

export interface Pagination {
  page: number;
  pageSize: number;
}

const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

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
    private readonly email: EmailService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
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

  async updateContact(
    organizationId: string,
    actorUserId: string,
    clientId: string,
    contactId: string,
    input: UpdateContactInput,
  ) {
    const existing = await this.prisma.client.contact.findFirst({
      where: { id: contactId, clientId, organizationId, deletedAt: null },
    });
    if (!existing) throw Errors.notFound("Contact");
    if (existing.version !== input.version) throw Errors.conflictVersion();

    const { version: _version, ...rest } = input;
    const updated = await this.prisma.client.contact.update({
      where: { id: contactId },
      data: { ...rest, version: { increment: 1 } },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Contact",
      entityId: contactId,
      action: "UPDATED",
      before: existing,
      after: updated,
    });

    return updated;
  }

  async deleteContact(organizationId: string, actorUserId: string, clientId: string, contactId: string) {
    const existing = await this.prisma.client.contact.findFirst({
      where: { id: contactId, clientId, organizationId, deletedAt: null },
    });
    if (!existing) throw Errors.notFound("Contact");

    await this.prisma.client.contact.update({ where: { id: contactId }, data: { deletedAt: new Date() } });
    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Contact",
      entityId: contactId,
      action: "DELETED",
    });
    return { success: true };
  }

  // -------------------------------------------------------------------
  // Logo (image upload, local-disk StorageProvider — see storage/)
  // -------------------------------------------------------------------

  async setLogo(
    organizationId: string,
    actorUserId: string,
    clientId: string,
    file: { buffer: Buffer; size: number },
  ) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
    });
    if (!client) throw Errors.notFound("Client");

    if (file.size > LOGO_MAX_BYTES) {
      throw Errors.validation(`Logo is too large (max ${Math.round(LOGO_MAX_BYTES / (1024 * 1024))}MB).`);
    }
    const sniffed = sniffMimeType(file.buffer);
    if (!sniffed || !LOGO_ALLOWED_MIME_TYPES.includes(sniffed)) {
      throw Errors.validation("Logo must be a PNG, JPEG, or WebP image.");
    }

    const previousKey = client.logoUrl;
    const key = `${organizationId}/${randomUUID()}`;
    await this.storage.save(key, file.buffer);
    await this.prisma.client.client.update({ where: { id: clientId }, data: { logoUrl: key } });
    if (previousKey) await this.storage.delete(previousKey).catch(() => undefined);

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Client",
      entityId: clientId,
      action: "LOGO_UPDATED",
    });

    return { logoKey: key };
  }

  async getLogo(organizationId: string, clientId: string) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: { logoUrl: true },
    });
    if (!client?.logoUrl) throw Errors.notFound("Client logo");
    const data = await this.storage.read(client.logoUrl);
    const mimeType = sniffMimeType(data) ?? "application/octet-stream";
    return { data, mimeType };
  }

  // -------------------------------------------------------------------
  // Onboarding checklist (DEFAULT_ONBOARDING_CHECKLIST catalog -> per-client rows)
  // -------------------------------------------------------------------

  async startOnboarding(organizationId: string, actorUserId: string, clientId: string) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
    });
    if (!client) throw Errors.notFound("Client");

    const existingCount = await this.prisma.client.clientOnboardingItem.count({ where: { clientId } });
    if (existingCount === 0) {
      await this.prisma.client.$transaction(async (tx) => {
        await tx.clientOnboardingItem.createMany({
          data: DEFAULT_ONBOARDING_CHECKLIST.map((step, index) => ({
            organizationId,
            clientId,
            key: step.key,
            title: step.title,
            description: step.description,
            order: index,
            isRequired: step.isRequired,
          })),
        });
        await tx.client.update({
          where: { id: clientId },
          data: { onboardingStatus: "IN_PROGRESS", onboardingStep: DEFAULT_ONBOARDING_CHECKLIST[0]?.key },
        });
        await tx.clientTimelineEvent.create({
          data: {
            organizationId,
            clientId,
            type: "ONBOARDING_STARTED",
            title: "Onboarding started",
          },
        });
      });

      await this.audit.record({
        organizationId,
        actorUserId,
        entityType: "Client",
        entityId: clientId,
        action: "ONBOARDING_STARTED",
      });
    }

    return this.listOnboarding(organizationId, clientId);
  }

  async listOnboarding(organizationId: string, clientId: string) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw Errors.notFound("Client");

    return this.prisma.client.clientOnboardingItem.findMany({
      where: { clientId, organizationId },
      orderBy: { order: "asc" },
    });
  }

  async updateOnboardingItem(
    organizationId: string,
    actorUserId: string,
    clientId: string,
    itemId: string,
    status: OnboardingItemStatus,
  ) {
    const item = await this.prisma.client.clientOnboardingItem.findFirst({
      where: { id: itemId, clientId, organizationId },
    });
    if (!item) throw Errors.notFound("Onboarding item");

    const updated = await this.prisma.client.clientOnboardingItem.update({
      where: { id: itemId },
      data: {
        status,
        completedAt: status === "DONE" ? new Date() : null,
        completedById: status === "DONE" ? actorUserId : null,
      },
    });

    if (status === "DONE") {
      await this.prisma.client.clientTimelineEvent.create({
        data: {
          organizationId,
          clientId,
          type: "ONBOARDING_ITEM_COMPLETED",
          title: `Onboarding step completed: ${item.title}`,
        },
      });
    }

    await this.recomputeOnboardingStatus(organizationId, clientId);

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "ClientOnboardingItem",
      entityId: itemId,
      action: "UPDATED",
      before: { status: item.status },
      after: { status: updated.status },
    });

    return updated;
  }

  private async recomputeOnboardingStatus(organizationId: string, clientId: string) {
    const items = await this.prisma.client.clientOnboardingItem.findMany({ where: { clientId, organizationId } });
    if (items.length === 0) return;

    const requiredItems = items.filter((i) => i.isRequired);
    const allRequiredDone = requiredItems.length > 0 && requiredItems.every((i) => i.status === "DONE");

    if (allRequiredDone) {
      const client = await this.prisma.client.client.findFirst({ where: { id: clientId }, select: { onboardingStatus: true } });
      await this.prisma.client.client.update({
        where: { id: clientId },
        data: { onboardingStatus: "COMPLETED", onboardingStep: null },
      });
      if (client?.onboardingStatus !== "COMPLETED") {
        await this.prisma.client.clientTimelineEvent.create({
          data: { organizationId, clientId, type: "ONBOARDING_COMPLETED", title: "Onboarding completed" },
        });
      }
    } else {
      const nextItem = items.find((i) => i.status !== "DONE" && i.status !== "SKIPPED");
      await this.prisma.client.client.update({
        where: { id: clientId },
        data: { onboardingStatus: "IN_PROGRESS", onboardingStep: nextItem?.key },
      });
    }
  }

  // -------------------------------------------------------------------
  // Client portal invitations
  // -------------------------------------------------------------------

  async invitePortalUser(
    organizationId: string,
    actorUserId: string,
    clientId: string,
    input: InviteClientPortalUserInput,
  ) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
    });
    if (!client) throw Errors.notFound("Client");

    const existingPortalUser = await this.prisma.client.clientPortalUser.findFirst({
      where: { clientId, email: input.email },
    });
    if (existingPortalUser) {
      throw Errors.validation("This person already has client portal access.");
    }

    if (input.contactId) {
      const contact = await this.prisma.client.contact.findFirst({
        where: { id: input.contactId, clientId, organizationId, deletedAt: null },
      });
      if (!contact) throw Errors.notFound("Contact");
    }

    const rawToken = generateSessionToken();
    const invitation = await this.prisma.client.clientInvitation.create({
      data: {
        organizationId,
        clientId,
        contactId: input.contactId,
        email: input.email,
        role: input.role,
        tokenHash: hashToken(rawToken),
        invitedById: actorUserId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });

    const organization = await this.prisma.client.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    });
    const inviteUrl = `${process.env.WEB_APP_URL ?? "http://localhost:3000"}/portal/accept-invite?token=${rawToken}`;
    await this.email.sendClientPortalInvitation({
      to: input.email,
      organizationId,
      organizationName: organization.name,
      clientName: client.name,
      inviteUrl,
    });

    await this.prisma.client.clientTimelineEvent.create({
      data: {
        organizationId,
        clientId,
        type: "PORTAL_INVITATION_SENT",
        title: `Portal invitation sent to ${input.email}`,
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "ClientInvitation",
      entityId: invitation.id,
      action: "CREATED",
      after: { email: input.email, role: input.role },
    });

    return invitation;
  }

  async listPortalInvitations(organizationId: string, clientId: string) {
    return this.prisma.client.clientInvitation.findMany({
      where: { clientId, organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listPortalUsers(organizationId: string, clientId: string) {
    return this.prisma.client.clientPortalUser.findMany({
      where: { clientId, organizationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, lastLoginAt: true, createdAt: true, contactId: true },
    });
  }

  async revokePortalInvitation(organizationId: string, actorUserId: string, clientId: string, invitationId: string) {
    const invitation = await this.prisma.client.clientInvitation.findFirst({
      where: { id: invitationId, clientId, organizationId, status: "PENDING" },
    });
    if (!invitation) throw Errors.notFound("Invitation");

    await this.prisma.client.clientInvitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "ClientInvitation",
      entityId: invitationId,
      action: "REVOKED",
    });

    return { success: true };
  }
}
