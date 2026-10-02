import { Injectable } from "@nestjs/common";
import {
  validateTemplateBlueprint,
  type CreateProjectTemplateInput,
  type InstantiateProjectTemplateInput,
  type TemplateMilestone,
  type TemplatePhase,
  type TemplateTask,
  type UpdateProjectTemplateInput,
} from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ProjectActivityService } from "./project-activity.service";
import { Errors } from "../common/errors";

const DAY_MS = 86_400_000;

function addDays(base: Date, days: number | undefined | null): Date | undefined {
  if (days === undefined || days === null) return undefined;
  return new Date(base.getTime() + days * DAY_MS);
}

@Injectable()
export class ProjectTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly activity: ProjectActivityService,
  ) {}

  list(organizationId: string) {
    return this.prisma.client.projectTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOrThrow(organizationId: string, id: string) {
    const template = await this.prisma.client.projectTemplate.findFirst({ where: { id, organizationId } });
    if (!template) throw Errors.notFound("Project template");
    return template;
  }

  async create(organizationId: string, actorUserId: string, input: CreateProjectTemplateInput) {
    const errors = validateTemplateBlueprint(input.phases, input.milestones, input.tasks);
    if (errors.length) throw Errors.validation("This template's blueprint has errors.", { errors });

    const template = await this.prisma.client.projectTemplate.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        phases: input.phases as never,
        milestones: input.milestones as never,
        tasks: input.tasks as never,
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "ProjectTemplate",
      entityId: template.id,
      action: "CREATED",
      after: { name: template.name },
    });

    return template;
  }

  async update(organizationId: string, actorUserId: string, id: string, input: UpdateProjectTemplateInput) {
    const existing = await this.getOrThrow(organizationId, id);

    const phases = (input.phases ?? (existing.phases as unknown as TemplatePhase[])) as TemplatePhase[];
    const milestones = (input.milestones ?? (existing.milestones as unknown as TemplateMilestone[])) as TemplateMilestone[];
    const tasks = (input.tasks ?? (existing.tasks as unknown as TemplateTask[])) as TemplateTask[];
    const errors = validateTemplateBlueprint(phases, milestones, tasks);
    if (errors.length) throw Errors.validation("This template's blueprint has errors.", { errors });

    const updated = await this.prisma.client.projectTemplate.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        phases: phases as never,
        milestones: milestones as never,
        tasks: tasks as never,
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "ProjectTemplate",
      entityId: id,
      action: "UPDATED",
      before: { name: existing.name },
      after: { name: updated.name },
    });

    return updated;
  }

  async delete(organizationId: string, actorUserId: string, id: string) {
    await this.getOrThrow(organizationId, id);
    await this.prisma.client.projectTemplate.delete({ where: { id } });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "ProjectTemplate",
      entityId: id,
      action: "DELETED",
    });

    return { id };
  }

  /**
   * Resolves every key reference in the blueprint into a real row, inside
   * one transaction: Project, then its phases (key -> id), then milestones
   * (resolving phaseKey), then tasks in two passes (first pass creates every
   * task with its phase/milestone, second pass wires parentTaskId and
   * TaskDependency rows once every task has a real id) — subtasks and
   * dependencies can both reference a task declared later in the array, so
   * a single pass can't resolve them.
   */
  async instantiate(organizationId: string, actorUserId: string, templateId: string, input: InstantiateProjectTemplateInput) {
    const template = await this.getOrThrow(organizationId, templateId);
    const client = await this.prisma.client.client.findFirst({
      where: { id: input.clientId, organizationId, deletedAt: null },
    });
    if (!client) throw Errors.notFound("Client");

    const phases = template.phases as unknown as TemplatePhase[];
    const milestones = template.milestones as unknown as TemplateMilestone[];
    const tasks = template.tasks as unknown as TemplateTask[];
    const startDate = input.startDate ? new Date(input.startDate) : new Date();

    const project = await this.prisma.client.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          organizationId,
          clientId: input.clientId,
          name: input.name,
          sourceTemplateId: templateId,
          startDate,
        },
      });
      await tx.projectMember.create({
        data: { projectId: createdProject.id, userId: actorUserId, role: "LEAD" },
      });

      const phaseIdByKey = new Map<string, string>();
      for (const phase of [...phases].sort((a, b) => a.order - b.order)) {
        const created = await tx.projectPhase.create({
          data: {
            projectId: createdProject.id,
            name: phase.name,
            order: phase.order,
            startDate: addDays(startDate, phase.startOffsetDays),
            endDate: addDays(startDate, phase.endOffsetDays),
          },
        });
        phaseIdByKey.set(phase.key, created.id);
      }

      const milestoneIdByKey = new Map<string, string>();
      for (const milestone of milestones) {
        const created = await tx.milestone.create({
          data: {
            projectId: createdProject.id,
            phaseId: milestone.phaseKey ? phaseIdByKey.get(milestone.phaseKey) : undefined,
            name: milestone.name,
            dueDate: addDays(startDate, milestone.dueOffsetDays),
          },
        });
        milestoneIdByKey.set(milestone.key, created.id);
      }

      const taskIdByKey = new Map<string, string>();
      for (const t of tasks) {
        const created = await tx.task.create({
          data: {
            organizationId,
            projectId: createdProject.id,
            title: t.title,
            description: t.description,
            milestoneId: t.milestoneKey ? milestoneIdByKey.get(t.milestoneKey) : undefined,
            priority: t.priority,
            visibility: t.visibility,
            estimatedHours: t.estimatedHours,
            dueDate: addDays(startDate, t.dueOffsetDays),
          },
        });
        taskIdByKey.set(t.key, created.id);
      }

      for (const t of tasks) {
        const taskId = taskIdByKey.get(t.key)!;
        if (t.parentKey) {
          await tx.task.update({ where: { id: taskId }, data: { parentTaskId: taskIdByKey.get(t.parentKey) } });
        }
        if (t.dependsOnKeys?.length) {
          await tx.taskDependency.createMany({
            data: t.dependsOnKeys.map((depKey) => ({
              dependentTaskId: taskId,
              blockingTaskId: taskIdByKey.get(depKey)!,
            })),
          });
        }
      }

      return createdProject;
    });

    await this.activity.record({
      organizationId,
      projectId: project.id,
      type: "PROJECT_TEMPLATE_INSTANTIATED",
      title: `Project created from template "${template.name}"`,
      actorUserId,
    });

    await this.audit.record({
      organizationId,
      actorUserId,
      entityType: "Project",
      entityId: project.id,
      action: "CREATED_FROM_TEMPLATE",
      after: { name: project.name, templateId },
    });

    return project;
  }
}
