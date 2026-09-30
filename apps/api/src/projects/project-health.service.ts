import { Injectable } from "@nestjs/common";
import { computeProjectHealth, type ProjectHealthResult } from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Turns raw evidence (overdue tasks/milestones, blocked tasks) into the
 * evidence-backed health verdict from packages/shared/src/projects.ts — see
 * product.md §24: never a bare color, always a reason.
 */
@Injectable()
export class ProjectHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async computeForProject(projectId: string): Promise<ProjectHealthResult> {
    const now = new Date();

    const [overdueTaskCount, overdueMilestoneCount, blockedTasks] = await Promise.all([
      this.prisma.client.task.count({
        where: {
          projectId,
          deletedAt: null,
          status: { notIn: ["DONE"] },
          dueDate: { lt: now },
        },
      }),
      this.prisma.client.milestone.count({
        where: {
          projectId,
          status: { notIn: ["COMPLETED"] },
          dueDate: { lt: now },
        },
      }),
      this.prisma.client.task.findMany({
        where: { projectId, deletedAt: null, status: "BLOCKED" },
        select: {
          id: true,
          dependenciesFrom: {
            select: {
              blockingTask: {
                select: {
                  status: true,
                  deliverable: {
                    select: {
                      approvals: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: { status: true, createdAt: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    let tasksBlockedByOverdueApproval = 0;
    let oldestOverdueApprovalDays: number | null = null;

    for (const task of blockedTasks) {
      for (const dep of task.dependenciesFrom) {
        const latestApproval = dep.blockingTask.deliverable?.approvals[0];
        if (latestApproval && ["SUBMITTED", "UNDER_REVIEW"].includes(latestApproval.status)) {
          const ageDays = Math.floor((now.getTime() - latestApproval.createdAt.getTime()) / 86_400_000);
          if (ageDays > 0) {
            tasksBlockedByOverdueApproval += 1;
            if (oldestOverdueApprovalDays === null || ageDays > oldestOverdueApprovalDays) {
              oldestOverdueApprovalDays = ageDays;
            }
          }
        }
      }
    }

    return computeProjectHealth({
      overdueTaskCount,
      overdueMilestoneCount,
      blockedTaskCount: blockedTasks.length,
      tasksBlockedByOverdueApproval,
      oldestOverdueApprovalDays,
    });
  }
}
