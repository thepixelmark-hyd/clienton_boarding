import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function makeRequest(path: string, cookie?: string) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"));
  if (cookie) req.cookies.set("clientos_session", cookie);
  return req;
}

describe("middleware", () => {
  it("redirects to /login when there is no session cookie on a protected path", () => {
    const res = middleware(makeRequest("/clients"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.headers.get("location")).toContain("from=%2Fclients");
  });

  it("lets a request with a session cookie through to a protected path", () => {
    const res = middleware(makeRequest("/clients", "some-token"));
    expect(res.status).toBe(200); // NextResponse.next() reports as a pass-through 200
  });

  it("does not redirect an unauthenticated request to /login itself", () => {
    const res = middleware(makeRequest("/login"));
    expect(res.status).toBe(200);
  });

  it("does not redirect an unauthenticated request to /signup itself", () => {
    const res = middleware(makeRequest("/signup"));
    expect(res.status).toBe(200);
  });

  it("redirects an already-authenticated request away from /login", () => {
    const res = middleware(makeRequest("/login", "some-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects an already-authenticated request away from /signup", () => {
    const res = middleware(makeRequest("/signup", "some-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("preserves the originally requested path in the redirect's `from` param", () => {
    const res = middleware(makeRequest("/projects/abc123"));
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("from")).toBe("/projects/abc123");
  });
});
