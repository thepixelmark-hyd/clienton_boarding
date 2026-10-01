import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import type { AcceptClientInvitationInput, PortalLoginInput } from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { Errors } from "../common/errors";
import { generateSessionToken, hashToken, SESSION_TTL_MS } from "../auth/session.util";

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export interface PortalSessionIssueResult {
  token: string;
  expiresAt: Date;
}

/**
 * A second, fully independent auth system from AuthService — a
 * ClientPortalUser is not a User row, and a ClientPortalSession is not a
 * Session row (see schema.prisma's Client CRM section). Sharing argon2
 * parameters/token generation with the staff auth system is intentional
 * (same security properties); sharing tables would not be.
 */
@Injectable()
export class PortalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // No ipAddress/userAgent capture here (ClientPortalSession has no columns
  // for them, unlike Session) — not an oversight, just not yet needed; add
  // alongside a real "portal session management" UI if one gets built.
  async login(input: PortalLoginInput) {
    // Known simplification (documented, not accidental): the same email can
    // legitimately belong to a ClientPortalUser at more than one Client
    // (@@unique is [clientId, email], not [email]) — e.g. an outside
    // consultant on two different accounts. Login resolves to whichever was
    // created first. A multi-account picker is future work, not needed for
    // this phase's one-portal-account-per-person common case.
    const portalUser = await this.prisma.client.clientPortalUser.findFirst({
      where: { email: input.email },
      orderBy: { createdAt: "asc" },
    });
    if (!portalUser) throw Errors.invalidCredentials();

    const valid = await argon2.verify(portalUser.passwordHash, input.password).catch(() => false);
    if (!valid) throw Errors.invalidCredentials();

    const session = await this.issueSession(portalUser.id);
    await this.prisma.client.clientPortalUser.update({
      where: { id: portalUser.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.record({
      organizationId: portalUser.organizationId,
      entityType: "ClientPortalSession",
      entityId: portalUser.id,
      action: "PORTAL_LOGIN_SUCCESS",
    });

    return { portalUser, session };
  }

  async logout(tokenHash: string) {
    await this.prisma.client.clientPortalSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(clientPortalUserId: string) {
    const portalUser = await this.prisma.client.clientPortalUser.findUniqueOrThrow({
      where: { id: clientPortalUserId },
      include: { client: { select: { id: true, name: true, logoUrl: true } } },
    });
    return portalUser;
  }

  async acceptInvitation(input: AcceptClientInvitationInput) {
    const tokenHash = hashToken(input.token);
    const invitation = await this.prisma.client.clientInvitation.findUnique({ where: { tokenHash } });

    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt.getTime() < Date.now()) {
      throw Errors.invitationInvalid();
    }

    const existing = await this.prisma.client.clientPortalUser.findFirst({
      where: { clientId: invitation.clientId, email: invitation.email },
    });
    if (existing) throw Errors.validation("This person already has client portal access.");

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    const portalUser = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.clientPortalUser.create({
        data: {
          organizationId: invitation.organizationId,
          clientId: invitation.clientId,
          contactId: invitation.contactId,
          email: invitation.email,
          passwordHash,
          role: invitation.role,
        },
      });
      await tx.clientInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      await tx.clientTimelineEvent.create({
        data: {
          organizationId: invitation.organizationId,
          clientId: invitation.clientId,
          type: "PORTAL_INVITATION_ACCEPTED",
          title: `Portal invitation accepted by ${invitation.email}`,
        },
      });
      return created;
    });

    await this.audit.record({
      organizationId: invitation.organizationId,
      entityType: "ClientPortalUser",
      entityId: portalUser.id,
      action: "CREATED",
      after: { email: portalUser.email, role: portalUser.role },
    });

    const session = await this.issueSession(portalUser.id);
    return { portalUser, session };
  }

  private async issueSession(clientPortalUserId: string): Promise<PortalSessionIssueResult> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.client.clientPortalSession.create({
      data: {
        clientPortalUserId,
        tokenHash: hashToken(token),
        expiresAt,
      },
    });
    return { token, expiresAt };
  }
}
