/**
 * Stable, machine-readable error codes returned by the API. See docs/api.md
 * for the response envelope shape. Adding a new failure mode means adding a
 * code here, not inventing an ad-hoc string at the call site.
 */
export const ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT_VERSION: "CONFLICT_VERSION",
  DUPLICATE_EMAIL: "DUPLICATE_EMAIL",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVITATION_INVALID: "INVITATION_INVALID",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toBody(): ApiErrorBody {
    return { code: this.code, message: this.message, details: this.details };
  }
}
