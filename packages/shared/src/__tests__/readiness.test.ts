import { describe, expect, it } from "vitest";
import { computeReadiness } from "../forms/readiness";

const fields = [
  { key: "businessName", label: "Business name", required: true },
  { key: "logoUsage", label: "Logo usage", required: true },
  {
    key: "packagingType",
    label: "Packaging type",
    required: true,
    conditionalRule: { field: "logoUsage", operator: "contains" as const, value: "packaging" },
  },
];

describe("computeReadiness", () => {
  it("flags missing required fields", () => {
    const result = computeReadiness(fields, { businessName: "Acme" });
    expect(result.readiness).toBe("MISSING");
    expect(result.missingFields.map((f) => f.key)).toContain("logoUsage");
  });

  it("does not require a conditionally-hidden field", () => {
    const result = computeReadiness(fields, { businessName: "Acme", logoUsage: ["website"] });
    expect(result.readiness).toBe("READY");
  });

  it("requires a conditionally-shown field once its trigger is answered", () => {
    const result = computeReadiness(fields, { businessName: "Acme", logoUsage: ["packaging"] });
    expect(result.readiness).toBe("MISSING");
    expect(result.missingFields.map((f) => f.key)).toContain("packagingType");
  });

  it("is READY when every visible required field is answered", () => {
    const result = computeReadiness(fields, {
      businessName: "Acme",
      logoUsage: ["packaging"],
      packagingType: "Box",
    });
    expect(result.readiness).toBe("READY");
    expect(result.completionPercent).toBe(100);
  });

  it("surfaces a manually-flagged conflict without resolving it", () => {
    const result = computeReadiness(
      fields,
      { businessName: "Acme", logoUsage: ["website"] },
      [{ fieldAKey: "targetMarket", fieldBKey: "primaryMessage", note: "Premium vs. mass-market positioning" }],
    );
    expect(result.readiness).toBe("CONFLICTING");
    expect(result.conflicts).toHaveLength(1);
  });
});
