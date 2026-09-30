import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * A cheap, cookie-presence-only auth boundary that runs before any page's
 * HTML is generated — it never validates the session (that still happens
 * server-side, per-request, in the API via SessionAuthGuard; a middleware
 * doing a real DB lookup on every request would just move that cost here
 * without removing it there). Its only job is to close the "flash of
 * protected shell" gap: without this, a protected page's component tree
 * still rendered and shipped before the client-side `useMe()` check in
 * AppShell could redirect on a 401 (see docs/architecture-assessment.md
 * §1.4 finding 4 and §3). AppShell's real check still runs on every
 * protected page for actual validity (expired/revoked/garbage tokens).
 */
const SESSION_COOKIE_NAME = "clientos_session";
const AUTH_ONLY_PATHS = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  const isAuthOnlyPath = AUTH_ONLY_PATHS.includes(pathname);

  if (!hasSessionCookie && !isAuthOnlyPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSessionCookie && isAuthOnlyPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets and Next internals; everything else (every app
  // route) goes through the check above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
