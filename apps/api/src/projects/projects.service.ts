import { Injectable } from "@nestjs/common";
import type { CreateMilestoneInput, CreateProjectInput, UpdateProjectInput } from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { Errors } from "../common/errors";
import { ProjectHealthService } from "./project-health.service";
import type { Pagination } from "../clients/clients.service";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly health: ProjectHealthService,
  ) {}

  async list(organizationId: string, pagination: Pagination, clientId?: string) {
    const where = { organizationId, deletedAt: null, ...(clientId ? { clientId } : {}) };
    const [projects, total] = await Promise.all([
      this.prisma.client.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        include: { client: { select: { id: true, name: true } }, _count: { select: { tasks: true } } },
      }),
      this.prisma.client.project.count({ where }),
    ]);

    const withHealth = await Promise.all(
      projects.map(async (p) => ({ ...p, health: await this.health.computeForProject(p.id) })),
    );

    return { data: withHealth, page: pagination.page, pageSize: pagination.pageSize, total };
  }

  async getOrThrow(organizationId: string, id: string) {
    const project = await this.prisma.client.project.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true } },
        phases: { orderBy: { order: "asc" }, include: { milestones: true } },
        milestones: { orderBy: { dueDate: "asc" } },
        deliverables: { where: { deletedAt: null } },
        members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      },
    });
    if (!project) throw Errors.notFound("Project");
    const health = await this.health.computeForProject(id);
    return { ...project, health };
  }

  async create(organizationId: string, actorUserId: string, input: CreateProjectInput) {
    const client = await this.prisma.client.client.findFirst({
      where: { id: input.clientId, organizationId, deletedAt: null },
    });
    if (!client) throw Errors.notFound("Client");

    const project = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          organizationId,
          clientId: input.clientId,
          name: input.name,
          description: input.description,
          type: input.type,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : undefined,
          contractValue: input.contractValue,
          budgetHours: input.budgetHours,
        },
      });
      await tx.projectMember.create({
        data: { projectId: created.id, userId: actorUserId, role: "LEAD" },
      });
      await tx.clientTimelineEvent.create({
        data: {
          organizationId,
          clientId: input.clientId,
          type: "PROJECT_CREATED",
          title: `Project created: ${created.name}`,
        },
      });
      return created;
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Project",
      entityId: project.id,
      action: "CREATED",
      after: { name: project.name, clientId: project.clientId },
    });

    return project;
  }

  async update(organizationId: string, actorUserId: string, id: string, input: UpdateProjectInput) {
    const existing = await this.prisma.client.project.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw Errors.notFound("Project");
    if (existing.version !== input.version) throw Errors.conflictVersion();

    const { version: _version, ...rest } = input;
    const updated = await this.prisma.client.project.update({
      where: { id },
      data: {
        ...rest,
        startDate: rest.startDate ? new Date(rest.startDate) : undefined,
        targetEndDate: rest.targetEndDate ? new Date(rest.targetEndDate) : undefined,
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Project",
      entityId: id,
      action: "UPDATED",
      before: existing,
      after: updated,
    });

    return updated;
  }

  async addMilestone(organizationId: string, actorUserId: string, projectId: string, input: CreateMilestoneInput) {
    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
    });
    if (!project) throw Errors.notFound("Project");

    const milestone = await this.prisma.client.milestone.create({
      data: {
        projectId,
        phaseId: input.phaseId,
        name: input.name,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Milestone",
      entityId: milestone.id,
      action: "CREATED",
      after: { name: milestone.name },
    });

    return milestone;
  }
}
