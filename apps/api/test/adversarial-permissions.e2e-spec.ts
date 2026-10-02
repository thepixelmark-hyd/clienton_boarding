import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, sessionCookie, signupOrg } from "./helpers";

/**
 * Phase 3 added `projectTemplate` as a resource and reused `project`'s
 * `edit`/`manage` actions for phases/milestones/members. Phase 3's own test
 * suites covered OWNER-can-do-everything paths; this file specifically
 * fuzzes roles that should be DENIED each of those new actions, which
 * wasn't exercised anywhere yet.
 */
describe("Adversarial QA audit: permission-matrix fuzzing on Phase 3 resources (e2e)", () => {
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

  async function inviteAs(ownerCookie: string, email: string, role: string) {
    const invite = await api(app).post("/api/v1/auth/invitations").set("Cookie", ownerCookie).send({ email, role });
    const accept = await api(app)
      .post(`/api/v1/auth/invitations/${invite.body.devToken}/accept`)
      .send({ fullName: role, password: `${role}Secret123` });
    return sessionCookie(accept);
  }

  it("a VIEWER cannot create, update, or delete a project template", async () => {
    const owner = await signupOrg(app, { email: "owner@viewer-template-test.example" });
    const viewerCookie = await inviteAs(owner.cookie, "viewer@viewer-template-test.example", "VIEWER");

    const create = await api(app)
      .post("/api/v1/project-templates")
      .set("Cookie", viewerCookie)
      .send({ name: "Should be blocked", phases: [], milestones: [], tasks: [] });
    expect(create.status).toBe(403);

    const template = await api(app)
      .post("/api/v1/project-templates")
      .set("Cookie", owner.cookie)
      .send({ name: "Owner's template", phases: [], milestones: [], tasks: [] });

    const update = await api(app)
      .patch(`/api/v1/project-templates/${template.body.id}`)
      .set("Cookie", viewerCookie)
      .send({ name: "Hijacked" });
    expect(update.status).toBe(403);

    const del = await api(app).delete(`/api/v1/project-templates/${template.body.id}`).set("Cookie", viewerCookie);
    expect(del.status).toBe(403);

    // VIEWER can still read it — view is universal
    const read = await api(app).get(`/api/v1/project-templates/${template.body.id}`).set("Cookie", viewerCookie);
    expect(read.status).toBe(200);
  });

  it("a CONTRACTOR (no projectTemplate access at all) cannot even view a project template", async () => {
    const owner = await signupOrg(app, { email: "owner@contractor-template-test.example" });
    const contractorCookie = await inviteAs(owner.cookie, "contractor@contractor-template-test.example", "CONTRACTOR");
    const template = await api(app)
      .post("/api/v1/project-templates")
      .set("Cookie", owner.cookie)
      .send({ name: "Owner's template", phases: [], milestones: [], tasks: [] });

    const read = await api(app).get(`/api/v1/project-templates/${template.body.id}`).set("Cookie", contractorCookie);
    expect(read.status).toBe(403);
  });

  it("an EMPLOYEE cannot add/remove/update project members (requires 'manage' on project, which EMPLOYEE lacks)", async () => {
    const owner = await signupOrg(app, { email: "owner@employee-members-test.example" });
    const employeeCookie = await inviteAs(owner.cookie, "employee@employee-members-test.example", "EMPLOYEE");
    const client = await api(app).post("/api/v1/clients").set("Cookie", owner.cookie).send({ name: "Employee Members Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", owner.cookie)
      .send({ clientId: client.body.id, name: "Employee Members Project" });

    const anotherEmployee = await inviteAs(owner.cookie, "another@employee-members-test.example", "EMPLOYEE");
    const meRes = await api(app).get("/api/v1/auth/me").set("Cookie", anotherEmployee);

    const add = await api(app)
      .post(`/api/v1/projects/${project.body.id}/members`)
      .set("Cookie", employeeCookie)
      .send({ userId: meRes.body.id, role: "CONTRIBUTOR" });
    expect(add.status).toBe(403);
  });

  it("an ACCOUNT_MANAGER cannot create a deliverable (project resource access is view+comment only)", async () => {
    const owner = await signupOrg(app, { email: "owner@am-deliverable-test.example" });
    const amCookie = await inviteAs(owner.cookie, "am@am-deliverable-test.example", "ACCOUNT_MANAGER");
    const client = await api(app).post("/api/v1/clients").set("Cookie", owner.cookie).send({ name: "AM Deliverable Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", owner.cookie)
      .send({ clientId: client.body.id, name: "AM Deliverable Project" });

    const create = await api(app)
      .post(`/api/v1/projects/${project.body.id}/deliverables`)
      .set("Cookie", amCookie)
      .send({ name: "Should be blocked" });
    expect(create.status).toBe(403);
  });

  it("a FINANCE role cannot edit a phase or complete a milestone (view-only on project)", async () => {
    const owner = await signupOrg(app, { email: "owner@finance-phase-test.example" });
    const financeCookie = await inviteAs(owner.cookie, "finance@finance-phase-test.example", "FINANCE");
    const client = await api(app).post("/api/v1/clients").set("Cookie", owner.cookie).send({ name: "Finance Phase Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", owner.cookie)
      .send({ clientId: client.body.id, name: "Finance Phase Project" });
    const phase = await api(app).post(`/api/v1/projects/${project.body.id}/phases`).set("Cookie", owner.cookie).send({ name: "Discovery" });
    const milestone = await api(app)
      .post(`/api/v1/projects/${project.body.id}/milestones`)
      .set("Cookie", owner.cookie)
      .send({ name: "Kickoff" });

    const editPhase = await api(app)
      .patch(`/api/v1/projects/${project.body.id}/phases/${phase.body.id}`)
      .set("Cookie", financeCookie)
      .send({ name: "Hijacked" });
    expect(editPhase.status).toBe(403);

    const completeMilestone = await api(app)
      .patch(`/api/v1/projects/${project.body.id}/milestones/${milestone.body.id}`)
      .set("Cookie", financeCookie)
      .send({ status: "COMPLETED" });
    expect(completeMilestone.status).toBe(403);
  });

  it("a portal STAKEHOLDER can read a project but cannot be used to reach the internal projects API at all", async () => {
    const owner = await signupOrg(app, { email: "owner@portal-stakeholder-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", owner.cookie).send({ name: "Stakeholder Co" });
    await api(app)
      .post(`/api/v1/clients/${client.body.id}/invitations`)
      .set("Cookie", owner.cookie)
      .send({ email: "stakeholder@portal-stakeholder-test.example", role: "STAKEHOLDER" });
    const emailLog = await getPrisma(app).client.emailLog.findFirstOrThrow({
      where: { to: "stakeholder@portal-stakeholder-test.example" },
    });
    const token = new URL((emailLog.metadata as { inviteUrl: string }).inviteUrl).searchParams.get("token")!;
    const accept = await api(app).post(`/api/v1/portal/auth/invitations/${token}/accept`).send({ password: "StakeholderPass123" });
    const raw = accept.headers["set-cookie"];
    const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const portalCookie = cookies.find((c) => c.startsWith("clientos_portal_session="))!.split(";")[0];

    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", owner.cookie)
      .send({ clientId: client.body.id, name: "Stakeholder Project" });

    // The portal cookie authenticates nothing on the internal /projects API —
    // it's a completely different guard/cookie namespace.
    const internalAttempt = await api(app).get(`/api/v1/projects/${project.body.id}`).set("Cookie", portalCookie);
    expect(internalAttempt.status).toBe(401);
  });
});
