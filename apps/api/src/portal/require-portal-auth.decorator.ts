import { SetMetadata } from "@nestjs/common";

export const PORTAL_AUTH_KEY = "requiresPortalAuth";

/** Marks a route as requiring a valid portal session (checked by the global
 * PortalAuthGuard). Every portal route also needs `@Public()` so the
 * *staff* SessionAuthGuard doesn't reject it for lacking a staff cookie —
 * the two guards check entirely different cookies for entirely different
 * user tables. Routes that don't need this (login, invitation accept) skip
 * it: PortalAuthGuard still opportunistically resolves a portal cookie if
 * one happens to be present (so CsrfGuard sees the right authSource), but
 * won't reject the request when there isn't one. */
export const RequirePortalAuth = () => SetMetadata(PORTAL_AUTH_KEY, true);
