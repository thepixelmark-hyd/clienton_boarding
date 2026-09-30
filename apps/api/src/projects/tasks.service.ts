import { Injectable } from "@nestjs/common";
import type { CreateTaskInput, UpdateTaskInput } from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { Errors } from "../common/errors";

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForProject(organizationId: string, projectId: string) {
    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw Errors.notFound("Project");

    return this.prisma.client.task.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
      include: {
        assignee: { select: { id: true, fullName: true, avatarUrl: true } },
        dependenciesFrom: { select: { blockingTaskId: true } },
      },
    });
  }

  async create(organizationId: string, actorUserId: string, projectId: string, input: CreateTaskInput) {
    const project = await this.prisma.client.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw Errors.notFound("Project");

    if (input.dependsOnTaskIds?.length) {
      const validDeps = await this.prisma.client.task.count({
        where: { id: { in: input.dependsOnTaskIds }, projectId, deletedAt: null },
      });
      if (validDeps !== input.dependsOnTaskIds.length) {
        throw Errors.validation("One or more dependency tasks were not found in this project.");
      }
    }

    const { dependsOnTaskIds, ...rest } = input;
    const task = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          organizationId,
          projectId,
          title: rest.title,
          description: rest.description,
          milestoneId: rest.milestoneId,
          deliverableId: rest.deliverableId,
          parentTaskId: rest.parentTaskId,
          assigneeId: rest.assigneeId,
          priority: rest.priority,
          visibility: rest.visibility,
          startDate: rest.startDate ? new Date(rest.startDate) : undefined,
          dueDate: rest.dueDate ? new Date(rest.dueDate) : undefined,
          estimatedHours: rest.estimatedHours,
          billable: rest.billable,
        },
      });
      if (dependsOnTaskIds?.length) {
        await tx.taskDependency.createMany({
          data: dependsOnTaskIds.map((blockingTaskId) => ({
            dependentTaskId: created.id,
            blockingTaskId,
          })),
        });
      }
      return created;
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Task",
      entityId: task.id,
      action: "CREATED",
      after: { title: task.title, projectId },
    });

    return task;
  }

  async update(organizationId: string, actorUserId: string, id: string, input: UpdateTaskInput) {
    const existing = await this.prisma.client.task.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!existing) throw Errors.notFound("Task");
    if (existing.version !== input.version) throw Errors.conflictVersion();

    if (input.dependsOnTaskIds) {
      for (const blockingTaskId of input.dependsOnTaskIds) {
        if (blockingTaskId === id) {
          throw Errors.validation("A task cannot depend on itself.");
        }
        if (await this.wouldCreateCycle(id, blockingTaskId)) {
          throw Errors.validation(
            "That dependency would create a circular chain (the blocking task already depends on this one).",
          );
        }
      }
    }

    const { version: _version, dependsOnTaskIds, ...rest } = input;
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: {
          ...rest,
          startDate: rest.startDate ? new Date(rest.startDate) : undefined,
          dueDate: rest.dueDate ? new Date(rest.dueDate) : undefined,
          version: { increment: 1 },
        },
      });
      if (dependsOnTaskIds) {
        await tx.taskDependency.deleteMany({ where: { dependentTaskId: id } });
        if (dependsOnTaskIds.length) {
          await tx.taskDependency.createMany({
            data: dependsOnTaskIds.map((blockingTaskId) => ({ dependentTaskId: id, blockingTaskId })),
          });
        }
      }
      return task;
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Task",
      entityId: id,
      action: "UPDATED",
      before: existing,
      after: updated,
    });

    return updated;
  }

  /**
   * Adding the edge (dependentTaskId depends on blockingTaskId) creates a
   * cycle iff blockingTaskId already transitively depends on dependentTaskId
   * — i.e. dependentTaskId is reachable by walking blockingTaskId's existing
   * "depends on" chain. See testing.md "dependency cycles are rejected".
   */
  private async wouldCreateCycle(dependentTaskId: string, blockingTaskId: string): Promise<boolean> {
    const visited = new Set<string>();
    let frontier = [blockingTaskId];

    while (frontier.length > 0) {
      const deps = await this.prisma.client.taskDependency.findMany({
        where: { dependentTaskId: { in: frontier } },
        select: { blockingTaskId: true },
      });
      frontier = [];
      for (const dep of deps) {
        if (dep.blockingTaskId === dependentTaskId) return true;
        if (!visited.has(dep.blockingTaskId)) {
          visited.add(dep.blockingTaskId);
          frontier.push(dep.blockingTaskId);
        }
      }
    }
    return false;
  }
}
