import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, sessionCookie, signupOrg } from "./helpers";

describe("Auth (e2e)", () => {
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

  it("signs up an organization + owner atomically and does not return the password hash", async () => {
    const { res } = await signupOrg(app, { email: "owner@signup-test.example" });
    expect(res.status).toBe(201);
    expect(res.body.organization.name).toBeDefined();
    expect(res.body.user.email).toBe("owner@signup-test.example");
    expect(res.body.user).not.toHaveProperty("passwordHash");

    const prisma = getPrisma(app);
    const membership = await prisma.client.membership.findFirst({
      where: { user: { email: "owner@signup-test.example" } },
    });
    expect(membership?.role).toBe("OWNER");
  });

  it("rejects signup with a duplicate email", async () => {
    await signupOrg(app, { email: "dupe@signup-test.example" });
    const res = await api(app).post("/api/v1/auth/signup").send({
      organizationName: "Second Org",
      fullName: "Second Owner",
      email: "dupe@signup-test.example",
      password: "SuperSecret123",
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE_EMAIL");
  });

  it("rejects a weak password with a validation error, not a 500", async () => {
    const res = await api(app).post("/api/v1/auth/signup").send({
      organizationName: "Weak Password Co",
      fullName: "Test User",
      email: "weakpass@signup-test.example",
      password: "weak",
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("logs in with correct credentials and rejects incorrect ones identically (no user enumeration)", async () => {
    const { body } = await signupOrg(app, { email: "login@signup-test.example", password: "CorrectHorse123" });

    const good = await api(app)
      .post("/api/v1/auth/login")
      .send({ email: body.email, password: "CorrectHorse123" });
    expect(good.status).toBe(200);

    const badPassword = await api(app)
      .post("/api/v1/auth/login")
      .send({ email: body.email, password: "WrongPassword123" });
    expect(badPassword.status).toBe(401);
    expect(badPassword.body.code).toBe("INVALID_CREDENTIALS");

    const badEmail = await api(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@signup-test.example", password: "WrongPassword123" });
    expect(badEmail.status).toBe(401);
    expect(badEmail.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects requests with no session cookie", async () => {
    const res = await api(app).get("/api/v1/clients");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("rejects requests with a garbage/unknown session cookie", async () => {
    const res = await api(app)
      .get("/api/v1/clients")
      .set("Cookie", "clientos_session=not-a-real-token-at-all");
    expect(res.status).toBe(401);
  });

  it("logout revokes the session so it can no longer be used", async () => {
    const { cookie } = await signupOrg(app, { email: "logout@signup-test.example" });

    const beforeLogout = await api(app).get("/api/v1/auth/me").set("Cookie", cookie);
    expect(beforeLogout.status).toBe(200);

    const logoutRes = await api(app).post("/api/v1/auth/logout").set("Cookie", cookie);
    expect(logoutRes.status).toBe(200);

    const afterLogout = await api(app).get("/api/v1/auth/me").set("Cookie", cookie);
    expect(afterLogout.status).toBe(401);
  });

  it("invites a member with a role and lets them accept and log in with that role", async () => {
    const { cookie } = await signupOrg(app, { email: "inviter@signup-test.example" });

    const invite = await api(app)
      .post("/api/v1/auth/invitations")
      .set("Cookie", cookie)
      .send({ email: "invitee@signup-test.example", role: "PROJECT_MANAGER" });
    expect(invite.status).toBe(201);
    const token = invite.body.devToken;
    expect(token).toBeDefined();

    const accept = await api(app)
      .post(`/api/v1/auth/invitations/${token}/accept`)
      .send({ fullName: "Invited PM", password: "InviteeSecret123" });
    expect(accept.status).toBe(201);

    const meRes = await api(app)
      .get("/api/v1/auth/me")
      .set("Cookie", sessionCookie(accept));
    expect(meRes.body.memberships[0].role).toBe("PROJECT_MANAGER");
  });

  it("rejects an invitation token that has already been used", async () => {
    const { cookie } = await signupOrg(app, { email: "inviter2@signup-test.example" });
    const invite = await api(app)
      .post("/api/v1/auth/invitations")
      .set("Cookie", cookie)
      .send({ email: "invitee2@signup-test.example", role: "EMPLOYEE" });
    const token = invite.body.devToken;

    await api(app)
      .post(`/api/v1/auth/invitations/${token}/accept`)
      .send({ fullName: "First Accept", password: "InviteeSecret123" });

    const second = await api(app)
      .post(`/api/v1/auth/invitations/${token}/accept`)
      .send({ fullName: "Second Accept", password: "InviteeSecret123" });
    expect(second.status).toBe(400);
    expect(second.body.code).toBe("INVITATION_INVALID");
  });
});
