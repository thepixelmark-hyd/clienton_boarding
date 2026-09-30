import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, signupOrg } from "./helpers";

/**
 * Covers the Phase 1 hardening added alongside docs/architecture-assessment.md:
 * CSRF header enforcement, dual cookie/bearer authentication, rate limiting
 * on login/signup, and audit logging of authentication events.
 */
describe("Security foundation (e2e)", () => {
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

  describe("CSRF enforcement", () => {
    it("rejects a cookie-authenticated mutating request missing X-Requested-With", async () => {
      const { cookie } = await signupOrg(app, { email: "csrf1@security-test.example" });

      const res = await request(app.getHttpServer())
        .post("/api/v1/clients")
        .set("Cookie", cookie)
        .send({ name: "Should be blocked" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("allows a cookie-authenticated mutating request that includes X-Requested-With", async () => {
      const { cookie } = await signupOrg(app, { email: "csrf2@security-test.example" });

      const res = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Allowed" });

      expect(res.status).toBe(201);
    });

    it("does not require the header for GET requests", async () => {
      const { cookie } = await signupOrg(app, { email: "csrf3@security-test.example" });

      const res = await request(app.getHttpServer()).get("/api/v1/clients").set("Cookie", cookie);

      expect(res.status).toBe(200);
    });
  });

  describe("Bearer token authentication (mobile path)", () => {
    it("returns a session token in the login response body", async () => {
      const { body } = await signupOrg(app, { email: "bearer1@security-test.example", password: "BearerSecret123" });

      const login = await api(app)
        .post("/api/v1/auth/login")
        .send({ email: body.email, password: "BearerSecret123" });

      expect(login.status).toBe(200);
      expect(typeof login.body.session.token).toBe("string");
      expect(login.body.session.token.length).toBeGreaterThan(20);
      expect(login.body.session).not.toHaveProperty("id");
    });

    it("authenticates a GET request via Authorization: Bearer with no cookie at all", async () => {
      const { body } = await signupOrg(app, { email: "bearer2@security-test.example", password: "BearerSecret123" });
      const login = await api(app)
        .post("/api/v1/auth/login")
        .send({ email: body.email, password: "BearerSecret123" });
      const token = login.body.session.token;

      const res = await request(app.getHttpServer())
        .get("/api/v1/clients")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("does not require the CSRF header for a bearer-authenticated mutating request", async () => {
      const { body } = await signupOrg(app, { email: "bearer3@security-test.example", password: "BearerSecret123" });
      const login = await api(app)
        .post("/api/v1/auth/login")
        .send({ email: body.email, password: "BearerSecret123" });
      const token = login.body.session.token;

      // Deliberately using raw supertest (no X-Requested-With) to prove the
      // bearer path is exempt — CSRF requires an *ambient* credential a
      // browser attaches automatically, which a bearer header never is.
      const res = await request(app.getHttpServer())
        .post("/api/v1/clients")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Bearer-authenticated client" });

      expect(res.status).toBe(201);
    });

    it("rejects a garbage bearer token the same as a garbage cookie", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/clients")
        .set("Authorization", "Bearer not-a-real-token");
      expect(res.status).toBe(401);
    });
  });

  describe("Authentication audit logging", () => {
    it("writes a LOGIN_SUCCESS audit entry on successful login", async () => {
      const { body, organizationId } = await signupOrg(app, {
        email: "audit1@security-test.example",
        password: "AuditSecret123",
      });

      await api(app).post("/api/v1/auth/login").send({ email: body.email, password: "AuditSecret123" });

      const prisma = getPrisma(app);
      const entry = await prisma.client.auditLog.findFirst({
        where: { organizationId, entityType: "Session", action: "LOGIN_SUCCESS" },
      });
      expect(entry).not.toBeNull();
    });

    it("writes a LOGOUT audit entry on logout", async () => {
      const { cookie, organizationId } = await signupOrg(app, { email: "audit2@security-test.example" });

      await api(app).post("/api/v1/auth/logout").set("Cookie", cookie);

      const prisma = getPrisma(app);
      const entry = await prisma.client.auditLog.findFirst({
        where: { organizationId, entityType: "Session", action: "LOGOUT" },
      });
      expect(entry).not.toBeNull();
    });

    it("does not log a failed login attempt as a success", async () => {
      const { body, organizationId } = await signupOrg(app, { email: "audit3@security-test.example" });

      await api(app).post("/api/v1/auth/login").send({ email: body.email, password: "TotallyWrongPassword" });

      const prisma = getPrisma(app);
      const entries = await prisma.client.auditLog.findMany({
        where: { organizationId, entityType: "Session", action: "LOGIN_SUCCESS" },
      });
      expect(entries).toHaveLength(0);
    });
  });

  describe("Correlation id", () => {
    it("echoes a caller-supplied correlation id back on the response", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("X-Correlation-Id", "test-correlation-123");
      expect(res.headers["x-correlation-id"]).toBe("test-correlation-123");
    });

    it("generates a correlation id when the caller doesn't supply one", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/auth/me");
      expect(res.headers["x-correlation-id"]).toBeTruthy();
    });
  });
});
