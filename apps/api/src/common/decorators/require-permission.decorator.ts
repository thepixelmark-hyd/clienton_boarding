import { SetMetadata } from "@nestjs/common";
import type { Action, Resource } from "@clientos/shared";

export const PERMISSION_KEY = "requiredPermission";

export interface RequiredPermission {
  action: Action;
  resource: Resource;
}

/**
 * Declares the permission a route requires, checked against the resolved
 * membership role via the organization permission matrix
 * (packages/shared/src/roles.ts) — see docs/security.md.
 */
export const RequirePermission = (action: Action, resource: Resource) =>
  SetMetadata(PERMISSION_KEY, { action, resource } satisfies RequiredPermission);
