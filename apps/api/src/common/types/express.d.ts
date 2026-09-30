import type { TenantContext } from "../decorators/current-tenant.decorator";

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      user?: { id: string; email: string; fullName: string };
      sessionId?: string;
    }
  }
}

export {};
