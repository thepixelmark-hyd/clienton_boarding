import { describe, expect, it } from "vitest";
import { detectConflicts, type ConflictRule } from "../forms/conflict";

describe("detectConflicts", () => {
  const colorRule: ConflictRule = {
    fieldAKey: "preferredColors",
    fieldBKey: "colorsToAvoid",
    kind: "no-overlap",
    note: "A color can't be both preferred and avoided.",
  };

  it("flags a conflict when multi-select values overlap", () => {
    const result = detectConflicts([colorRule], {
      preferredColors: ["navy", "gray"],
      colorsToAvoid: ["green", "navy"],
    });
    expect(result).toEqual([
      { fieldAKey: "preferredColors", fieldBKey: "colorsToAvoid", note: colorRule.note },
    ]);
  });

  it("does not flag a conflict when values don't overlap", () => {
    const result = detectConflicts([colorRule], {
      preferredColors: ["navy", "gray"],
      colorsToAvoid: ["green"],
    });
    expect(result).toEqual([]);
  });

  it("skips a rule when either field is unanswered", () => {
    expect(detectConflicts([colorRule], { preferredColors: ["navy"] })).toEqual([]);
    expect(detectConflicts([colorRule], {})).toEqual([]);
  });

  it("supports equal-values conflicts for scalar fields", () => {
    const rule: ConflictRule = {
      fieldAKey: "shippingAddress",
      fieldBKey: "billingAddress",
      kind: "equal-values",
      note: "Addresses match even though a different billing address was indicated.",
    };
    expect(detectConflicts([rule], { shippingAddress: "123 Main St", billingAddress: "123 Main St" })).toHaveLength(1);
    expect(detectConflicts([rule], { shippingAddress: "123 Main St", billingAddress: "456 Oak Ave" })).toEqual([]);
  });

  it("returns an empty array when there are no rules", () => {
    expect(detectConflicts(undefined, {})).toEqual([]);
    expect(detectConflicts([], { a: 1 })).toEqual([]);
  });
});
