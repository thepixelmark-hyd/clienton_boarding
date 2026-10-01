import type { ConditionalRule } from "../rule";
import type { ConflictRule } from "../conflict";

export const TEMPLATE_FIELD_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "RICH_TEXT",
  "NUMBER",
  "CURRENCY",
  "DATE",
  "URL",
  "EMAIL",
  "PHONE",
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "RATING",
  "RANKING",
  "FILE_UPLOAD",
  "IMAGE_UPLOAD",
  "VIDEO_UPLOAD",
  "ADDRESS",
  "CONSENT",
  "SIGNATURE",
  "CALCULATED",
] as const;

export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];

export interface TemplateFieldDefinition {
  key: string;
  label: string;
  helpText?: string;
  type: TemplateFieldType;
  required: boolean;
  options?: { value: string; label: string }[];
  minSelections?: number;
  maxSelections?: number;
  conditionalRule?: ConditionalRule;
}

export interface FormTemplateDefinition {
  templateKey: string;
  name: string;
  description: string;
  fields: TemplateFieldDefinition[];
  /** Copied onto the instantiated Form's `conflictRules` column verbatim —
   * see forms/conflict.ts. */
  conflictRules?: ConflictRule[];
}
