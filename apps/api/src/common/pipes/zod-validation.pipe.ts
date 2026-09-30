import { PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";
import { Errors } from "../errors";

/**
 * Wraps a Zod schema (from packages/shared) as a Nest pipe. The same schema
 * validates this request body server-side and the equivalent web form
 * client-side (docs/architecture.md — "one schema, two enforcement points").
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path.join(".") || "_"] = issue.message;
      }
      throw Errors.validation("Some fields need attention.", { fieldErrors });
    }
    return result.data;
  }
}
