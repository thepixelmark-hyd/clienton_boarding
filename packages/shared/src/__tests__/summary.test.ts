import { describe, expect, it } from "vitest";
import { generateRequirementSummary, type SummarizableField } from "../forms/summary";

describe("generateRequirementSummary", () => {
  const fields: SummarizableField[] = [
    { key: "businessName", label: "Business name", type: "SHORT_TEXT", order: 0 },
    { key: "companyOffering", label: "What does your company offer?", type: "LONG_TEXT", order: 1 },
    { key: "logoUsage", label: "Where will the logo be used?", type: "MULTI_SELECT", order: 2 },
  ];

  it("picks the first few answered text fields in order", () => {
    const summary = generateRequirementSummary(fields, {
      businessName: "Acme Co",
      companyOffering: "Widgets and gadgets for everyone.",
      logoUsage: ["website"],
    });
    expect(summary).toContain("Business name: Acme Co");
    expect(summary).toContain("What does your company offer?: Widgets and gadgets for everyone.");
    expect(summary).not.toContain("logoUsage");
  });

  it("skips unanswered fields", () => {
    const summary = generateRequirementSummary(fields, { businessName: "Acme Co" });
    expect(summary).toBe("Business name: Acme Co");
  });

  it("returns an empty string when nothing is answered", () => {
    expect(generateRequirementSummary(fields, {})).toBe("");
  });

  it("respects conditional visibility", () => {
    const conditional: SummarizableField[] = [
      { key: "a", label: "A", type: "SHORT_TEXT", order: 0 },
      {
        key: "b",
        label: "B",
        type: "SHORT_TEXT",
        order: 1,
        conditionalRule: { field: "a", operator: "equals", value: "show" },
      },
    ];
    const hidden = generateRequirementSummary(conditional, { a: "no", b: "should not appear" });
    expect(hidden).not.toContain("should not appear");

    const shown = generateRequirementSummary(conditional, { a: "show", b: "should appear" });
    expect(shown).toContain("should appear");
  });

  it("truncates long answers", () => {
    const longAnswer = "x".repeat(300);
    const summary = generateRequirementSummary([fields[0]!], { businessName: longAnswer });
    expect(summary.length).toBeLessThan(longAnswer.length);
    expect(summary).toContain("…");
  });
});
