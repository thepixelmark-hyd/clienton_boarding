import { HttpException, HttpStatus } from "@nestjs/common";
import { ERROR_CODES, type ErrorCode } from "@clientos/shared";

/**
 * Every deliberate rejection in the API throws one of these so the global
 * exception filter (http-exception.filter.ts) can produce the consistent
 * envelope documented in docs/api.md. Never throw a bare Error for a
 * user-facing failure.
 */
export class AppError extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }
}

export const Errors = {
  unauthenticated: (message = "You need to sign in to do that.") =>
    new AppError(ERROR_CODES.UNAUTHENTICATED, message, HttpStatus.UNAUTHORIZED),
  forbidden: (message = "You don't have permission to do that.") =>
    new AppError(ERROR_CODES.FORBIDDEN, message, HttpStatus.FORBIDDEN),
  notFound: (entity: string) =>
    new AppError(ERROR_CODES.NOT_FOUND, `${entity} could not be found.`, HttpStatus.NOT_FOUND),
  validation: (message: string, details?: Record<string, unknown>) =>
    new AppError(ERROR_CODES.VALIDATION_ERROR, message, HttpStatus.BAD_REQUEST, details),
  conflictVersion: () =>
    new AppError(
      ERROR_CODES.CONFLICT_VERSION,
      "This record was changed by someone else. Reload and try again.",
      HttpStatus.CONFLICT,
    ),
  duplicateEmail: () =>
    new AppError(
      ERROR_CODES.DUPLICATE_EMAIL,
      "An account with that email already exists.",
      HttpStatus.CONFLICT,
    ),
  invalidCredentials: () =>
    new AppError(
      ERROR_CODES.INVALID_CREDENTIALS,
      "That email and password combination is not correct.",
      HttpStatus.UNAUTHORIZED,
    ),
  invitationInvalid: () =>
    new AppError(
      ERROR_CODES.INVITATION_INVALID,
      "This invitation link is invalid or has expired.",
      HttpStatus.BAD_REQUEST,
    ),
  rateLimited: () =>
    new AppError(
      ERROR_CODES.RATE_LIMITED,
      "Too many attempts. Wait a moment and try again.",
      HttpStatus.TOO_MANY_REQUESTS,
    ),
};
