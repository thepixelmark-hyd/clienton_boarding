import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { ClientPortalRole } from "@clientos/shared";

export interface PortalContext {
  clientPortalUserId: string;
  clientId: string;
  organizationId: string;
  role: ClientPortalRole;
  contactId: string | null;
}

/** The authenticated portal session's resolved context, attached by
 * PortalAuthGuard — the portal's equivalent of @CurrentTenant(). Every
 * portal-facing query must scope by `clientId` here, not just
 * `organizationId` (see FormsService.assertFormBelongsToClient). */
export const CurrentPortal = createParamDecorator((_: unknown, ctx: ExecutionContext): PortalContext => {
  const request = ctx.switchToHttp().getRequest();
  return request.portal;
});
