import type { TenantContext } from "../decorators/current-tenant.decorator";

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      user?: { id: string; email: string; fullName: string };
      sessionId?: string;
      /** How this request authenticated — set by SessionAuthGuard. CSRF
       * header enforcement (CsrfGuard) only applies to 'cookie', since
       * a bearer token is never sent automatically by a browser the way
       * an ambient cookie is (see docs/security.md). */
      authSource?: "cookie" | "bearer";
      correlationId?: string;
    }
  }
}

export {};
