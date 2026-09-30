import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { Errors } from "../errors";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Runs after SessionAuthGuard. Cookie-based auth is vulnerable to CSRF
 * (a browser attaches cookies to a cross-site request automatically); a
 * bearer token is not (nothing attaches an Authorization header on your
 * behalf), so this only ever applies to `request.authSource === "cookie"`.
 *
 * The mitigation: state-changing requests authenticated via cookie must
 * carry `X-Requested-With: XMLHttpRequest`. A cross-site <form> submission
 * or a plain cross-site fetch cannot set a custom header without triggering
 * a CORS preflight that our CORS config (origin-restricted, see main.ts)
 * would reject — so a same-origin XHR/fetch is the only thing that can ever
 * satisfy this check. `apps/web/src/lib/api-client.ts` sends this header on
 * every request already.
 *
 * This previously did not exist even though docs/security.md described it
 * as implemented — see docs/architecture-assessment.md §17/§21 (risk #1).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.authSource !== "cookie") return true;
    if (!MUTATING_METHODS.has(request.method)) return true;

    const header = request.headers["x-requested-with"];
    if (header !== "XMLHttpRequest") {
      throw Errors.forbidden(
        "This request is missing a required header and was blocked as a CSRF precaution.",
      );
    }
    return true;
  }
}
