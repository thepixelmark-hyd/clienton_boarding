import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

/**
 * Structured, one-line-per-request access log: method, path, status,
 * duration, correlation id, and — once resolved by SessionAuthGuard — the
 * organization id, without ever logging request/response bodies (session
 * tokens, passwords, form answers) or query strings (which can carry
 * search terms a client typed). This is the "logging" half of the
 * logging+error-handling foundation; the exception filter (which does log
 * bodies for 5xx diagnosis, server-side only) is the other half.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response, start),
        error: () => this.log(request, response, start),
      }),
    );
  }

  private log(request: Request, response: Response, start: number) {
    const durationMs = Date.now() - start;
    const orgId = request.tenant?.organizationId;
    this.logger.log(
      `${request.method} ${request.path} ${response.statusCode} ${durationMs}ms` +
        ` correlationId=${request.correlationId}` +
        (orgId ? ` org=${orgId}` : ""),
    );
  }
}
