import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { ClientPortalRole } from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { hashToken } from "../auth/session.util";
import { Errors } from "../common/errors";
import { PORTAL_AUTH_KEY } from "./require-portal-auth.decorator";

export const PORTAL_SESSION_COOKIE_NAME = "clientos_portal_session";

/**
 * Registered globally (app.module.ts), right after SessionAuthGuard and
 * before CsrfGuard — deliberately, not an accident of list order. It is a
 * no-op for every non-portal request (no portal cookie present, nothing to
 * resolve), so it's safe alongside the staff auth guard without touching
 * existing behavior. When a portal cookie IS present, it resolves it and
 * sets `request.authSource = "cookie"` *before* CsrfGuard runs — if this
 * guard were module-local (@UseGuards on PortalController) instead, it
 * would run too late for CsrfGuard to ever see that a portal cookie
 * authenticated the request, silently disabling CSRF protection for every
 * portal mutation. See docs/security.md.
 */
@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresPortalAuth = this.reflector.getAllAndOverride<boolean>(PORTAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[PORTAL_SESSION_COOKIE_NAME];

    if (!token) {
      if (requiresPortalAuth) throw Errors.unauthenticated();
      return true;
    }

    const tokenHash = hashToken(token);
    const session = await this.prisma.client.clientPortalSession.findUnique({
      where: { tokenHash },
      include: { clientPortalUser: { include: { client: { select: { deletedAt: true } } } } },
    });
    // A client that's been offboarded (soft-deleted) must lose portal access
    // immediately, not just drop off the staff-side client list — checked
    // here (not only at login) so an already-open session from before the
    // deletion is cut off on its very next request, the same way a revoked
    // or expired session already is. See portal-auth.service.ts's login()
    // for the matching check at sign-in time.
    const invalid =
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() < Date.now() ||
      session.clientPortalUser.client.deletedAt !== null;

    if (invalid || !session) {
      if (requiresPortalAuth) throw Errors.unauthenticated();
      return true;
    }

    request.portal = {
      clientPortalUserId: session.clientPortalUser.id,
      clientId: session.clientPortalUser.clientId,
      organizationId: session.clientPortalUser.organizationId,
      role: session.clientPortalUser.role as ClientPortalRole,
      contactId: session.clientPortalUser.contactId,
    };
    request.authSource = "cookie";
    return true;
  }
}
