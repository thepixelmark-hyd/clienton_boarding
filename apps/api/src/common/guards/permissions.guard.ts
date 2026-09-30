import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { can } from "@clientos/shared";
import { PERMISSION_KEY, type RequiredPermission } from "../decorators/require-permission.decorator";
import { Errors } from "../errors";
import type { TenantContext } from "../decorators/current-tenant.decorator";

/**
 * Runs after SessionAuthGuard. Checks the resolved role from
 * `request.tenant` against the route's declared @RequirePermission — the
 * permission matrix (packages/shared/src/roles.ts) is the single source of
 * truth, never an inline `if (role === 'ADMIN')` at the call site.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const tenant: TenantContext | undefined = request.tenant;
    if (!tenant) throw Errors.unauthenticated();

    if (!can(tenant.role, required.action, required.resource)) {
      throw Errors.forbidden();
    }
    return true;
  }
}
