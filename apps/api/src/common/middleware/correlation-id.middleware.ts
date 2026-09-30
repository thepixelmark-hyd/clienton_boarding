import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

const HEADER = "x-correlation-id";

/**
 * Every request gets a correlation id — reused from the caller's header if
 * it already sent one (useful once a mobile client or another service is
 * calling in), otherwise generated fresh. It's echoed back on the response
 * and used by LoggingInterceptor and the global exception filter, so a
 * single id ties together "what the client saw" and "what we logged" for
 * any support/debugging conversation.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers[HEADER];
    const correlationId = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
    req.correlationId = correlationId;
    res.setHeader("X-Correlation-Id", correlationId);
    next();
  }
}
