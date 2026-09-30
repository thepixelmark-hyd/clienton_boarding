import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  acceptInvitationSchema,
  inviteMemberSchema,
  loginSchema,
  signupSchema,
  type AcceptInvitationInput,
  type InviteMemberInput,
  type LoginInput,
  type SignupInput,
} from "@clientos/shared";
import { AuthService } from "./auth.service";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, type CurrentUserData } from "../common/decorators/current-user.decorator";
import { CurrentTenant, type TenantContext } from "../common/decorators/current-tenant.decorator";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

function requestMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("signup")
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { organization, user, session } = await this.authService.signup(body, requestMeta(req));
    this.setSessionCookie(res, session.token, session.expiresAt);
    return { organization: sanitizeOrg(organization), user: sanitizeUser(user) };
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.authService.login(body, requestMeta(req));
    this.setSessionCookie(res, session.token, session.expiresAt);
    return { user: sanitizeUser(user) };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.sessionId) await this.authService.logout(req.sessionId);
    res.clearCookie(process.env.SESSION_COOKIE_NAME ?? "clientos_session", SESSION_COOKIE_OPTIONS);
    return { success: true };
  }

  @Post("logout-all")
  @HttpCode(200)
  async logoutAll(@CurrentUser() user: CurrentUserData, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutAllSessions(user.id);
    res.clearCookie(process.env.SESSION_COOKIE_NAME ?? "clientos_session", SESSION_COOKIE_OPTIONS);
    return { success: true };
  }

  @Get("me")
  async me(@CurrentUser() user: CurrentUserData) {
    const fullUser = await this.authService.me(user.id);
    return {
      id: fullUser.id,
      email: fullUser.email,
      fullName: fullUser.fullName,
      memberships: fullUser.memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role,
      })),
    };
  }

  @Get("members")
  @RequirePermission("view", "member")
  listMembers(@CurrentTenant() tenant: TenantContext) {
    return this.authService.listMembers(tenant.organizationId);
  }

  @Post("invitations")
  @RequirePermission("invite", "member")
  async invite(
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.authService.invite(tenant.organizationId, tenant.userId, body);
  }

  @Public()
  @Post("invitations/:token/accept")
  async acceptInvite(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(acceptInvitationSchema.omit({ token: true })))
    body: Omit<AcceptInvitationInput, "token">,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.authService.acceptInvitation(
      { ...body, token },
      requestMeta(req),
    );
    this.setSessionCookie(res, session.token, session.expiresAt);
    return { user: sanitizeUser(user) };
  }

  private setSessionCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(process.env.SESSION_COOKIE_NAME ?? "clientos_session", token, {
      ...SESSION_COOKIE_OPTIONS,
      expires: expiresAt,
    });
  }
}

// Never return passwordHash — enforced by shape, not convention (see
// docs/security.md "What was verified this phase").
function sanitizeUser(user: { id: string; email: string; fullName: string }) {
  return { id: user.id, email: user.email, fullName: user.fullName };
}
function sanitizeOrg(org: { id: string; name: string; slug: string }) {
  return { id: org.id, name: org.name, slug: org.slug };
}
