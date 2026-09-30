import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { hashToken } from "../../auth/session.util";
import { Errors } from "../errors";
import type { OrgRole } from "@clientos/shared";

/**
 * Global guard (registered as APP_GUARD in app.module.ts). Resolves the
 * session token -> Session row -> User -> Membership on every request and
 * attaches `request.tenant`. Route handlers must read organizationId/role
 * from `request.tenant` (via @CurrentTenant()), never from client input.
 *
 * Dual auth source: the browser web app authenticates via the httpOnly
 * session cookie; the Android client (which cannot maintain a browser
 * cookie jar the way biometric-gated token storage expects) authenticates
 * via `Authorization: Bearer <token>` instead. Both paths resolve against
 * the exact same `Session` table by the same `tokenHash` lookup — issuing
 * a mobile-friendly token is not a second auth system, just a second place
 * the same opaque token can travel (see docs/architecture-assessment.md §4).
 * `request.authSource` records which one was used, because CsrfGuard's
 * mitigation only makes sense for the cookie path (see csrf.guard.ts).
 *
 * Known simplification (documented, not accidental): a User's *first*
 * active Membership is used as their tenant context. Multi-organization
 * membership is supported in the data model, but an org-switcher UI is not
 * built this phase — see docs/architecture-assessment.md §7 roadmap.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const { token, source } = this.extractToken(request);

    if (!token) {
      if (isPublic) return true;
      throw Errors.unauthenticated();
    }

    const tokenHash = hashToken(token);
    const session = await this.prisma.client.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: 1 },
          },
        },
      },
    });

    const isExpiredOrRevoked =
      !session || session.revokedAt !== null || session.expiresAt.getTime() < Date.now();

    if (isExpiredOrRevoked || !session) {
      if (isPublic) return true;
      throw Errors.unauthenticated();
    }

    // A valid session always identifies a user, even before a tenant is
    // resolved — logout and "who am I" need this regardless of membership.
    request.user = { id: session.user.id, email: session.user.email, fullName: session.user.fullName };
    request.sessionId = session.id;
    request.authSource = source;

    const membership = session.user.memberships[0];
    if (!membership) {
      // A user with no active organization membership has no tenant context
      // for anything tenant-scoped, but the session itself is still valid.
      if (isPublic) return true;
      throw Errors.unauthenticated();
    }

    request.tenant = {
      userId: session.user.id,
      organizationId: membership.organizationId,
      role: membership.role as OrgRole,
      sessionId: session.id,
    };

    return true;
  }

  private extractToken(request: Request): { token: string | undefined; source: "cookie" | "bearer" } {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return { token: authHeader.slice("Bearer ".length).trim(), source: "bearer" };
    }
    const cookieName = process.env.SESSION_COOKIE_NAME ?? "clientos_session";
    return { token: request.cookies?.[cookieName], source: "cookie" };
  }
}
