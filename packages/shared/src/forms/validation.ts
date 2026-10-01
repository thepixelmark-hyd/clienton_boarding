import { isEmptyValue } from "./rule";
import type { TemplateFieldType } from "./templates/types";

export interface ValidatableField {
  type: TemplateFieldType;
  options?: { value: string; label: string }[] | null;
  minSelections?: number | null;
  maxSelections?: number | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPLOAD_TYPES = new Set<TemplateFieldType>(["FILE_UPLOAD", "IMAGE_UPLOAD", "VIDEO_UPLOAD"]);

/**
 * Shape/type validation for a single field's answer — separate from
 * readiness (which only asks "is a required, visible field empty?"). This
 * catches a well-formed-but-wrong answer before it's stored: a string in a
 * NUMBER field, a MULTI_SELECT value outside its own options, a CONSENT
 * field answered false when required. Returns a user-facing message, or
 * `null` if the value is acceptable (an empty/absent optional value always
 * passes here — "required but missing" is readiness's job, not this one's).
 */
export function validateFieldValue(field: ValidatableField, value: unknown): string | null {
  if (isEmptyValue(value)) return null;

  if (UPLOAD_TYPES.has(field.type)) {
    return "Files for this field must be added through the file upload endpoint, not saved as a plain value.";
  }

  switch (field.type) {
    case "NUMBER":
    case "CURRENCY":
    case "RATING": {
      const n = typeof value === "number" ? value : Number(value);
      if (typeof value !== "number" && typeof value !== "string") return "Must be a number.";
      if (Number.isNaN(n)) return "Must be a number.";
      if (field.type === "RATING" && (n < 1 || n > 5)) return "Must be between 1 and 5.";
      return null;
    }
    case "DATE": {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return "Must be a valid date.";
      return null;
    }
    case "URL": {
      if (typeof value !== "string") return "Must be a URL.";
      try {
        new URL(value);
        return null;
      } catch {
        return "Must be a valid URL.";
      }
    }
    case "EMAIL": {
      if (typeof value !== "string" || !EMAIL_RE.test(value)) return "Must be a valid email address.";
      return null;
    }
    case "CONSENT": {
      if (typeof value !== "boolean") return "Must be true or false.";
      return null;
    }
    case "SINGLE_SELECT": {
      if (typeof value !== "string") return "Must be one of the available options.";
      if (field.options && !field.options.some((o) => o.value === value)) {
        return "Must be one of the available options.";
      }
      return null;
    }
    case "MULTI_SELECT": {
      if (!Array.isArray(value)) return "Must be a list of selected options.";
      if (field.options) {
        const allowed = new Set(field.options.map((o) => o.value));
        if (value.some((v) => !allowed.has(v))) return "Contains an option that isn't available.";
      }
      if (field.minSelections && value.length < field.minSelections) {
        return `Choose at least ${field.minSelections}.`;
      }
      if (field.maxSelections && value.length > field.maxSelections) {
        return `Choose at most ${field.maxSelections}.`;
      }
      return null;
    }
    case "SHORT_TEXT":
    case "PHONE": {
      if (typeof value !== "string") return "Must be text.";
      if (value.length > 500) return "Too long (max 500 characters).";
      return null;
    }
    case "LONG_TEXT":
    case "RICH_TEXT": {
      if (typeof value !== "string") return "Must be text.";
      if (value.length > 20000) return "Too long (max 20,000 characters).";
      return null;
    }
    default:
      // ADDRESS/SIGNATURE/RANKING/CALCULATED: no renderer or stable value
      // shape exists for these yet (see docs/testing.md Known limitations)
      // — pass through rather than rejecting a shape nothing has defined.
      return null;
  }
}
