import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { OrgRole } from "@clientos/shared";

export interface TenantContext {
  userId: string;
  organizationId: string;
  role: OrgRole;
  sessionId: string;
}

/**
 * The authenticated request's resolved tenant context, attached by
 * SessionAuthGuard. Handlers read organizationId/role from here — NEVER
 * from request params/body/query — so a client can never assert its own
 * tenant or role (docs/architecture.md "Multi-tenancy model").
 */
export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext): TenantContext => {
  const request = ctx.switchToHttp().getRequest();
  return request.tenant;
});
