import { z } from "zod";
import { taskPrioritySchema, visibilitySchema } from "./projects";

/**
 * A reusable blueprint for standing up a new project in one step. Each array
 * holds plain objects keyed by a stable `key` string chosen by whoever
 * authors the template (not a database id — the template itself has no
 * child rows, see schema.prisma's `ProjectTemplate`), so a milestone can
 * reference its phase, a task can reference its milestone/parent/
 * dependencies, before any of that exists as a real row. `instantiate`
 * (apps/api/src/projects/project-templates.service.ts) walks these arrays
 * once and resolves every key into a freshly created row's real id.
 *
 * Offsets (`startOffsetDays`, `dueOffsetDays`, ...) are measured from the
 * *new* project's start date (today, if none is given at instantiation) —
 * a template never hardcodes real dates, only relative ones, so the same
 * "Website Redesign" template produces correctly-dated phases/milestones/
 * tasks whenever and for whichever client it's used.
 */
export const templatePhaseSchema = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  order: z.number().int().min(0),
  startOffsetDays: z.number().int().optional(),
  endOffsetDays: z.number().int().optional(),
});
export type TemplatePhase = z.infer<typeof templatePhaseSchema>;

export const templateMilestoneSchema = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  phaseKey: z.string().optional(),
  dueOffsetDays: z.number().int().optional(),
});
export type TemplateMilestone = z.infer<typeof templateMilestoneSchema>;

export const templateTaskSchema = z.object({
  key: z.string().min(1).max(60),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  phaseKey: z.string().optional(),
  milestoneKey: z.string().optional(),
  parentKey: z.string().optional(),
  priority: taskPrioritySchema.optional(),
  visibility: visibilitySchema.optional(),
  estimatedHours: z.number().nonnegative().optional(),
  dueOffsetDays: z.number().int().optional(),
  dependsOnKeys: z.array(z.string()).optional(),
});
export type TemplateTask = z.infer<typeof templateTaskSchema>;

export const createProjectTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  phases: z.array(templatePhaseSchema).default([]),
  milestones: z.array(templateMilestoneSchema).default([]),
  tasks: z.array(templateTaskSchema).default([]),
});
export type CreateProjectTemplateInput = z.infer<typeof createProjectTemplateSchema>;

export const updateProjectTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  phases: z.array(templatePhaseSchema).optional(),
  milestones: z.array(templateMilestoneSchema).optional(),
  tasks: z.array(templateTaskSchema).optional(),
});
export type UpdateProjectTemplateInput = z.infer<typeof updateProjectTemplateSchema>;

export const instantiateProjectTemplateSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(200),
  startDate: z.string().datetime().optional(),
});
export type InstantiateProjectTemplateInput = z.infer<typeof instantiateProjectTemplateSchema>;

/**
 * Validates cross-references within a blueprint before it's persisted (or
 * instantiated) — a template with a dangling `phaseKey` or a dependency
 * cycle would silently produce a broken project otherwise, since
 * `instantiate` resolves keys trustingly. Returns a list of human-readable
 * errors; empty means valid. Mirrors TasksService.wouldCreateCycle's
 * graph-walk, just over template keys instead of database ids.
 */
export function validateTemplateBlueprint(
  phases: TemplatePhase[],
  milestones: TemplateMilestone[],
  tasks: TemplateTask[],
): string[] {
  const errors: string[] = [];
  const phaseKeys = new Set(phases.map((p) => p.key));
  const milestoneKeys = new Set(milestones.map((m) => m.key));
  const taskKeys = new Set(tasks.map((t) => t.key));

  if (phaseKeys.size !== phases.length) errors.push("Phase keys must be unique.");
  if (milestoneKeys.size !== milestones.length) errors.push("Milestone keys must be unique.");
  if (taskKeys.size !== tasks.length) errors.push("Task keys must be unique.");

  for (const m of milestones) {
    if (m.phaseKey && !phaseKeys.has(m.phaseKey)) {
      errors.push(`Milestone "${m.name}" references unknown phase key "${m.phaseKey}".`);
    }
  }

  const dependsOn = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.phaseKey && !phaseKeys.has(t.phaseKey)) {
      errors.push(`Task "${t.title}" references unknown phase key "${t.phaseKey}".`);
    }
    if (t.milestoneKey && !milestoneKeys.has(t.milestoneKey)) {
      errors.push(`Task "${t.title}" references unknown milestone key "${t.milestoneKey}".`);
    }
    if (t.parentKey && !taskKeys.has(t.parentKey)) {
      errors.push(`Task "${t.title}" references unknown parent task key "${t.parentKey}".`);
    }
    if (t.parentKey === t.key) {
      errors.push(`Task "${t.title}" cannot be its own parent.`);
    }
    for (const dep of t.dependsOnKeys ?? []) {
      if (!taskKeys.has(dep)) {
        errors.push(`Task "${t.title}" depends on unknown task key "${dep}".`);
      }
      if (dep === t.key) {
        errors.push(`Task "${t.title}" cannot depend on itself.`);
      }
    }
    dependsOn.set(t.key, t.dependsOnKeys ?? []);
  }

  // Cycle check over the in-memory key graph (only once references are
  // already known-valid, so a bad key above doesn't also spam a cycle error).
  if (errors.length === 0) {
    const state = new Map<string, "visiting" | "done">();
    const visit = (key: string, chain: string[]): void => {
      if (state.get(key) === "done") return;
      if (state.get(key) === "visiting") {
        errors.push(`Circular dependency among tasks: ${[...chain, key].join(" → ")}.`);
        return;
      }
      state.set(key, "visiting");
      for (const dep of dependsOn.get(key) ?? []) {
        visit(dep, [...chain, key]);
      }
      state.set(key, "done");
    };
    for (const key of taskKeys) visit(key, []);
  }

  return errors;
}
