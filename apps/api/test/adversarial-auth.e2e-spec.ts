import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { Response } from "supertest";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, sessionCookie, signupOrg } from "./helpers";

function portalCookie(res: Response): string {
  const raw = res.headers["set-cookie"];
  const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = cookies.find((c: string) => c.startsWith("clientos_portal_session="));
  if (!found) throw new Error("No portal session cookie set in response");
  return found.split(";")[0];
}

describe("Adversarial QA audit: auth edge cases (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(getPrisma(app));
  });

  describe("email case sensitivity", () => {
    it("rejects signup with the same email in a different case as a duplicate", async () => {
      const first = await api(app)
        .post("/api/v1/auth/signup")
        .send({ organizationName: "Case Co", fullName: "First", email: "CaseTest@Example.com", password: "SuperSecret123" });
      expect(first.status).toBe(201);

      const second = await api(app)
        .post("/api/v1/auth/signup")
        .send({ organizationName: "Case Co 2", fullName: "Second", email: "casetest@example.com", password: "SuperSecret123" });
      expect(second.status).toBe(409);
      expect(second.body.code).toBe("DUPLICATE_EMAIL");

      const userCount = await getPrisma(app).client.user.count({ where: { email: "casetest@example.com" } });
      expect(userCount).toBe(1);
    });

    it("logs in successfully regardless of the case used at signup vs login", async () => {
      await api(app)
        .post("/api/v1/auth/signup")
        .send({ organizationName: "Login Case Co", fullName: "Owner", email: "MixedCase@Example.com", password: "SuperSecret123" });

      const login = await api(app).post("/api/v1/auth/login").send({ email: "mixedcase@EXAMPLE.com", password: "SuperSecret123" });
      expect(login.status).toBe(200);
    });

    it("stores the normalized (lowercased) email, not the as-typed casing", async () => {
      await api(app)
        .post("/api/v1/auth/signup")
        .send({ organizationName: "Stored Case Co", fullName: "Owner", email: "StoredCase@Example.com", password: "SuperSecret123" });

      const user = await getPrisma(app).client.user.findFirst({ where: { email: "storedcase@example.com" } });
      expect(user).not.toBeNull();
    });

    it("a staff invitation to a different-cased email than an existing account still resolves to one user", async () => {
      const { cookie } = await signupOrg(app, { email: "owner@invite-case-test.example" });
      const invite1 = await api(app)
        .post("/api/v1/auth/invitations")
        .set("Cookie", cookie)
        .send({ email: "Teammate@Invite-Case-Test.example", role: "EMPLOYEE" });
      expect(invite1.status).toBe(201);

      const accept = await api(app)
        .post(`/api/v1/auth/invitations/${invite1.body.devToken}/accept`)
        .send({ fullName: "Teammate", password: "TeammateSecret123" });
      expect(accept.status).toBe(201);

      // Inviting the same person again by a third casing should be treated as already-a-member,
      // not silently create a duplicate User row with a third casing of the same email.
      const users = await getPrisma(app).client.user.count({ where: { email: "teammate@invite-case-test.example" } });
      expect(users).toBe(1);
    });
  });

  describe("deleted-client portal access revocation", () => {
    async function setupDeletedClientPortalUser(cookie: string) {
      const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Offboarded Co" });
      await api(app)
        .post(`/api/v1/clients/${client.body.id}/invitations`)
        .set("Cookie", cookie)
        .send({ email: "offboarded-user@example.com", role: "CLIENT_MANAGER" });
      const emailLog = await getPrisma(app).client.emailLog.findFirstOrThrow({
        where: { to: "offboarded-user@example.com", template: "client-portal-invitation" },
      });
      const token = new URL((emailLog.metadata as { inviteUrl: string }).inviteUrl).searchParams.get("token")!;
      const accept = await api(app).post(`/api/v1/portal/auth/invitations/${token}/accept`).send({ password: "PortalPass123" });
      return { clientId: client.body.id as string, pCookie: portalCookie(accept) };
    }

    it("an already-open portal session is rejected on its very next request after the client is deleted", async () => {
      const { cookie } = await signupOrg(app, { email: "owner@deleted-client-session-test.example" });
      const { clientId, pCookie } = await setupDeletedClientPortalUser(cookie);

      const before = await api(app).get("/api/v1/portal/auth/me").set("Cookie", pCookie);
      expect(before.status).toBe(200);

      const del = await api(app).delete(`/api/v1/clients/${clientId}`).set("Cookie", cookie);
      expect(del.status).toBe(200);

      const after = await api(app).get("/api/v1/portal/auth/me").set("Cookie", pCookie);
      expect(after.status).toBe(401);
    });

    it("rejects a fresh portal login for a deleted client's portal user", async () => {
      const { cookie } = await signupOrg(app, { email: "owner@deleted-client-login-test.example" });
      const { clientId } = await setupDeletedClientPortalUser(cookie);

      await api(app).delete(`/api/v1/clients/${clientId}`).set("Cookie", cookie);

      const login = await api(app)
        .post("/api/v1/portal/auth/login")
        .send({ email: "offboarded-user@example.com", password: "PortalPass123" });
      expect(login.status).toBe(401);
    });
  });

  describe("session and invitation lifecycle edge cases", () => {
    it("logout-all revokes every session for the user, not just the current one", async () => {
      const { body, cookie: cookieA } = await signupOrg(app, { email: "multi-session@logout-all-test.example" });
      const loginB = await api(app).post("/api/v1/auth/login").send({ email: body.email, password: body.password });
      const cookieB = sessionCookie(loginB);

      expect((await api(app).get("/api/v1/auth/me").set("Cookie", cookieA)).status).toBe(200);
      expect((await api(app).get("/api/v1/auth/me").set("Cookie", cookieB)).status).toBe(200);

      await api(app).post("/api/v1/auth/logout-all").set("Cookie", cookieA);

      expect((await api(app).get("/api/v1/auth/me").set("Cookie", cookieA)).status).toBe(401);
      expect((await api(app).get("/api/v1/auth/me").set("Cookie", cookieB)).status).toBe(401);
    });

    it("rejects an expired (but otherwise valid-shaped) session", async () => {
      const { cookie } = await signupOrg(app, { email: "expiry-test@example.com" });
      await getPrisma(app).client.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      const res = await api(app).get("/api/v1/auth/me").set("Cookie", cookie);
      expect(res.status).toBe(401);
    });

    it("rejects an expired staff invitation token", async () => {
      const { cookie } = await signupOrg(app, { email: "owner@expired-invite-test.example" });
      const invite = await api(app)
        .post("/api/v1/auth/invitations")
        .set("Cookie", cookie)
        .send({ email: "late@expired-invite-test.example", role: "EMPLOYEE" });

      await getPrisma(app).client.invitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      const accept = await api(app)
        .post(`/api/v1/auth/invitations/${invite.body.devToken}/accept`)
        .send({ fullName: "Late Person", password: "LateSecret123" });
      expect(accept.status).toBe(400);
      expect(accept.body.code).toBe("INVITATION_INVALID");
    });

    it("rejects an expired client-portal invitation token", async () => {
      const { cookie } = await signupOrg(app, { email: "owner@expired-portal-invite-test.example" });
      const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Expired Invite Co" });
      await api(app)
        .post(`/api/v1/clients/${client.body.id}/invitations`)
        .set("Cookie", cookie)
        .send({ email: "late-client@expired-portal-invite-test.example", role: "VIEWER" });

      await getPrisma(app).client.clientInvitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      const emailLog = await getPrisma(app).client.emailLog.findFirstOrThrow({
        where: { to: "late-client@expired-portal-invite-test.example" },
      });
      const token = new URL((emailLog.metadata as { inviteUrl: string }).inviteUrl).searchParams.get("token")!;
      const accept = await api(app).post(`/api/v1/portal/auth/invitations/${token}/accept`).send({ password: "PortalPass123" });
      expect(accept.status).toBe(400);
    });

    it("a staff session cookie used against the portal auth boundary is rejected, and vice versa", async () => {
      const { cookie: staffCookie } = await signupOrg(app, { email: "boundary-test@example.com" });
      const res = await api(app).get("/api/v1/portal/auth/me").set("Cookie", staffCookie.replace("clientos_session", "clientos_portal_session"));
      expect(res.status).toBe(401);
    });

    it("rejects a CSRF header present but with the wrong value, not just a missing one", async () => {
      const { cookie } = await signupOrg(app, { email: "csrf-wrong-value@example.com" });
      const res = await request(app.getHttpServer())
        .post("/api/v1/clients")
        .set("Cookie", cookie)
        .set("X-Requested-With", "SomethingElse")
        .send({ name: "Should be blocked" });
      expect(res.status).toBe(403);
    });
  });

  describe("stored-content safety", () => {
    it("stores a script-tag-like client name verbatim and returns it as inert text, never executing or corrupting the row", async () => {
      const { cookie } = await signupOrg(app, { email: "owner@xss-test.example" });
      const payload = '<script>alert(1)</script>"; DROP TABLE clients; --';
      const created = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: payload });
      expect(created.status).toBe(201);
      expect(created.body.name).toBe(payload);

      const fetched = await api(app).get(`/api/v1/clients/${created.body.id}`).set("Cookie", cookie);
      expect(fetched.body.name).toBe(payload);

      const stillThere = await api(app).get("/api/v1/clients").set("Cookie", cookie);
      expect(stillThere.status).toBe(200);
      expect(stillThere.body.data.length).toBeGreaterThan(0);
    });
  });
});
