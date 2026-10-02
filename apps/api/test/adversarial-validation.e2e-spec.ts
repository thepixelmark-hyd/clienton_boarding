import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, signupOrg } from "./helpers";

describe("Adversarial QA audit: input validation boundary fuzzing (e2e)", () => {
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

  it("rejects an empty client name with 400, not a 500 or a silently-created blank record", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-empty-test.example" });
    const res = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a name far past its declared max length", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-maxlen-test.example" });
    const res = await api(app)
      .post("/api/v1/clients")
      .set("Cookie", cookie)
      .send({ name: "x".repeat(10_000) });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid enum value for task priority and task status", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-enum-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Enum Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Enum Project" });

    const badPriority = await api(app)
      .post(`/api/v1/projects/${project.body.id}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Bad priority", priority: "SUPER_URGENT" });
    expect(badPriority.status).toBe(400);

    const task = await api(app).post(`/api/v1/projects/${project.body.id}/tasks`).set("Cookie", cookie).send({ title: "Fine" });
    const badStatus = await api(app)
      .patch(`/api/v1/tasks/${task.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "ALMOST_DONE_ISH", version: 1 });
    expect(badStatus.status).toBe(400);
  });

  it("rejects a negative estimatedHours and a negative contractValue", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-negative-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Negative Co" });

    const badProject = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Negative Project", contractValue: -500 });
    expect(badProject.status).toBe(400);

    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Fine Project" });
    const badTask = await api(app)
      .post(`/api/v1/projects/${project.body.id}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Negative hours", estimatedHours: -10 });
    expect(badTask.status).toBe(400);
  });

  it("rejects a malformed date string rather than silently coercing it", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-date-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Date Co" });
    const res = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Date Project", startDate: "not-a-date" });
    expect(res.status).toBe(400);
  });

  it("strips unknown/extra fields instead of trusting client-supplied organizationId or version", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-extra-fields-test.example" });
    const otherOrg = await signupOrg(app, { email: "owner@validation-extra-fields-other.example" });

    const res = await api(app)
      .post("/api/v1/clients")
      .set("Cookie", cookie)
      .send({ name: "Extra Fields Co", organizationId: otherOrg.organizationId, id: "attacker-chosen-id", deletedAt: null });
    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe("attacker-chosen-id");

    const stored = await getPrisma(app).client.client.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.organizationId).not.toBe(otherOrg.organizationId);
  });

  it("rejects a MULTI_SELECT template task field with maxSelections less than 0 and a priority outside the enum in a template blueprint", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-template-test.example" });
    const res = await api(app)
      .post("/api/v1/project-templates")
      .set("Cookie", cookie)
      .send({
        name: "Bad blueprint",
        phases: [],
        milestones: [],
        tasks: [{ key: "a", title: "A", priority: "ULTRA" }],
      });
    expect(res.status).toBe(400);
  });

  it("rejects a version that isn't a positive integer on an update", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-version-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Version Co" });

    const zero = await api(app).patch(`/api/v1/clients/${client.body.id}`).set("Cookie", cookie).send({ version: 0 });
    expect(zero.status).toBe(400);

    const negative = await api(app).patch(`/api/v1/clients/${client.body.id}`).set("Cookie", cookie).send({ version: -1 });
    expect(negative.status).toBe(400);

    const missing = await api(app).patch(`/api/v1/clients/${client.body.id}`).set("Cookie", cookie).send({ industry: "X" });
    expect(missing.status).toBe(400);
  });

  it("rejects a reorder-phases call with a non-array or empty orderedIds", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-reorder-test.example" });
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Reorder Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Reorder Project" });

    const emptyArray = await api(app)
      .patch(`/api/v1/projects/${project.body.id}/phases-order`)
      .set("Cookie", cookie)
      .send({ orderedIds: [] });
    expect(emptyArray.status).toBe(400);

    const wrongType = await api(app)
      .patch(`/api/v1/projects/${project.body.id}/phases-order`)
      .set("Cookie", cookie)
      .send({ orderedIds: "not-an-array" });
    expect(wrongType.status).toBe(400);
  });

  it("a non-existent id on an update/get route 404s cleanly rather than 500ing on a malformed-looking cuid", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@validation-badid-test.example" });
    const res1 = await api(app).get("/api/v1/projects/not-a-real-id").set("Cookie", cookie);
    expect(res1.status).toBe(404);

    const res2 = await api(app).get("/api/v1/tasks/' OR '1'='1").set("Cookie", cookie);
    expect(res2.status).toBe(404);
  });
});
