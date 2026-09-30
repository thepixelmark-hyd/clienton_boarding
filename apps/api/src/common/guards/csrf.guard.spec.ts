import type { ExecutionContext } from "@nestjs/common";
import { CsrfGuard } from "./csrf.guard";
import { AppError } from "../errors";

interface MockRequest {
  authSource?: "cookie" | "bearer";
  method: string;
  headers: Record<string, string>;
}

function mockContext(request: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

describe("CsrfGuard", () => {
  const guard = new CsrfGuard();

  it("allows a bearer-authenticated request regardless of method or header", () => {
    const ctx = mockContext({ authSource: "bearer", method: "POST", headers: {} });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("allows a cookie-authenticated GET request without the header", () => {
    const ctx = mockContext({ authSource: "cookie", method: "GET", headers: {} });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("rejects a cookie-authenticated POST without the header", () => {
    const ctx = mockContext({ authSource: "cookie", method: "POST", headers: {} });
    expect(() => guard.canActivate(ctx)).toThrow(AppError);
  });

  it.each(["PUT", "PATCH", "DELETE"])("rejects a cookie-authenticated %s without the header", (method) => {
    const ctx = mockContext({ authSource: "cookie", method, headers: {} });
    expect(() => guard.canActivate(ctx)).toThrow(AppError);
  });

  it("allows a cookie-authenticated POST with the correct header", () => {
    const ctx = mockContext({
      authSource: "cookie",
      method: "POST",
      headers: { "x-requested-with": "XMLHttpRequest" },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("rejects a cookie-authenticated POST with the wrong header value", () => {
    const ctx = mockContext({
      authSource: "cookie",
      method: "POST",
      headers: { "x-requested-with": "something-else" },
    });
    expect(() => guard.canActivate(ctx)).toThrow(AppError);
  });
});
