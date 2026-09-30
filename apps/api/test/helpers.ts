import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { Response } from "supertest";

export function sessionCookie(res: Response): string {
  const raw = res.headers["set-cookie"];
  const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = cookies.find((c: string) => c.startsWith("clientos_session="));
  if (!found) throw new Error("No session cookie set in response");
  return found.split(";")[0];
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
  const res = await request(app.getHttpServer()).post("/api/v1/auth/signup").send(body);
  return { res, cookie: sessionCookie(res), body, organizationId: res.body.organization?.id as string };
}
