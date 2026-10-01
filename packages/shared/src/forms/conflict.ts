import { z } from "zod";
import { isEmptyValue } from "./rule";
import type { ManualConflict } from "./readiness";

/**
 * A declarative, template-authored conflict rule — the automatic half of
 * conflict detection (the other half is a reviewer manually flagging a
 * contradiction readiness.ts can't compute; see that file's comment on why
 * semantic contradiction detection is out of scope for this phase). These
 * rules only catch *structural* contradictions between two answers, which is
 * exactly the kind of thing worth automating: "no-overlap" (e.g. a color
 * can't be both preferred and to-be-avoided), "equal-values" (e.g. a
 * shipping address field and a "different billing address?" toggle lying).
 */
export interface ConflictRule {
  fieldAKey: string;
  fieldBKey: string;
  kind: "no-overlap" | "equal-values";
  note: string;
}

export const conflictRuleSchema: z.ZodType<ConflictRule> = z.object({
  fieldAKey: z.string().min(1),
  fieldBKey: z.string().min(1),
  kind: z.enum(["no-overlap", "equal-values"]),
  note: z.string().min(1).max(500),
});

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Evaluates a Form's stored `conflictRules` (copied from its template at
 * instantiation time, or authored directly via the form builder) against the
 * current answers. A rule is only evaluated once both fields it references
 * have an answer — an unanswered field can't yet be in conflict with
 * anything, that's just a missing-field case (readiness.ts handles that
 * separately).
 */
export function detectConflicts(
  rules: ConflictRule[] | null | undefined,
  answers: Record<string, unknown>,
): ManualConflict[] {
  if (!rules?.length) return [];
  const conflicts: ManualConflict[] = [];

  for (const rule of rules) {
    const a = answers[rule.fieldAKey];
    const b = answers[rule.fieldBKey];
    if (isEmptyValue(a) || isEmptyValue(b)) continue;

    const isConflict =
      rule.kind === "no-overlap"
        ? toArray(a).some((v) => toArray(b).includes(v))
        : a === b;

    if (isConflict) {
      conflicts.push({ fieldAKey: rule.fieldAKey, fieldBKey: rule.fieldBKey, note: rule.note });
    }
  }

  return conflicts;
}
