import { describe, expect, it } from "vitest";
import { validateFieldValue } from "../forms/validation";

describe("validateFieldValue", () => {
  it("accepts an empty/absent value for any type (readiness handles required-ness)", () => {
    expect(validateFieldValue({ type: "NUMBER" }, undefined)).toBeNull();
    expect(validateFieldValue({ type: "EMAIL" }, "")).toBeNull();
  });

  it("validates NUMBER", () => {
    expect(validateFieldValue({ type: "NUMBER" }, 42)).toBeNull();
    expect(validateFieldValue({ type: "NUMBER" }, "not a number")).toMatch(/number/i);
  });

  it("validates EMAIL", () => {
    expect(validateFieldValue({ type: "EMAIL" }, "a@b.com")).toBeNull();
    expect(validateFieldValue({ type: "EMAIL" }, "not-an-email")).toMatch(/email/i);
  });

  it("validates URL", () => {
    expect(validateFieldValue({ type: "URL" }, "https://example.com")).toBeNull();
    expect(validateFieldValue({ type: "URL" }, "not a url")).toMatch(/url/i);
  });

  it("validates SINGLE_SELECT against options", () => {
    const field = { type: "SINGLE_SELECT" as const, options: [{ value: "a", label: "A" }] };
    expect(validateFieldValue(field, "a")).toBeNull();
    expect(validateFieldValue(field, "b")).toMatch(/options/i);
  });

  it("validates MULTI_SELECT against options and min/max selections", () => {
    const field = {
      type: "MULTI_SELECT" as const,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ],
      minSelections: 2,
      maxSelections: 2,
    };
    expect(validateFieldValue(field, ["a", "b"])).toBeNull();
    expect(validateFieldValue(field, ["a"])).toMatch(/at least/i);
    expect(validateFieldValue(field, ["a", "b", "c"])).toMatch(/at most/i);
    expect(validateFieldValue(field, ["a", "x"])).toMatch(/option/i);
  });

  it("validates CONSENT as a strict boolean", () => {
    expect(validateFieldValue({ type: "CONSENT" }, true)).toBeNull();
    expect(validateFieldValue({ type: "CONSENT" }, "yes")).toMatch(/true or false/i);
  });

  it("rejects a plain value for upload field types", () => {
    expect(validateFieldValue({ type: "IMAGE_UPLOAD" }, "some-string")).toMatch(/upload endpoint/i);
  });

  it("passes through types with no defined validator yet", () => {
    expect(validateFieldValue({ type: "ADDRESS" }, { anything: true })).toBeNull();
  });
});
