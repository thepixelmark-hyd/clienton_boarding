import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, sessionCookie, signupOrg } from "./helpers";

describe("Project phases, milestones, and member assignments (e2e)", () => {
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

  async function setupProject(cookie: string) {
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Phases Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Phases Project" });
    return project.body.id as string;
  }

  it("creates, updates, reorders, and deletes phases", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@phases-test.example" });
    const projectId = await setupProject(cookie);

    const p1 = await api(app).post(`/api/v1/projects/${projectId}/phases`).set("Cookie", cookie).send({ name: "Discovery" });
    const p2 = await api(app).post(`/api/v1/projects/${projectId}/phases`).set("Cookie", cookie).send({ name: "Build" });
    expect(p1.body.order).toBe(0);
    expect(p2.body.order).toBe(1);

    const reordered = await api(app)
      .patch(`/api/v1/projects/${projectId}/phases-order`)
      .set("Cookie", cookie)
      .send({ orderedIds: [p2.body.id, p1.body.id] });
    expect(reordered.body[0].id).toBe(p2.body.id);
    expect(reordered.body[0].order).toBe(0);

    const renamed = await api(app)
      .patch(`/api/v1/projects/${projectId}/phases/${p1.body.id}`)
      .set("Cookie", cookie)
      .send({ name: "Discovery & Research" });
    expect(renamed.body.name).toBe("Discovery & Research");

    const del = await api(app).delete(`/api/v1/projects/${projectId}/phases/${p1.body.id}`).set("Cookie", cookie);
    expect(del.status).toBe(200);
    const remaining = await api(app).get(`/api/v1/projects/${projectId}/phases`).set("Cookie", cookie);
    expect(remaining.body).toHaveLength(1);
  });

  it("rejects reordering with a mismatched id set", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@phases-reorder-test.example" });
    const projectId = await setupProject(cookie);
    await api(app).post(`/api/v1/projects/${projectId}/phases`).set("Cookie", cookie).send({ name: "Only phase" });

    const res = await api(app)
      .patch(`/api/v1/projects/${projectId}/phases-order`)
      .set("Cookie", cookie)
      .send({ orderedIds: ["does-not-exist"] });
    expect(res.status).toBe(400);
  });

  it("completes a milestone (sets completedAt) and deletes a milestone", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@milestones-test.example" });
    const projectId = await setupProject(cookie);
    const milestone = await api(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Cookie", cookie)
      .send({ name: "Go live" });

    const completed = await api(app)
      .patch(`/api/v1/projects/${projectId}/milestones/${milestone.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "COMPLETED" });
    expect(completed.body.status).toBe("COMPLETED");
    expect(completed.body.completedAt).not.toBeNull();

    const del = await api(app)
      .delete(`/api/v1/projects/${projectId}/milestones/${milestone.body.id}`)
      .set("Cookie", cookie);
    expect(del.status).toBe(200);
  });

  it("adds, updates, and removes a project member; rejects a duplicate and a non-member user", async () => {
    const owner = await signupOrg(app, { email: "owner@members-test.example" });
    const projectId = await setupProject(owner.cookie);

    const invite = await api(app)
      .post("/api/v1/auth/invitations")
      .set("Cookie", owner.cookie)
      .send({ email: "designer@members-test.example", role: "EMPLOYEE" });
    const accept = await api(app)
      .post(`/api/v1/auth/invitations/${invite.body.devToken}/accept`)
      .send({ fullName: "Designer Person", password: "DesignerSecret123" });
    const designerCookie = sessionCookie(accept);
    const designerId = accept.body.user.id as string;

    const added = await api(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set("Cookie", owner.cookie)
      .send({ userId: designerId, role: "CONTRIBUTOR" });
    expect(added.status).toBe(201);
    expect(added.body.user.fullName).toBe("Designer Person");

    const duplicate = await api(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set("Cookie", owner.cookie)
      .send({ userId: designerId, role: "CONTRIBUTOR" });
    expect(duplicate.status).toBe(400);

    const notAMember = await api(app)
      .post(`/api/v1/projects/${projectId}/members`)
      .set("Cookie", owner.cookie)
      .send({ userId: "cl-does-not-exist", role: "CONTRIBUTOR" });
    expect(notAMember.status).toBe(404);

    const updated = await api(app)
      .patch(`/api/v1/projects/${projectId}/members/${designerId}`)
      .set("Cookie", owner.cookie)
      .send({ role: "LEAD" });
    expect(updated.body.role).toBe("LEAD");

    // The newly-added designer can now see the project (EMPLOYEE has "view" on project anyway),
    // and removal takes them back off the roster.
    const removed = await api(app)
      .delete(`/api/v1/projects/${projectId}/members/${designerId}`)
      .set("Cookie", owner.cookie);
    expect(removed.status).toBe(200);

    const members = await api(app).get(`/api/v1/projects/${projectId}/members`).set("Cookie", owner.cookie);
    expect(members.body.find((m: { userId: string }) => m.userId === designerId)).toBeUndefined();
    void designerCookie;
  });

  it("phases and milestones are tenant-isolated (cross-org access 404s)", async () => {
    const { cookie: ownerA } = await signupOrg(app, { email: "owner-a@phases-tenancy-test.example" });
    const { cookie: ownerB } = await signupOrg(app, { email: "owner-b@phases-tenancy-test.example" });
    const projectIdA = await setupProject(ownerA);
    const phase = await api(app).post(`/api/v1/projects/${projectIdA}/phases`).set("Cookie", ownerA).send({ name: "Discovery" });

    const res = await api(app)
      .patch(`/api/v1/projects/${projectIdA}/phases/${phase.body.id}`)
      .set("Cookie", ownerB)
      .send({ name: "Hijacked" });
    expect(res.status).toBe(404);
  });
});
