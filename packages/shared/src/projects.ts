import { z } from "zod";

export const projectStatusSchema = z.enum([
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]);

export const createProjectSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  type: z.string().max(80).optional(),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
  contractValue: z.number().nonnegative().optional(),
  budgetHours: z.number().nonnegative().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema
  .partial()
  .omit({ clientId: true })
  .extend({ status: projectStatusSchema.optional(), version: z.number().int().positive() });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const visibilitySchema = z.enum(["INTERNAL", "CLIENT_VISIBLE"]);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(8000).optional(),
  milestoneId: z.string().optional(),
  deliverableId: z.string().optional(),
  parentTaskId: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: taskPrioritySchema.optional(),
  visibility: visibilitySchema.optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().nonnegative().optional(),
  billable: z.boolean().optional(),
  dependsOnTaskIds: z.array(z.string()).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: taskStatusSchema.optional(),
  actualHours: z.number().nonnegative().optional(),
  version: z.number().int().positive(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const createMilestoneSchema = z.object({
  name: z.string().min(1).max(200),
  phaseId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

// -----------------------------------------------------------------------
// Project health — computed from evidence, never a bare color (product.md §24)
// -----------------------------------------------------------------------

export type ProjectHealthStatus = "HEALTHY" | "WATCH" | "AT_RISK" | "BLOCKED" | "CRITICAL";

export interface ProjectHealthEvidence {
  overdueTaskCount: number;
  overdueMilestoneCount: number;
  blockedTaskCount: number;
  tasksBlockedByOverdueApproval: number;
  oldestOverdueApprovalDays: number | null;
}

export interface ProjectHealthResult {
  status: ProjectHealthStatus;
  reason: string;
}

export function computeProjectHealth(evidence: ProjectHealthEvidence): ProjectHealthResult {
  const {
    overdueTaskCount,
    overdueMilestoneCount,
    blockedTaskCount,
    tasksBlockedByOverdueApproval,
    oldestOverdueApprovalDays,
  } = evidence;

  if (blockedTaskCount > 0 && tasksBlockedByOverdueApproval > 0 && oldestOverdueApprovalDays) {
    return {
      status: "CRITICAL",
      reason: `An approval has been pending for ${oldestOverdueApprovalDays} day${oldestOverdueApprovalDays === 1 ? "" : "s"} and is blocking ${tasksBlockedByOverdueApproval} dependent task${tasksBlockedByOverdueApproval === 1 ? "" : "s"}.`,
    };
  }
  if (blockedTaskCount > 0) {
    return {
      status: "BLOCKED",
      reason: `${blockedTaskCount} task${blockedTaskCount === 1 ? " is" : "s are"} blocked.`,
    };
  }
  if (overdueMilestoneCount > 0) {
    return {
      status: "AT_RISK",
      reason: `${overdueMilestoneCount} milestone${overdueMilestoneCount === 1 ? " is" : "s are"} overdue.`,
    };
  }
  if (overdueTaskCount >= 3) {
    return {
      status: "AT_RISK",
      reason: `${overdueTaskCount} tasks are overdue.`,
    };
  }
  if (overdueTaskCount > 0) {
    return {
      status: "WATCH",
      reason: `${overdueTaskCount} task${overdueTaskCount === 1 ? " is" : "s are"} overdue.`,
    };
  }
  return { status: "HEALTHY", reason: "No overdue work or blockers." };
}
