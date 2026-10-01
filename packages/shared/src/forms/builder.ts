import { z } from "zod";
import { conditionalRuleSchema } from "./rule";
import { conflictRuleSchema } from "./conflict";
import { TEMPLATE_FIELD_TYPES } from "./templates/types";

/** A blank, staff-authored form — the form-builder entry point, as opposed
 * to instantiating one of the hardcoded FORM_TEMPLATES. Scoped to exactly
 * one of a client/project at creation (a reusable org-level template has
 * neither — see `saveFormAsTemplateSchema` below). */
export const createFormSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  clientId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
});
export type CreateFormInput = z.infer<typeof createFormSchema>;

const optionSchema = z.object({ value: z.string().min(1), label: z.string().min(1) });

export const createFormFieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Must start with a letter and contain only letters, numbers, underscores."),
  label: z.string().min(1).max(300),
  helpText: z.string().max(1000).optional(),
  type: z.enum(TEMPLATE_FIELD_TYPES),
  required: z.boolean().optional(),
  options: z.array(optionSchema).optional(),
  minSelections: z.number().int().positive().optional(),
  maxSelections: z.number().int().positive().optional(),
  conditionalRule: conditionalRuleSchema.optional(),
});
export type CreateFormFieldInput = z.infer<typeof createFormFieldSchema>;

export const updateFormFieldSchema = createFormFieldSchema.partial().omit({ key: true });
export type UpdateFormFieldInput = z.infer<typeof updateFormFieldSchema>;

export const reorderFormFieldsSchema = z.object({
  fieldIds: z.array(z.string().min(1)).min(1),
});
export type ReorderFormFieldsInput = z.infer<typeof reorderFormFieldsSchema>;

export const setConflictRulesSchema = z.object({
  conflictRules: z.array(conflictRuleSchema),
});
export type SetConflictRulesInput = z.infer<typeof setConflictRulesSchema>;

/** Starts a new DRAFT submission against an *existing* Form (template-backed
 * or builder-authored) for a given project — the generic counterpart to
 * `instantiateFormSchema` (which only works for the hardcoded catalog). */
export const createSubmissionSchema = z.object({
  projectId: z.string().min(1),
});
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const updateRequirementSummarySchema = z.object({
  summary: z.string().max(4000),
});
export type UpdateRequirementSummaryInput = z.infer<typeof updateRequirementSummarySchema>;

export const reviewRequirementSchema = z.object({
  decision: z.enum(["READY", "NEEDS_CLARIFICATION"]),
  note: z.string().max(2000).optional(),
  addConflicts: z
    .array(z.object({ fieldAKey: z.string().min(1), fieldBKey: z.string().min(1), note: z.string().min(1).max(500) }))
    .optional(),
});
export type ReviewRequirementInput = z.infer<typeof reviewRequirementSchema>;
