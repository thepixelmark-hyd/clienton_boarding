import { Injectable } from "@nestjs/common";
import type {
  AddProjectMemberInput,
  CreateMilestoneInput,
  CreatePhaseInput,
  CreateProjectInput,
  ReorderPhasesInput,
  UpdateMilestoneInput,
  UpdatePhaseInput,
  UpdateProjectInput,
  UpdateProjectMemberInput,
} from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { Errors } from "../common/errors";
import { ProjectHealthService } from "./project-health.service";
import { ProjectActivityService } from "./project-activity.service";
import type { Pagination } from "../clients/clients.service";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly health: ProjectHealthService,
    private readonly activity: ProjectActivityService,
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

    await this.activity.record({
      organizationId,
      projectId: project.id,
      type: "PROJECT_CREATED",
      title: `Project created: ${project.name}`,
      actorUserId,
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

    if (input.status && input.status !== existing.status) {
      await this.activity.record({
        organizationId,
        projectId: id,
        type: "PROJECT_STATUS_CHANGED",
        title: `Project status changed to ${input.status}`,
        actorUserId,
        metadata: { from: existing.status, to: input.status },
      });
    }

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

    await this.activity.record({
      organizationId,
      projectId,
      type: "MILESTONE_CREATED",
      title: `Milestone created: ${milestone.name}`,
      actorUserId,
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

  async updateMilestone(
    organizationId: string,
    actorUserId: string,
    projectId: string,
    milestoneId: string,
    input: UpdateMilestoneInput,
  ) {
    const existing = await this.prisma.client.milestone.findFirst({ where: { id: milestoneId, projectId } });
    if (!existing) throw Errors.notFound("Milestone");
    await this.assertProjectExists(organizationId, projectId);

    const becomingCompleted = input.status === "COMPLETED" && existing.status !== "COMPLETED";
    const updated = await this.prisma.client.milestone.update({
      where: { id: milestoneId },
      data: {
        name: input.name,
        phaseId: input.phaseId,
        dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
        status: input.status,
        completedAt: becomingCompleted ? new Date() : input.status && input.status !== "COMPLETED" ? null : undefined,
      },
    });

    if (becomingCompleted) {
      await this.activity.record({
        organizationId,
        projectId,
        type: "MILESTONE_COMPLETED",
        title: `Milestone completed: ${updated.name}`,
        actorUserId,
      });
    }

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Milestone",
      entityId: milestoneId,
      action: "UPDATED",
      before: existing,
      after: updated,
    });

    return updated;
  }

  async deleteMilestone(organizationId: string, actorUserId: string, projectId: string, milestoneId: string) {
    const existing = await this.prisma.client.milestone.findFirst({ where: { id: milestoneId, projectId } });
    if (!existing) throw Errors.notFound("Milestone");
    await this.assertProjectExists(organizationId, projectId);

    await this.prisma.client.milestone.delete({ where: { id: milestoneId } });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Milestone",
      entityId: milestoneId,
      action: "DELETED",
      before: existing,
    });

    return { id: milestoneId };
  }

  // -----------------------------------------------------------------------
  // Phases
  // -----------------------------------------------------------------------

  async listPhases(organizationId: string, projectId: string) {
    await this.assertProjectExists(organizationId, projectId);
    return this.prisma.client.projectPhase.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
      include: { milestones: true },
    });
  }

  async addPhase(organizationId: string, actorUserId: string, projectId: string, input: CreatePhaseInput) {
    await this.assertProjectExists(organizationId, projectId);

    const order = input.order ?? (await this.prisma.client.projectPhase.count({ where: { projectId } }));
    const phase = await this.prisma.client.projectPhase.create({
      data: {
        projectId,
        name: input.name,
        order,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      },
    });

    await this.activity.record({
      organizationId,
      projectId,
      type: "PHASE_CREATED",
      title: `Phase added: ${phase.name}`,
      actorUserId,
    });

    return phase;
  }

  async updatePhase(
    organizationId: string,
    actorUserId: string,
    projectId: string,
    phaseId: string,
    input: UpdatePhaseInput,
  ) {
    const existing = await this.prisma.client.projectPhase.findFirst({ where: { id: phaseId, projectId } });
    if (!existing) throw Errors.notFound("Phase");
    await this.assertProjectExists(organizationId, projectId);

    const updated = await this.prisma.client.projectPhase.update({
      where: { id: phaseId },
      data: {
        name: input.name,
        order: input.order,
        startDate: input.startDate === undefined ? undefined : input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate === undefined ? undefined : input.endDate ? new Date(input.endDate) : null,
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "ProjectPhase",
      entityId: phaseId,
      action: "UPDATED",
      before: existing,
      after: updated,
    });

    return updated;
  }

  async deletePhase(organizationId: string, actorUserId: string, projectId: string, phaseId: string) {
    const existing = await this.prisma.client.projectPhase.findFirst({ where: { id: phaseId, projectId } });
    if (!existing) throw Errors.notFound("Phase");
    await this.assertProjectExists(organizationId, projectId);

    await this.prisma.client.projectPhase.delete({ where: { id: phaseId } });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "ProjectPhase",
      entityId: phaseId,
      action: "DELETED",
      before: existing,
    });

    return { id: phaseId };
  }

  async reorderPhases(organizationId: string, actorUserId: string, projectId: string, input: ReorderPhasesInput) {
    await this.assertProjectExists(organizationId, projectId);

    const existingPhases = await this.prisma.client.projectPhase.findMany({ where: { projectId } });
    const existingIds = new Set(existingPhases.map((p) => p.id));
    if (input.orderedIds.length !== existingPhases.length || !input.orderedIds.every((id) => existingIds.has(id))) {
      throw Errors.validation("orderedIds must be exactly the set of this project's phase ids.");
    }

    await this.prisma.client.$transaction(
      input.orderedIds.map((id, index) => this.prisma.client.projectPhase.update({ where: { id }, data: { order: index } })),
    );

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Project",
      entityId: projectId,
      action: "PHASES_REORDERED",
    });

    return this.listPhases(organizationId, projectId);
  }

  // -----------------------------------------------------------------------
  // Members (assignments)
  // -----------------------------------------------------------------------

  async listMembers(organizationId: string, projectId: string) {
    await this.assertProjectExists(organizationId, projectId);
    return this.prisma.client.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async addMember(organizationId: string, actorUserId: string, projectId: string, input: AddProjectMemberInput) {
    await this.assertProjectExists(organizationId, projectId);

    const membership = await this.prisma.client.membership.findFirst({
      where: { organizationId, userId: input.userId, status: "ACTIVE" },
    });
    if (!membership) throw Errors.notFound("Member");

    const existing = await this.prisma.client.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: input.userId } },
    });
    if (existing) throw Errors.validation("This person is already assigned to the project.");

    const member = await this.prisma.client.projectMember.create({
      data: { projectId, userId: input.userId, role: input.role ?? "CONTRIBUTOR" },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    await this.activity.record({
      organizationId,
      projectId,
      type: "MEMBER_ADDED",
      title: `${member.user.fullName} joined the project`,
      actorUserId,
    });

    return member;
  }

  async updateMember(
    organizationId: string,
    actorUserId: string,
    projectId: string,
    userId: string,
    input: UpdateProjectMemberInput,
  ) {
    await this.assertProjectExists(organizationId, projectId);
    const existing = await this.prisma.client.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!existing) throw Errors.notFound("Project member");

    const updated = await this.prisma.client.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role: input.role },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "ProjectMember",
      entityId: updated.id,
      action: "UPDATED",
      before: { role: existing.role },
      after: { role: updated.role },
    });

    return updated;
  }

  async removeMember(organizationId: string, actorUserId: string, projectId: string, userId: string) {
    await this.assertProjectExists(organizationId, projectId);
    const existing = await this.prisma.client.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { user: { select: { fullName: true } } },
    });
    if (!existing) throw Errors.notFound("Project member");

    await this.prisma.client.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });

    await this.activity.record({
      organizationId,
      projectId,
      type: "MEMBER_REMOVED",
      title: `${existing.user.fullName} left the project`,
      actorUserId,
    });

    return { userId };
  }

  // -----------------------------------------------------------------------
  // Activity feed
  // -----------------------------------------------------------------------

  async listActivity(organizationId: string, projectId: string) {
    await this.assertProjectExists(organizationId, projectId);
    return this.activity.list(organizationId, projectId);
  }

  // -----------------------------------------------------------------------
  // Dashboard — every number here is a real aggregate query, never a
  // hardcoded or placeholder value (product.md Phase 3: "do not create fake
  // dashboard statistics").
  // -----------------------------------------------------------------------

  async getDashboard(organizationId: string, projectId: string) {
    const project = await this.assertProjectExists(organizationId, projectId);
    const now = new Date();

    const [
      statusCounts,
      overdueTasks,
      upcomingMilestones,
      deliverableStatusCounts,
      waitingOnClientTasks,
      openRequirementCount,
      recentActivity,
    ] = await Promise.all([
      this.prisma.client.task.groupBy({
        by: ["status"],
        where: { projectId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.client.task.findMany({
        where: { projectId, deletedAt: null, status: { notIn: ["DONE"] }, dueDate: { lt: now } },
        select: { id: true, title: true, dueDate: true, assignee: { select: { fullName: true } } },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
      this.prisma.client.milestone.findMany({
        where: { projectId, status: { notIn: ["COMPLETED"] }, dueDate: { gte: now } },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      this.prisma.client.deliverable.groupBy({
        by: ["status"],
        where: { projectId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.client.task.findMany({
        where: { projectId, deletedAt: null, waitingOnClient: true, status: { notIn: ["DONE"] } },
        select: { id: true, title: true, waitingOnClientNote: true, dueDate: true },
      }),
      this.prisma.client.requirement.count({
        where: { organizationId, projectId, deletedAt: null, readiness: { in: ["MISSING", "NEEDS_CLARIFICATION"] } },
      }),
      this.activity.list(organizationId, projectId, 10),
    ]);

    const taskStatusBreakdown = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));
    const deliverableBreakdown = Object.fromEntries(deliverableStatusCounts.map((s) => [s.status, s._count._all]));
    const totalTasks = statusCounts.reduce((sum, s) => sum + s._count._all, 0);

    return {
      projectId: project.id,
      health: await this.health.computeForProject(projectId),
      taskStatusBreakdown,
      totalTasks,
      overdueTasks,
      upcomingMilestones,
      deliverableStatusBreakdown: deliverableBreakdown,
      waitingOnClient: {
        tasks: waitingOnClientTasks,
        openRequirementCount,
      },
      recentActivity,
    };
  }

  private async assertProjectExists(organizationId: string, projectId: string) {
    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw Errors.notFound("Project");
    return project;
  }

  // -----------------------------------------------------------------------
  // Client portal — scoped by clientId as well as organizationId (two
  // different Clients in the same org must not reach each other's
  // projects), and never leaks internal-only Task titles: only
  // CLIENT_VISIBLE tasks are returned, the rest only count toward the
  // aggregate progress numbers. See security.md "Internal vs. client
  // visibility".
  // -----------------------------------------------------------------------

  async listForPortal(organizationId: string, clientId: string) {
    const projects = await this.prisma.client.project.findMany({
      where: { organizationId, clientId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      projects.map(async (p) => ({ ...p, health: await this.health.computeForProject(p.id) })),
    );
  }

  async getPortalDetail(organizationId: string, clientId: string, projectId: string) {
    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, organizationId, clientId, deletedAt: null },
    });
    if (!project) throw Errors.notFound("Project");

    const [milestones, deliverables, visibleTasks, taskCounts, openRequirementCount] = await Promise.all([
      this.prisma.client.milestone.findMany({ where: { projectId }, orderBy: { dueDate: "asc" } }),
      this.prisma.client.deliverable.findMany({
        where: { projectId, deletedAt: null },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.client.task.findMany({
        where: { projectId, deletedAt: null, visibility: "CLIENT_VISIBLE" },
        select: { id: true, title: true, status: true, dueDate: true },
        orderBy: { dueDate: "asc" },
      }),
      this.prisma.client.task.groupBy({ by: ["status"], where: { projectId, deletedAt: null }, _count: { _all: true } }),
      this.prisma.client.requirement.count({
        where: { organizationId, projectId, deletedAt: null, readiness: { in: ["MISSING", "NEEDS_CLARIFICATION"] } },
      }),
    ]);

    const totalTasks = taskCounts.reduce((sum, c) => sum + c._count._all, 0);
    const doneTasks = taskCounts.find((c) => c.status === "DONE")?._count._all ?? 0;

    return {
      project,
      health: await this.health.computeForProject(projectId),
      milestones,
      deliverables,
      visibleTasks,
      progress: { totalTasks, doneTasks },
      waitingOnYou: {
        deliverablesInReview: deliverables.filter((d) => d.status === "IN_REVIEW"),
        openRequirementCount,
      },
    };
  }
}
