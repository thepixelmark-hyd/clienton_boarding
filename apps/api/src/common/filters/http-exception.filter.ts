import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ERROR_CODES } from "@clientos/shared";

/**
 * Every response leaving the API — success or failure — uses one shape for
 * errors (docs/api.md). Unhandled exceptions never leak a stack trace or
 * internal message to the client; they get a correlation id that is logged
 * server-side so support can find the real error. The id is the same one
 * CorrelationIdMiddleware already attached to this request/response pair
 * (and that LoggingInterceptor's access-log line for this request carries),
 * not a fresh one — so a single id ties the client-visible error, the
 * access log line, and the full stack trace together.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const correlationId = request.correlationId ?? randomUUID();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "object" && body !== null && "code" in body) {
        response.status(status).json(body);
        return;
      }
      response.status(status).json({
        code: status === HttpStatus.NOT_FOUND ? ERROR_CODES.NOT_FOUND : ERROR_CODES.VALIDATION_ERROR,
        message: typeof body === "string" ? body : exception.message,
      });
      return;
    }

    this.logger.error(
      `Unhandled exception [${correlationId}]: ${exception instanceof Error ? exception.stack : String(exception)}`,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ERROR_CODES.INTERNAL_ERROR,
      message:
        "Something went wrong on our end. Try again, and contact support if it continues.",
      details: { correlationId },
    });
  }
}
