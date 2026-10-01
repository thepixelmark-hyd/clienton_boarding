import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { clientPortalCan } from "@clientos/shared";
import { Errors } from "../common/errors";
import { PORTAL_PERMISSION_KEY, type RequiredPortalPermission } from "./require-portal-permission.decorator";
import type { PortalContext } from "./current-portal.decorator";

/** Module-local (applied via @UseGuards on PortalController, not a global
 * APP_GUARD) since only portal routes ever declare @RequirePortalPermission.
 * Runs after the global PortalAuthGuard, which is what actually populates
 * `request.portal`. */
@Injectable()
export class PortalPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPortalPermission | undefined>(PORTAL_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const portal: PortalContext | undefined = request.portal;
    if (!portal) throw Errors.unauthenticated();

    if (!clientPortalCan(portal.role, required.action, required.resource)) {
      throw Errors.forbidden();
    }
    return true;
  }
}
