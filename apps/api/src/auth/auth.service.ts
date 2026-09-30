import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type {
  AcceptInvitationInput,
  InviteMemberInput,
  LoginInput,
  SignupInput,
} from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { Errors } from "../common/errors";
import {
  generateSessionToken,
  hashToken,
  INVITATION_TTL_MS,
  SESSION_TTL_MS,
} from "./session.util";

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB, OWASP-recommended minimum for argon2id
  timeCost: 2,
  parallelism: 1,
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "org"}-${randomBytes(3).toString("hex")}`;
}

export interface SessionIssueResult {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Creates an Organization and its Owner User atomically. This is the only
   * unauthenticated write path in the whole API that creates a tenant.
   */
  async signup(input: SignupInput, meta: { ipAddress?: string; userAgent?: string }) {
    const existing = await this.prisma.client.user.findUnique({ where: { email: input.email } });
    if (existing) throw Errors.duplicateEmail();

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    const result = await this.prisma.client.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.organizationName, slug: slugify(input.organizationName) },
      });
      const user = await tx.user.create({
        data: { email: input.email, fullName: input.fullName, passwordHash },
      });
      await tx.membership.create({
        data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
      });
      return { organization, user };
    });

    await this.audit.record({
      organizationId: result.organization.id,
      actorUserId: result.user.id,
      entityType: "Organization",
      entityId: result.organization.id,
      action: "CREATED",
      after: { name: result.organization.name },
    });

    const session = await this.issueSession(result.user.id, meta);
    return { organization: result.organization, user: result.user, session };
  }

  async login(input: LoginInput, meta: { ipAddress?: string; userAgent?: string }) {
    const user = await this.prisma.client.user.findUnique({ where: { email: input.email } });
    if (!user || user.deletedAt) throw Errors.invalidCredentials();

    const valid = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!valid) throw Errors.invalidCredentials();

    const session = await this.issueSession(user.id, meta);
    return { user, session };
  }

  async logout(sessionId: string) {
    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAllSessions(userId: string) {
    await this.prisma.client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { where: { status: "ACTIVE" }, include: { organization: true } } },
    });
    return user;
  }

  async listMembers(organizationId: string) {
    return this.prisma.client.membership.findMany({
      where: { organizationId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
    });
  }

  async invite(organizationId: string, invitedById: string, input: InviteMemberInput) {
    const existingMembership = await this.prisma.client.membership.findFirst({
      where: { organizationId, user: { email: input.email } },
    });
    if (existingMembership) {
      throw Errors.validation("This person is already a member of your organization.");
    }

    const rawToken = generateSessionToken();
    const invitation = await this.prisma.client.invitation.create({
      data: {
        organizationId,
        email: input.email,
        role: input.role,
        tokenHash: hashToken(rawToken),
        invitedById,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });

    await this.audit.record({
      organizationId,
      actorUserId: invitedById,
      entityType: "Invitation",
      entityId: invitation.id,
      action: "CREATED",
      after: { email: input.email, role: input.role },
    });

    // Email delivery is a Phase 5 background job (docs/architecture.md
    // "Known gaps"); returning the raw token here lets the demo/dev flow
    // complete the invite without a mail server. Do not do this in
    // production — the token belongs in the emailed link, not the response.
    return { invitation, ...(process.env.NODE_ENV !== "production" ? { devToken: rawToken } : {}) };
  }

  async acceptInvitation(input: AcceptInvitationInput, meta: { ipAddress?: string; userAgent?: string }) {
    const tokenHash = hashToken(input.token);
    const invitation = await this.prisma.client.invitation.findUnique({ where: { tokenHash } });

    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.expiresAt.getTime() < Date.now()
    ) {
      throw Errors.invitationInvalid();
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    const user = await this.prisma.client.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email: invitation.email } });
      if (!user) {
        user = await tx.user.create({
          data: { email: invitation.email, fullName: input.fullName, passwordHash },
        });
      }
      await tx.membership.create({
        data: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      return user;
    });

    await this.audit.record({
      organizationId: invitation.organizationId,
      actorUserId: user.id,
      entityType: "Membership",
      entityId: user.id,
      action: "INVITATION_ACCEPTED",
      after: { role: invitation.role },
    });

    const session = await this.issueSession(user.id, meta);
    return { user, session };
  }

  private async issueSession(
    userId: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<SessionIssueResult> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.client.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
    return { token, expiresAt };
  }
}
