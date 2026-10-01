import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Request, Response } from "express";
import {
  acceptClientInvitationSchema,
  portalLoginSchema,
  type AcceptClientInvitationInput,
  type PortalLoginInput,
} from "@clientos/shared";
import { PortalAuthService } from "./portal-auth.service";
import { Public } from "../common/decorators/public.decorator";
import { RequirePortalAuth } from "./require-portal-auth.decorator";
import { CurrentPortal, type PortalContext } from "./current-portal.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { hashToken } from "../auth/session.util";
import { PORTAL_SESSION_COOKIE_NAME } from "./portal-auth.guard";

const PORTAL_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Every route here is @Public() — the *staff* SessionAuthGuard must never
 * reject these for lacking a staff cookie, since none of them involve a
 * staff session at all. Portal-specific auth is enforced by
 * @RequirePortalAuth() + the global PortalAuthGuard instead, per route. */
@Controller("portal/auth")
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(portalLoginSchema)) body: PortalLoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { portalUser, session } = await this.portalAuthService.login(body);
    this.setSessionCookie(res, session.token, session.expiresAt);
    return { portalUser: sanitizePortalUser(portalUser) };
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[PORTAL_SESSION_COOKIE_NAME];
    if (token) await this.portalAuthService.logout(hashToken(token));
    res.clearCookie(PORTAL_SESSION_COOKIE_NAME, PORTAL_SESSION_COOKIE_OPTIONS);
    return { success: true };
  }

  @Public()
  @RequirePortalAuth()
  @Get("me")
  async me(@CurrentPortal() portal: PortalContext) {
    const portalUser = await this.portalAuthService.me(portal.clientPortalUserId);
    return {
      id: portalUser.id,
      email: portalUser.email,
      role: portalUser.role,
      client: portalUser.client,
    };
  }

  @Public()
  @Post("invitations/:token/accept")
  async acceptInvite(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(acceptClientInvitationSchema.omit({ token: true })))
    body: Omit<AcceptClientInvitationInput, "token">,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { portalUser, session } = await this.portalAuthService.acceptInvitation({ ...body, token });
    this.setSessionCookie(res, session.token, session.expiresAt);
    return { portalUser: sanitizePortalUser(portalUser) };
  }

  private setSessionCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(PORTAL_SESSION_COOKIE_NAME, token, { ...PORTAL_SESSION_COOKIE_OPTIONS, expires: expiresAt });
  }
}

// Never return passwordHash, same rule as the staff AuthController.
function sanitizePortalUser(portalUser: { id: string; email: string; role: string; clientId: string }) {
  return { id: portalUser.id, email: portalUser.email, role: portalUser.role, clientId: portalUser.clientId };
}
