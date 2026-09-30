import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, signupOrg } from "./helpers";

describe("Projects and tasks (e2e)", () => {
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
    const client = await api(app)
      .post("/api/v1/clients")
      .set("Cookie", cookie)
      .send({ name: "Health Test Client" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Health Test Project" });
    return project.body.id as string;
  }

  it("a freshly created project is HEALTHY", async () => {
    const { cookie } = await signupOrg(app, { email: "health1@projects-test.example" });
    const projectId = await setupProject(cookie);

    const res = await api(app).get(`/api/v1/projects/${projectId}`).set("Cookie", cookie);
    expect(res.body.health.status).toBe("HEALTHY");
  });

  it("a project with an overdue task becomes WATCH or AT_RISK with an evidence-based reason", async () => {
    const { cookie } = await signupOrg(app, { email: "health2@projects-test.example" });
    const projectId = await setupProject(cookie);

    await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Overdue task", dueDate: new Date(Date.now() - 86_400_000).toISOString() });

    const res = await api(app).get(`/api/v1/projects/${projectId}`).set("Cookie", cookie);
    expect(res.body.health.status).toBe("WATCH");
    expect(res.body.health.reason).toMatch(/overdue/i);
  });

  it("rejects a task update with a stale version (optimistic concurrency)", async () => {
    const { cookie } = await signupOrg(app, { email: "concurrency@projects-test.example" });
    const projectId = await setupProject(cookie);

    const task = await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Race condition target" });

    const firstUpdate = await api(app)
      .patch(`/api/v1/tasks/${task.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "IN_PROGRESS", version: 1 });
    expect(firstUpdate.status).toBe(200);
    expect(firstUpdate.body.version).toBe(2);

    // Someone else's stale read still thinks version is 1.
    const staleUpdate = await api(app)
      .patch(`/api/v1/tasks/${task.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "DONE", version: 1 });
    expect(staleUpdate.status).toBe(409);
    expect(staleUpdate.body.code).toBe("CONFLICT_VERSION");
  });

  it("rejects a task dependency that would create a cycle", async () => {
    const { cookie } = await signupOrg(app, { email: "cycle@projects-test.example" });
    const projectId = await setupProject(cookie);

    const taskA = await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Task A" });
    const taskB = await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Task B", dependsOnTaskIds: [taskA.body.id] }); // B depends on A

    // Now try to make A depend on B — a direct cycle (A -> B -> A).
    const cyclic = await api(app)
      .patch(`/api/v1/tasks/${taskA.body.id}`)
      .set("Cookie", cookie)
      .send({ dependsOnTaskIds: [taskB.body.id], version: 1 });
    expect(cyclic.status).toBe(400);
    expect(cyclic.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a task depending on itself", async () => {
    const { cookie } = await signupOrg(app, { email: "selfdep@projects-test.example" });
    const projectId = await setupProject(cookie);

    const task = await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Self referencing" });

    const res = await api(app)
      .patch(`/api/v1/tasks/${task.body.id}`)
      .set("Cookie", cookie)
      .send({ dependsOnTaskIds: [task.body.id], version: 1 });
    expect(res.status).toBe(400);
  });
});
