import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, sessionCookie, signupOrg } from "./helpers";

/**
 * These tests exist specifically to verify the claims in
 * docs/architecture.md ("Multi-tenancy model") and docs/security.md: a
 * cross-tenant read/write returns 404 (never leaking existence), and a
 * same-tenant role without permission gets 403.
 */
describe("Tenant isolation and RBAC (e2e)", () => {
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

  it("returns 404 (not 403) when a user from Org A requests Org B's client", async () => {
    const orgA = await signupOrg(app, { email: "a-owner@tenancy-test.example" });
    const orgB = await signupOrg(app, { email: "b-owner@tenancy-test.example" });

    const clientInB = await api(app)
      .post("/api/v1/clients")
      .set("Cookie", orgB.cookie)
      .send({ name: "Org B's Client" });
    expect(clientInB.status).toBe(201);

    const crossTenantRead = await api(app)
      .get(`/api/v1/clients/${clientInB.body.id}`)
      .set("Cookie", orgA.cookie);
    expect(crossTenantRead.status).toBe(404);
  });

  it("returns 404 when a user from Org A tries to update Org B's project", async () => {
    const orgA = await signupOrg(app, { email: "a-owner2@tenancy-test.example" });
    const orgB = await signupOrg(app, { email: "b-owner2@tenancy-test.example" });

    const clientInB = await api(app)
      .post("/api/v1/clients")
      .set("Cookie", orgB.cookie)
      .send({ name: "Org B Client" });
    const projectInB = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", orgB.cookie)
      .send({ clientId: clientInB.body.id, name: "Org B Project" });

    const crossTenantWrite = await api(app)
      .patch(`/api/v1/projects/${projectInB.body.id}`)
      .set("Cookie", orgA.cookie)
      .send({ name: "Hijacked", version: 1 });
    expect(crossTenantWrite.status).toBe(404);

    // Confirm it was NOT renamed.
    const stillIntact = await api(app)
      .get(`/api/v1/projects/${projectInB.body.id}`)
      .set("Cookie", orgB.cookie);
    expect(stillIntact.body.name).toBe("Org B Project");
  });

  it("Org A's list/search never returns Org B's records", async () => {
    const orgA = await signupOrg(app, { email: "a-owner3@tenancy-test.example" });
    const orgB = await signupOrg(app, { email: "b-owner3@tenancy-test.example" });

    await api(app)
      .post("/api/v1/clients")
      .set("Cookie", orgA.cookie)
      .send({ name: "Visible To A" });
    await api(app)
      .post("/api/v1/clients")
      .set("Cookie", orgB.cookie)
      .send({ name: "Should Not Leak To A" });

    const listAsA = await api(app).get("/api/v1/clients").set("Cookie", orgA.cookie);
    const names = listAsA.body.data.map((c: { name: string }) => c.name);
    expect(names).toContain("Visible To A");
    expect(names).not.toContain("Should Not Leak To A");
  });

  it("denies a VIEWER from creating a client (403) but allows reading", async () => {
    const owner = await signupOrg(app, { email: "owner-viewer-test@tenancy-test.example" });
    const invite = await api(app)
      .post("/api/v1/auth/invitations")
      .set("Cookie", owner.cookie)
      .send({ email: "viewer@tenancy-test.example", role: "VIEWER" });
    const accept = await api(app)
      .post(`/api/v1/auth/invitations/${invite.body.devToken}/accept`)
      .send({ fullName: "Viewer Person", password: "ViewerSecret123" });
    const viewerCookie = sessionCookie(accept);

    const createAttempt = await api(app)
      .post("/api/v1/clients")
      .set("Cookie", viewerCookie)
      .send({ name: "Should Be Blocked" });
    expect(createAttempt.status).toBe(403);
    expect(createAttempt.body.code).toBe("FORBIDDEN");

    const readAttempt = await api(app).get("/api/v1/clients").set("Cookie", viewerCookie);
    expect(readAttempt.status).toBe(200);
  });

  it("denies a CONTRACTOR from deleting a client", async () => {
    const owner = await signupOrg(app, { email: "owner-contractor-test@tenancy-test.example" });
    const client = await api(app)
      .post("/api/v1/clients")
      .set("Cookie", owner.cookie)
      .send({ name: "Contractor Target" });

    const invite = await api(app)
      .post("/api/v1/auth/invitations")
      .set("Cookie", owner.cookie)
      .send({ email: "contractor@tenancy-test.example", role: "CONTRACTOR" });
    const accept = await api(app)
      .post(`/api/v1/auth/invitations/${invite.body.devToken}/accept`)
      .send({ fullName: "Contractor Person", password: "ContractorSecret123" });
    const contractorCookie = sessionCookie(accept);

    const deleteAttempt = await api(app)
      .delete(`/api/v1/clients/${client.body.id}`)
      .set("Cookie", contractorCookie);
    expect(deleteAttempt.status).toBe(403);
  });
});
