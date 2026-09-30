import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";
import { AppError } from "../errors";

describe("ZodValidationPipe", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() });
  const pipe = new ZodValidationPipe(schema);

  it("returns the parsed value when valid", () => {
    const result = pipe.transform({ name: "Acme", age: 5 });
    expect(result).toEqual({ name: "Acme", age: 5 });
  });

  it("throws a validation AppError with per-field messages when invalid", () => {
    expect(() => pipe.transform({ name: "", age: -1 })).toThrow(AppError);
    try {
      pipe.transform({ name: "", age: -1 });
      fail("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const body = (err as AppError).getResponse() as { details: { fieldErrors: Record<string, string> } };
      expect(Object.keys(body.details.fieldErrors)).toEqual(expect.arrayContaining(["name", "age"]));
    }
  });

  it("does not leak extra unvalidated fields silently accepted by zod's default object parsing", () => {
    // zod objects strip unknown keys by default unless .passthrough() is used —
    // verify our schemas behave the documented way (extra keys are dropped, not
    // rejected, which is fine for query-string style laxness but worth pinning).
    const result = pipe.transform({ name: "Acme", age: 5, extra: "ignored" });
    expect(result).not.toHaveProperty("extra");
  });
});
