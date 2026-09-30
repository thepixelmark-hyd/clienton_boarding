import { z } from "zod";

/**
 * A conditional visibility rule for a FormField. Evaluated identically on
 * the server (validating a submission) and the client (deciding which
 * fields to render) by the same function below — see product.md §19.
 *
 * Examples:
 *   { field: "usesPackaging", operator: "equals", value: true }
 *   { combine: "AND", rules: [
 *       { field: "websiteExists", operator: "equals", value: true },
 *       { field: "hostingKnown", operator: "notEquals", value: null },
 *   ] }
 */
export interface ConditionRule {
  field: string;
  operator:
    | "equals"
    | "notEquals"
    | "in"
    | "notIn"
    | "contains"
    | "notContains"
    | "isEmpty"
    | "isNotEmpty";
  value?: unknown;
}

export interface ConditionGroup {
  combine: "AND" | "OR";
  rules: ConditionalRule[];
}

export type ConditionalRule = ConditionRule | ConditionGroup;

export const conditionRuleSchema: z.ZodType<ConditionRule> = z.object({
  field: z.string(),
  operator: z.enum([
    "equals",
    "notEquals",
    "in",
    "notIn",
    "contains",
    "notContains",
    "isEmpty",
    "isNotEmpty",
  ]),
  value: z.unknown().optional(),
});

export const conditionalRuleSchema: z.ZodType<ConditionalRule> = z.lazy(() =>
  z.union([
    conditionRuleSchema,
    z.object({
      combine: z.enum(["AND", "OR"]),
      rules: z.array(conditionalRuleSchema),
    }),
  ]),
);

function isGroup(rule: ConditionalRule): rule is ConditionGroup {
  return "combine" in rule;
}

export function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/**
 * Evaluate whether a field should be visible/required given the current set
 * of answers keyed by field `key`. Answers use the raw stored value shape
 * (string for most fields, array for multi-select, etc).
 */
export function evaluateConditionalRule(
  rule: ConditionalRule,
  answers: Record<string, unknown>,
): boolean {
  if (isGroup(rule)) {
    const results = rule.rules.map((r) => evaluateConditionalRule(r, answers));
    return rule.combine === "AND" ? results.every(Boolean) : results.some(Boolean);
  }

  const actual = answers[rule.field];
  switch (rule.operator) {
    case "equals":
      return actual === rule.value;
    case "notEquals":
      return actual !== rule.value;
    case "in":
      return Array.isArray(rule.value) && rule.value.includes(actual);
    case "notIn":
      return Array.isArray(rule.value) && !rule.value.includes(actual);
    case "contains":
      return Array.isArray(actual) && actual.includes(rule.value);
    case "notContains":
      return !(Array.isArray(actual) && actual.includes(rule.value));
    case "isEmpty":
      return isEmptyValue(actual);
    case "isNotEmpty":
      return !isEmptyValue(actual);
    default:
      return true;
  }
}

/** A field with no rule (or an unparseable one) is always visible. */
export function isFieldVisible(
  conditionalRule: unknown,
  answers: Record<string, unknown>,
): boolean {
  if (!conditionalRule) return true;
  const parsed = conditionalRuleSchema.safeParse(conditionalRule);
  if (!parsed.success) return true;
  return evaluateConditionalRule(parsed.data, answers);
}
