import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, signupOrg } from "./helpers";

describe("Deliverables and requirement -> deliverable -> task traceability (e2e)", () => {
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

  async function setupProjectWithRequirement(cookie: string) {
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Traceability Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Traceability Project" });
    const projectId = project.body.id as string;

    const instantiate = await api(app)
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set("Cookie", cookie)
      .send({ templateKey: "website-discovery" });
    const formId = instantiate.body.form.id as string;
    const submissionId = instantiate.body.submission.id as string;

    await api(app)
      .post(`/api/v1/forms/${formId}/submissions/${submissionId}/submit`)
      .set("Cookie", cookie);
    const requirement = await getPrisma(app).client.requirement.findFirstOrThrow({ where: { submissionId } });

    return { projectId, requirementId: requirement.id };
  }

  it("creates a deliverable, enforces optimistic concurrency, and soft-deletes it", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@deliverables-test.example" });
    const { projectId } = await setupProjectWithRequirement(cookie);

    const created = await api(app)
      .post(`/api/v1/projects/${projectId}/deliverables`)
      .set("Cookie", cookie)
      .send({ name: "Homepage design", acceptanceCriteria: "Matches approved wireframes" });
    expect(created.status).toBe(201);
    expect(created.body.version).toBe(1);

    const staleUpdate = await api(app)
      .patch(`/api/v1/deliverables/${created.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "IN_PROGRESS", version: 1 });
    expect(staleUpdate.status).toBe(200);
    expect(staleUpdate.body.version).toBe(2);

    const conflict = await api(app)
      .patch(`/api/v1/deliverables/${created.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "IN_REVIEW", version: 1 });
    expect(conflict.status).toBe(409);

    const del = await api(app).delete(`/api/v1/deliverables/${created.body.id}`).set("Cookie", cookie);
    expect(del.status).toBe(200);

    const listed = await api(app).get(`/api/v1/projects/${projectId}/deliverables`).set("Cookie", cookie);
    expect(listed.body).toHaveLength(0);
  });

  it("links and unlinks a requirement to a deliverable, rejecting a duplicate link and a cross-project requirement", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@traceability-link-test.example" });
    const { projectId, requirementId } = await setupProjectWithRequirement(cookie);
    const deliverable = await api(app)
      .post(`/api/v1/projects/${projectId}/deliverables`)
      .set("Cookie", cookie)
      .send({ name: "Final site" });

    const linked = await api(app)
      .post(`/api/v1/deliverables/${deliverable.body.id}/requirements`)
      .set("Cookie", cookie)
      .send({ requirementId });
    expect(linked.status).toBe(201);

    const duplicate = await api(app)
      .post(`/api/v1/deliverables/${deliverable.body.id}/requirements`)
      .set("Cookie", cookie)
      .send({ requirementId });
    expect(duplicate.status).toBe(400);

    // A requirement from a different project cannot be linked.
    const { projectId: otherProjectId, requirementId: otherRequirementId } = await setupProjectWithRequirement(cookie);
    void otherProjectId;
    const crossProject = await api(app)
      .post(`/api/v1/deliverables/${deliverable.body.id}/requirements`)
      .set("Cookie", cookie)
      .send({ requirementId: otherRequirementId });
    expect(crossProject.status).toBe(400);

    const unlinked = await api(app)
      .delete(`/api/v1/deliverables/${deliverable.body.id}/requirements/${requirementId}`)
      .set("Cookie", cookie);
    expect(unlinked.status).toBe(200);

    const get = await api(app).get(`/api/v1/deliverables/${deliverable.body.id}`).set("Cookie", cookie);
    expect(get.body.requirementLinks).toHaveLength(0);
  });

  it("the project traceability view shows linked deliverables (with their tasks) and unlinked requirements", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@traceability-view-test.example" });
    const { projectId, requirementId } = await setupProjectWithRequirement(cookie);

    const deliverable = await api(app)
      .post(`/api/v1/projects/${projectId}/deliverables`)
      .set("Cookie", cookie)
      .send({ name: "Launch package" });
    await api(app)
      .post(`/api/v1/deliverables/${deliverable.body.id}/requirements`)
      .set("Cookie", cookie)
      .send({ requirementId });
    await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Build launch page", deliverableId: deliverable.body.id });

    const trace = await api(app).get(`/api/v1/projects/${projectId}/traceability`).set("Cookie", cookie);
    expect(trace.status).toBe(200);
    expect(trace.body.deliverables).toHaveLength(1);
    expect(trace.body.deliverables[0].tasks).toHaveLength(1);
    expect(trace.body.deliverables[0].requirementLinks[0].requirement.id).toBe(requirementId);
    expect(trace.body.unlinkedRequirements).toHaveLength(0);

    // A second, never-instantiated-for-a-deliverable requirement shows up as a gap.
    const second = await setupProjectWithRequirement(cookie);
    const traceSecond = await api(app).get(`/api/v1/projects/${second.projectId}/traceability`).set("Cookie", cookie);
    expect(traceSecond.body.unlinkedRequirements.map((r: { id: string }) => r.id)).toContain(second.requirementId);
  });

  it("deliverables are tenant-isolated", async () => {
    const { cookie: ownerA } = await signupOrg(app, { email: "owner-a@deliverables-tenancy-test.example" });
    const { cookie: ownerB } = await signupOrg(app, { email: "owner-b@deliverables-tenancy-test.example" });
    const { projectId } = await setupProjectWithRequirement(ownerA);
    const deliverable = await api(app)
      .post(`/api/v1/projects/${projectId}/deliverables`)
      .set("Cookie", ownerA)
      .send({ name: "Org A deliverable" });

    const res = await api(app).get(`/api/v1/deliverables/${deliverable.body.id}`).set("Cookie", ownerB);
    expect(res.status).toBe(404);
  });
});
