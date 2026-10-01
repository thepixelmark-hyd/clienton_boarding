import { SetMetadata } from "@nestjs/common";
import type { Action, PortalResource } from "@clientos/shared";

export const PORTAL_PERMISSION_KEY = "requiredPortalPermission";

export interface RequiredPortalPermission {
  action: Action;
  resource: PortalResource;
}

/** The portal's equivalent of @RequirePermission — checked against
 * clientPortalCan (packages/shared/src/roles.ts) by PortalPermissionsGuard,
 * a module-local guard (not global, unlike PermissionsGuard) since only
 * PortalController routes ever use it. */
export const RequirePortalPermission = (action: Action, resource: PortalResource) =>
  SetMetadata(PORTAL_PERMISSION_KEY, { action, resource } satisfies RequiredPortalPermission);
