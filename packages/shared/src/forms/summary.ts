import { isEmptyValue, isFieldVisible } from "./rule";

export interface SummarizableField {
  key: string;
  label: string;
  type: string;
  conditionalRule?: unknown;
  order: number;
}

const SUMMARY_SOURCE_TYPES = new Set(["SHORT_TEXT", "LONG_TEXT", "RICH_TEXT"]);
const MAX_FIELDS = 3;
const MAX_CHARS_PER_FIELD = 160;

/**
 * A deterministic, no-AI starting point for `Requirement.summary` — picks
 * the first few answered text fields (in form order) and stitches them into
 * one paragraph a PM can read without opening every answer. This is
 * intentionally not an LLM summary (AI features are Phase 7, see
 * architecture.md); it's a seed value staff are expected to rewrite via
 * `PATCH /requirements/:id/summary`, not a final answer.
 */
export function generateRequirementSummary(
  fields: SummarizableField[],
  answers: Record<string, unknown>,
): string {
  const picked = [...fields]
    .sort((a, b) => a.order - b.order)
    .filter((f) => SUMMARY_SOURCE_TYPES.has(f.type))
    .filter((f) => isFieldVisible(f.conditionalRule, answers))
    .filter((f) => !isEmptyValue(answers[f.key]))
    .slice(0, MAX_FIELDS);

  if (picked.length === 0) return "";

  return picked
    .map((f) => {
      const raw = String(answers[f.key]);
      const truncated = raw.length > MAX_CHARS_PER_FIELD ? `${raw.slice(0, MAX_CHARS_PER_FIELD - 1)}…` : raw;
      return `${f.label}: ${truncated}`;
    })
    .join(" — ");
}
