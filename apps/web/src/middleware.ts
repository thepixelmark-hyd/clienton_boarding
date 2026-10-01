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

const PORTAL_SESSION_COOKIE_NAME = "clientos_portal_session";
const PORTAL_AUTH_ONLY_PATHS = ["/portal/login", "/portal/accept-invite"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The client portal is a second, independent auth boundary with its own
  // cookie and its own login page — it never shares a session with the
  // staff app (see apps/api/src/portal). Handled first and separately so
  // the staff-cookie check below never runs against /portal/* at all.
  if (pathname.startsWith("/portal")) {
    const hasPortalCookie = request.cookies.has(PORTAL_SESSION_COOKIE_NAME);
    const isPortalAuthOnlyPath = PORTAL_AUTH_ONLY_PATHS.includes(pathname);

    if (!hasPortalCookie && !isPortalAuthOnlyPath) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    if (hasPortalCookie && isPortalAuthOnlyPath) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
    return NextResponse.next();
  }

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
