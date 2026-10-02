import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, sessionCookie, signupOrg } from "./helpers";

/**
 * Phase 3 added a large surface of new endpoints (task detail/comments,
 * project templates direct CRUD, deliverables). The main Phase 3 test
 * suites covered tenant isolation for phases, milestones, deliverables,
 * and template instantiation, but not every new single-resource GET/PATCH/
 * DELETE got its own cross-org 404 test. This file closes that gap
 * specifically, rather than assuming "the pattern is the same elsewhere
 * so it's fine" — every one of these is independently verified.
 */
describe("Adversarial QA audit: tenant-isolation gaps across Phase 3 endpoints (e2e)", () => {
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

  async function twoOrgsWithTaskInOrgA() {
    const { cookie: ownerA } = await signupOrg(app, { email: `owner-a-${Date.now()}@tenancy-gap-test.example` });
    const { cookie: ownerB } = await signupOrg(app, { email: `owner-b-${Date.now()}@tenancy-gap-test.example` });
    const client = await api(app).post("/api/v1/clients").set("Cookie", ownerA).send({ name: "Org A Client" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", ownerA)
      .send({ clientId: client.body.id, name: "Org A Project" });
    const task = await api(app)
      .post(`/api/v1/projects/${project.body.id}/tasks`)
      .set("Cookie", ownerA)
      .send({ title: "Org A Task" });
    return { ownerA, ownerB, projectId: project.body.id as string, taskId: task.body.id as string };
  }

  it("GET /tasks/:id 404s for a different organization", async () => {
    const { ownerB, taskId } = await twoOrgsWithTaskInOrgA();
    const res = await api(app).get(`/api/v1/tasks/${taskId}`).set("Cookie", ownerB);
    expect(res.status).toBe(404);
  });

  it("PATCH /tasks/:id 404s for a different organization (cannot be used to probe existence or overwrite)", async () => {
    const { ownerB, taskId } = await twoOrgsWithTaskInOrgA();
    const res = await api(app).patch(`/api/v1/tasks/${taskId}`).set("Cookie", ownerB).send({ title: "Hijacked", version: 1 });
    expect(res.status).toBe(404);
  });

  it("DELETE /tasks/:id 404s for a different organization", async () => {
    const { ownerA, ownerB, taskId } = await twoOrgsWithTaskInOrgA();
    const res = await api(app).delete(`/api/v1/tasks/${taskId}`).set("Cookie", ownerB);
    expect(res.status).toBe(404);

    // and it's still there, untouched, for the real owner
    const stillThere = await api(app).get(`/api/v1/tasks/${taskId}`).set("Cookie", ownerA);
    expect(stillThere.status).toBe(200);
  });

  it("task comments: list/create/delete all 404 for a different organization", async () => {
    const { ownerA, ownerB, taskId } = await twoOrgsWithTaskInOrgA();
    const comment = await api(app).post(`/api/v1/tasks/${taskId}/comments`).set("Cookie", ownerA).send({ body: "Org A only" });

    const list = await api(app).get(`/api/v1/tasks/${taskId}/comments`).set("Cookie", ownerB);
    expect(list.status).toBe(404);

    const create = await api(app).post(`/api/v1/tasks/${taskId}/comments`).set("Cookie", ownerB).send({ body: "Intruder" });
    expect(create.status).toBe(404);

    const del = await api(app).delete(`/api/v1/tasks/${taskId}/comments/${comment.body.id}`).set("Cookie", ownerB);
    expect(del.status).toBe(404);
  });

  it("GET/PATCH/DELETE /project-templates/:id all 404 for a different organization", async () => {
    const { cookie: ownerA } = await signupOrg(app, { email: "owner-a@template-gap-test.example" });
    const { cookie: ownerB } = await signupOrg(app, { email: "owner-b@template-gap-test.example" });
    const template = await api(app)
      .post("/api/v1/project-templates")
      .set("Cookie", ownerA)
      .send({ name: "Org A Template", phases: [], milestones: [], tasks: [] });

    const get = await api(app).get(`/api/v1/project-templates/${template.body.id}`).set("Cookie", ownerB);
    expect(get.status).toBe(404);

    const patch = await api(app)
      .patch(`/api/v1/project-templates/${template.body.id}`)
      .set("Cookie", ownerB)
      .send({ name: "Hijacked" });
    expect(patch.status).toBe(404);

    const del = await api(app).delete(`/api/v1/project-templates/${template.body.id}`).set("Cookie", ownerB);
    expect(del.status).toBe(404);

    // still there for the real owner
    const stillThere = await api(app).get(`/api/v1/project-templates/${template.body.id}`).set("Cookie", ownerA);
    expect(stillThere.status).toBe(200);
  });

  it("a non-member user (valid session, but not on the project) can still read the project per the org-wide permission model (documented, not a bug) — but a user from a DIFFERENT org cannot", async () => {
    // This test exists to make an intentional product decision explicit and
    // tested, not just asserted in docs: object-level ProjectMember scoping
    // is NOT implemented (security.md "Object-level (correction — not yet
    // implemented)") — any org member with sufficient role can read any
    // project in their org regardless of assignment. That's a deliberate,
    // documented gap, not something this audit should "fix" by inventing
    // undocumented new behavior. What *is* a hard boundary is the org
    // itself, verified here.
    const owner = await signupOrg(app, { email: "owner@project-member-scope-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", owner.cookie).send({ name: "Scope Test Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", owner.cookie)
      .send({ clientId: client.body.id, name: "Scope Test Project" });

    const invite = await api(app)
      .post("/api/v1/auth/invitations")
      .set("Cookie", owner.cookie)
      .send({ email: "not-on-project@project-member-scope-test.example", role: "EMPLOYEE" });
    const accept = await api(app)
      .post(`/api/v1/auth/invitations/${invite.body.devToken}/accept`)
      .send({ fullName: "Not On Project", password: "NotOnProject123" });
    const nonMemberCookie = sessionCookie(accept);

    const sameOrgRead = await api(app).get(`/api/v1/projects/${project.body.id}`).set("Cookie", nonMemberCookie);
    expect(sameOrgRead.status).toBe(200);

    const { cookie: differentOrgCookie } = await signupOrg(app, { email: "owner@different-org-scope-test.example" });
    const crossOrgRead = await api(app).get(`/api/v1/projects/${project.body.id}`).set("Cookie", differentOrgCookie);
    expect(crossOrgRead.status).toBe(404);
  });
});
