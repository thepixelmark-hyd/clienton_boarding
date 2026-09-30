import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { Response, Test } from "supertest";

export function sessionCookie(res: Response): string {
  const raw = res.headers["set-cookie"];
  const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = cookies.find((c: string) => c.startsWith("clientos_session="));
  if (!found) throw new Error("No session cookie set in response");
  return found.split(";")[0];
}

/**
 * Every cookie-authenticated mutating request now has to carry
 * `X-Requested-With` or CsrfGuard rejects it with 403 (see
 * apps/api/src/common/guards/csrf.guard.ts) — exactly what a real browser
 * fetch through apps/web/src/lib/api-client.ts already sends. Route every
 * e2e request through this instead of supertest directly so that header is
 * never something an individual test has to remember.
 */
export function api(app: INestApplication) {
  const server = app.getHttpServer();
  const withCsrfHeader = (req: Test): Test => req.set("X-Requested-With", "XMLHttpRequest");
  return {
    get: (url: string) => request(server).get(url),
    post: (url: string) => withCsrfHeader(request(server).post(url)),
    patch: (url: string) => withCsrfHeader(request(server).patch(url)),
    put: (url: string) => withCsrfHeader(request(server).put(url)),
    delete: (url: string) => withCsrfHeader(request(server).delete(url)),
  };
}

let counter = 0;

export async function signupOrg(
  app: INestApplication,
  overrides: Partial<{ organizationName: string; fullName: string; email: string; password: string }> = {},
) {
  counter += 1;
  const body = {
    organizationName: overrides.organizationName ?? `Test Agency ${counter}`,
    fullName: overrides.fullName ?? "Test Owner",
    email: overrides.email ?? `owner-${Date.now()}-${counter}@example.com`,
    password: overrides.password ?? "SuperSecret123",
  };
  const res = await api(app).post("/api/v1/auth/signup").send(body);
  return { res, cookie: sessionCookie(res), body, organizationId: res.body.organization?.id as string };
}
