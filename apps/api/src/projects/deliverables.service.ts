import { Injectable } from "@nestjs/common";
import type { CreateDeliverableInput, UpdateDeliverableInput } from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ProjectActivityService } from "./project-activity.service";
import { Errors } from "../common/errors";

const TASK_SELECT = { id: true, title: true, status: true } as const;

/**
 * Deliverable CRUD plus the requirement <-> deliverable half of the
 * traceability spine (product.md "The traceability spine"). The other half
 * — a Task citing the deliverable it serves — is just `Task.deliverableId`,
 * already settable through TasksService; `getProjectTraceability` below
 * reads both sides together so the full chain
 * (Requirement -> Deliverable -> Task) can be shown in one view.
 */
@Injectable()
export class DeliverablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly activity: ProjectActivityService,
  ) {}

  async listForProject(organizationId: string, projectId: string) {
    await this.assertProjectExists(organizationId, projectId);
    return this.prisma.client.deliverable.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        tasks: { where: { deletedAt: null }, select: TASK_SELECT },
        requirementLinks: { include: { requirement: { select: { id: true, title: true, readiness: true } } } },
      },
    });
  }

  async getOrThrow(organizationId: string, id: string) {
    const deliverable = await this.prisma.client.deliverable.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        tasks: { where: { deletedAt: null }, select: TASK_SELECT },
        requirementLinks: { include: { requirement: { select: { id: true, title: true, readiness: true } } } },
      },
    });
    if (!deliverable) throw Errors.notFound("Deliverable");
    return deliverable;
  }

  async create(organizationId: string, actorUserId: string, projectId: string, input: CreateDeliverableInput) {
    await this.assertProjectExists(organizationId, projectId);

    const deliverable = await this.prisma.client.deliverable.create({
      data: {
        organizationId,
        projectId,
        name: input.name,
        description: input.description,
        acceptanceCriteria: input.acceptanceCriteria,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
    });

    await this.activity.record({
      organizationId,
      projectId,
      type: "DELIVERABLE_CREATED",
      title: `Deliverable created: ${deliverable.name}`,
      actorUserId,
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Deliverable",
      entityId: deliverable.id,
      action: "CREATED",
      after: { name: deliverable.name, projectId },
    });

    return deliverable;
  }

  async update(organizationId: string, actorUserId: string, id: string, input: UpdateDeliverableInput) {
    const existing = await this.prisma.client.deliverable.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw Errors.notFound("Deliverable");

    const { version: _version, ...rest } = input;
    const { count } = await this.prisma.client.deliverable.updateMany({
      where: { id, version: input.version },
      data: {
        ...rest,
        dueDate: rest.dueDate === undefined ? undefined : rest.dueDate ? new Date(rest.dueDate) : null,
        version: { increment: 1 },
      },
    });
    if (count === 0) throw Errors.conflictVersion();
    const updated = await this.prisma.client.deliverable.findUniqueOrThrow({ where: { id } });

    if (input.status && input.status !== existing.status) {
      await this.activity.record({
        organizationId,
        projectId: existing.projectId,
        type: "DELIVERABLE_STATUS_CHANGED",
        title: `Deliverable "${updated.name}" moved to ${input.status}`,
        actorUserId,
        metadata: { from: existing.status, to: input.status },
      });
    }

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Deliverable",
      entityId: id,
      action: "UPDATED",
      before: existing,
      after: updated,
    });

    return updated;
  }

  async delete(organizationId: string, actorUserId: string, id: string) {
    const existing = await this.prisma.client.deliverable.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw Errors.notFound("Deliverable");

    await this.prisma.client.deliverable.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Deliverable",
      entityId: id,
      action: "DELETED",
      before: existing,
    });

    return { id };
  }

  async linkRequirement(organizationId: string, actorUserId: string, deliverableId: string, requirementId: string) {
    const deliverable = await this.prisma.client.deliverable.findFirst({
      where: { id: deliverableId, organizationId, deletedAt: null },
    });
    if (!deliverable) throw Errors.notFound("Deliverable");

    const requirement = await this.prisma.client.requirement.findFirst({
      where: { id: requirementId, organizationId, deletedAt: null },
    });
    if (!requirement) throw Errors.notFound("Requirement");
    if (requirement.projectId && requirement.projectId !== deliverable.projectId) {
      throw Errors.validation("That requirement belongs to a different project.");
    }

    const existingLink = await this.prisma.client.deliverableRequirement.findUnique({
      where: { deliverableId_requirementId: { deliverableId, requirementId } },
    });
    if (existingLink) throw Errors.validation("That requirement is already linked to this deliverable.");

    const link = await this.prisma.client.deliverableRequirement.create({
      data: { deliverableId, requirementId },
    });

    await this.activity.record({
      organizationId,
      projectId: deliverable.projectId,
      type: "REQUIREMENT_LINKED",
      title: `Requirement "${requirement.title}" linked to deliverable "${deliverable.name}"`,
      actorUserId,
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "DeliverableRequirement",
      entityId: link.id,
      action: "CREATED",
      after: { deliverableId, requirementId },
    });

    return link;
  }

  async unlinkRequirement(organizationId: string, actorUserId: string, deliverableId: string, requirementId: string) {
    const deliverable = await this.prisma.client.deliverable.findFirst({
      where: { id: deliverableId, organizationId, deletedAt: null },
    });
    if (!deliverable) throw Errors.notFound("Deliverable");

    const link = await this.prisma.client.deliverableRequirement.findUnique({
      where: { deliverableId_requirementId: { deliverableId, requirementId } },
    });
    if (!link) throw Errors.notFound("Requirement link");

    await this.prisma.client.deliverableRequirement.delete({ where: { id: link.id } });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "DeliverableRequirement",
      entityId: link.id,
      action: "DELETED",
    });

    return { deliverableId, requirementId };
  }

  /**
   * The full Requirement -> Deliverable -> Task chain for a project, plus
   * which requirements aren't linked to any deliverable yet — the gap a PM
   * needs to see to keep the spine honest (product.md "The traceability
   * spine").
   */
  async getProjectTraceability(organizationId: string, projectId: string) {
    await this.assertProjectExists(organizationId, projectId);

    const [deliverables, requirements] = await Promise.all([
      this.prisma.client.deliverable.findMany({
        where: { projectId, deletedAt: null },
        include: {
          tasks: { where: { deletedAt: null }, select: TASK_SELECT },
          requirementLinks: { include: { requirement: { select: { id: true, title: true, readiness: true } } } },
        },
      }),
      this.prisma.client.requirement.findMany({
        where: { organizationId, projectId, deletedAt: null },
        select: { id: true, title: true, readiness: true, deliverableLinks: { select: { deliverableId: true } } },
      }),
    ]);

    const unlinkedRequirements = requirements.filter((r) => r.deliverableLinks.length === 0);

    return { deliverables, unlinkedRequirements };
  }

  private async assertProjectExists(organizationId: string, projectId: string) {
    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw Errors.notFound("Project");
    return project;
  }
}
