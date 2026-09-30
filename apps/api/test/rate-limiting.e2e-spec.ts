import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, signupOrg } from "./helpers";

/**
 * A fresh Nest application per *test*, not just per file: @nestjs/throttler's
 * default in-memory storage is keyed by IP+route and lives for the lifetime
 * of one application instance. Two tests in this file intentionally exhaust
 * the login/signup rate limit — sharing an app instance between them (or
 * with the "unrelated endpoint" test) would mean whichever runs first
 * poisons the shared counter for the rest, which is exactly the kind of
 * cross-test flakiness a rate-limit test must not itself introduce. See
 * docs/security.md and docs/architecture-assessment.md §17/§21 (risk #2).
 */
describe("Rate limiting (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
    await truncateAll(getPrisma(app));
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 429 after exceeding the login attempt limit", async () => {
    const { body } = await signupOrg(app, { email: "ratelimit1@rate-limit-test.example", password: "RateLimit123" });

    // Sequential, not Promise.all: the throttler guard rejects requests past
    // the limit before the (CPU-heavy, argon2) handler ever runs, so this
    // stays fast — firing them fully in parallel instead just stresses
    // argon2 concurrency and risks a flaky connection reset rather than
    // exercising the thing this test is actually about.
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await api(app).post("/api/v1/auth/login").send({ email: body.email, password: "WrongPassword" });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
    // Everything before the limit kicks in should be a normal auth failure,
    // never a 500 — the throttler must not interfere with error handling.
    expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
  });

  it("returns 429 after exceeding the signup attempt limit", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await api(app)
        .post("/api/v1/auth/signup")
        .send({
          organizationName: `Flood Co ${i}`,
          fullName: "Flood Tester",
          email: `flood-${i}@rate-limit-test.example`,
          password: "SuperSecret123",
        });
      statuses.push(res.status);
    }

    expect(statuses).toContain(429);
    expect(statuses.every((s) => s === 201 || s === 429)).toBe(true);
  });

  it("does not rate-limit unrelated authenticated endpoints under the same low threshold", async () => {
    const { cookie } = await signupOrg(app, { email: "ratelimit2@rate-limit-test.example" });

    // /auth/me has no per-route @Throttle override, so hitting it more times
    // than the login/signup limit must not itself trip anything — only the
    // two specifically-decorated auth endpoints carry the tight limit.
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await api(app).get("/api/v1/auth/me").set("Cookie", cookie);
      statuses.push(res.status);
    }
    expect(statuses.every((s) => s === 200)).toBe(true);
  });
});
