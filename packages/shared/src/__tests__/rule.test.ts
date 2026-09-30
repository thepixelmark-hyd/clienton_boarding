import { describe, expect, it } from "vitest";
import { evaluateConditionalRule, isFieldVisible } from "../forms/rule";

describe("evaluateConditionalRule", () => {
  it("evaluates a simple equals rule", () => {
    expect(
      evaluateConditionalRule({ field: "websiteExists", operator: "equals", value: "yes" }, { websiteExists: "yes" }),
    ).toBe(true);
    expect(
      evaluateConditionalRule({ field: "websiteExists", operator: "equals", value: "yes" }, { websiteExists: "no" }),
    ).toBe(false);
  });

  it("evaluates contains for multi-select answers", () => {
    const rule = { field: "logoUsage", operator: "contains" as const, value: "packaging" };
    expect(evaluateConditionalRule(rule, { logoUsage: ["website", "packaging"] })).toBe(true);
    expect(evaluateConditionalRule(rule, { logoUsage: ["website"] })).toBe(false);
    expect(evaluateConditionalRule(rule, {})).toBe(false);
  });

  it("evaluates nested AND/OR groups", () => {
    const rule = {
      combine: "AND" as const,
      rules: [
        { field: "a", operator: "equals" as const, value: true },
        {
          combine: "OR" as const,
          rules: [
            { field: "b", operator: "equals" as const, value: 1 },
            { field: "c", operator: "equals" as const, value: 2 },
          ],
        },
      ],
    };
    expect(evaluateConditionalRule(rule, { a: true, b: 1, c: 999 })).toBe(true);
    expect(evaluateConditionalRule(rule, { a: true, b: 999, c: 999 })).toBe(false);
    expect(evaluateConditionalRule(rule, { a: false, b: 1, c: 2 })).toBe(false);
  });

  it("isFieldVisible defaults to true when there is no rule", () => {
    expect(isFieldVisible(undefined, {})).toBe(true);
    expect(isFieldVisible(null, {})).toBe(true);
  });

  it("isFieldVisible defaults to true for a malformed rule rather than hiding data", () => {
    expect(isFieldVisible({ not: "a valid rule shape" }, {})).toBe(true);
  });
});
