import type { TenantContext } from "../decorators/current-tenant.decorator";
import type { PortalContext } from "../../portal/current-portal.decorator";

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      user?: { id: string; email: string; fullName: string };
      sessionId?: string;
      /** Set by PortalAuthGuard — entirely separate from `tenant`/`user`
       * above, which only ever describe a staff (internal User) session.
       * A request never has both: the portal cookie and the staff cookie
       * are different names, and the two user tables are unrelated. */
      portal?: PortalContext;
      /** How this request authenticated — set by SessionAuthGuard or
       * PortalAuthGuard, whichever actually found a token. CSRF header
       * enforcement (CsrfGuard) only applies to 'cookie', since a bearer
       * token is never sent automatically by a browser the way an ambient
       * cookie is (see docs/security.md). */
      authSource?: "cookie" | "bearer";
      correlationId?: string;
    }
  }
}

export {};
