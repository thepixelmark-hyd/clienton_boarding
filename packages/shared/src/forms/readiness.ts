import { isEmptyValue, isFieldVisible } from "./rule";

export type RequirementReadiness = "MISSING" | "NEEDS_CLARIFICATION" | "READY" | "CONFLICTING";

export interface ReadinessField {
  key: string;
  label: string;
  required: boolean;
  conditionalRule?: unknown;
}

export interface ManualConflict {
  fieldAKey: string;
  fieldBKey: string;
  note: string;
}

export interface ReadinessResult {
  readiness: RequirementReadiness;
  missingFields: { key: string; label: string }[];
  conflicts: ManualConflict[];
  completionPercent: number;
}

/**
 * Deterministic, rule-based readiness scoring: a required field that is
 * currently visible (per its conditional rule) and unanswered counts as
 * missing. Semantic contradiction detection ("premium positioning" vs.
 * "mass-market low-cost") requires natural-language understanding that this
 * phase does not implement (see architecture.md — AI features are Phase 7);
 * `manualConflicts` lets a staff reviewer record a contradiction they
 * noticed between two answers, which takes priority the same way an
 * AI-detected one would: it is surfaced, never auto-resolved (product.md §20).
 * NEEDS_CLARIFICATION is likewise a reviewer judgment call, not computed —
 * set explicitly via the requirement review action, not by this function.
 */
export function computeReadiness(
  fields: ReadinessField[],
  answers: Record<string, unknown>,
  manualConflicts: ManualConflict[] = [],
): ReadinessResult {
  const visibleRequired = fields.filter((f) => f.required && isFieldVisible(f.conditionalRule, answers));
  const missingFields = visibleRequired
    .filter((f) => isEmptyValue(answers[f.key]))
    .map((f) => ({ key: f.key, label: f.label }));

  const visibleFields = fields.filter((f) => isFieldVisible(f.conditionalRule, answers));
  const answeredCount = visibleFields.filter((f) => !isEmptyValue(answers[f.key])).length;
  const completionPercent = visibleFields.length === 0
    ? 100
    : Math.round((answeredCount / visibleFields.length) * 100);

  let readiness: RequirementReadiness;
  if (manualConflicts.length > 0) {
    readiness = "CONFLICTING";
  } else if (missingFields.length > 0) {
    readiness = "MISSING";
  } else {
    readiness = "READY";
  }

  return { readiness, missingFields, conflicts: manualConflicts, completionPercent };
}
