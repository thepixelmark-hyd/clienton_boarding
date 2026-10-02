import type { INestApplication } from "@nestjs/common";
import { createTestApp, getPrisma, truncateAll } from "./test-app";
import { api, sessionCookie, signupOrg } from "./helpers";

describe("Task detail, subtasks, comments, project activity, and dashboard (e2e)", () => {
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
    const client = await api(app).post("/api/v1/clients").set("Cookie", cookie).send({ name: "Dashboard Co" });
    const project = await api(app)
      .post("/api/v1/projects")
      .set("Cookie", cookie)
      .send({ clientId: client.body.id, name: "Dashboard Project" });
    return project.body.id as string;
  }

  it("task detail includes subtasks, dependencies (with blocking task title), and comment count", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@task-detail-test.example" });
    const projectId = await setupProject(cookie);

    const parent = await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Parent task" });
    const blocker = await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Blocking task" });
    await api(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Cookie", cookie)
      .send({ title: "Child task", parentTaskId: parent.body.id, dependsOnTaskIds: [blocker.body.id] });

    await api(app).post(`/api/v1/tasks/${parent.body.id}/comments`).set("Cookie", cookie).send({ body: "Looks good" });

    const detail = await api(app).get(`/api/v1/tasks/${parent.body.id}`).set("Cookie", cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.subtasks).toHaveLength(1);
    expect(detail.body._count.comments).toBe(1);

    const childTasks = await api(app).get(`/api/v1/projects/${projectId}/tasks`).set("Cookie", cookie);
    const child = childTasks.body.find((t: { title: string }) => t.title === "Child task");
    expect(child.dependenciesFrom[0].blockingTask.title).toBe("Blocking task");
  });

  it("task comments: create, list, and only the author can delete their own", async () => {
    const owner = await signupOrg(app, { email: "owner@comments-test.example" });
    const projectId = await setupProject(owner.cookie);
    const task = await api(app).post(`/api/v1/projects/${projectId}/tasks`).set("Cookie", owner.cookie).send({ title: "Commented task" });

    const invite = await api(app)
      .post("/api/v1/auth/invitations")
      .set("Cookie", owner.cookie)
      .send({ email: "teammate@comments-test.example", role: "EMPLOYEE" });
    const accept = await api(app)
      .post(`/api/v1/auth/invitations/${invite.body.devToken}/accept`)
      .send({ fullName: "Teammate Person", password: "TeammateSecret123" });
    const teammateCookie = sessionCookie(accept);

    const comment = await api(app)
      .post(`/api/v1/tasks/${task.body.id}/comments`)
      .set("Cookie", owner.cookie)
      .send({ body: "Owner's comment" });
    expect(comment.status).toBe(201);

    const list = await api(app).get(`/api/v1/tasks/${task.body.id}/comments`).set("Cookie", teammateCookie);
    expect(list.body).toHaveLength(1);

    const forbiddenDelete = await api(app)
      .delete(`/api/v1/tasks/${task.body.id}/comments/${comment.body.id}`)
      .set("Cookie", teammateCookie);
    expect(forbiddenDelete.status).toBe(403);

    const ownDelete = await api(app)
      .delete(`/api/v1/tasks/${task.body.id}/comments/${comment.body.id}`)
      .set("Cookie", owner.cookie);
    expect(ownDelete.status).toBe(200);
  });

  it("deleting a task is a soft delete (it drops off the project's task list)", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@task-delete-test.example" });
    const projectId = await setupProject(cookie);
    const task = await api(app).post(`/api/v1/projects/${projectId}/tasks`).set("Cookie", cookie).send({ title: "Doomed task" });

    const del = await api(app).delete(`/api/v1/tasks/${task.body.id}`).set("Cookie", cookie);
    expect(del.status).toBe(200);

    const list = await api(app).get(`/api/v1/projects/${projectId}/tasks`).set("Cookie", cookie);
    expect(list.body).toHaveLength(0);
  });

  it("records real activity events for key project/task/deliverable mutations", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@activity-test.example" });
    const projectId = await setupProject(cookie);

    const task = await api(app).post(`/api/v1/projects/${projectId}/tasks`).set("Cookie", cookie).send({ title: "Tracked task" });
    await api(app)
      .patch(`/api/v1/tasks/${task.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "DONE", version: task.body.version });
    await api(app).post(`/api/v1/projects/${projectId}/milestones`).set("Cookie", cookie).send({ name: "Launch" });
    await api(app).post(`/api/v1/projects/${projectId}/deliverables`).set("Cookie", cookie).send({ name: "Site" });

    const activity = await api(app).get(`/api/v1/projects/${projectId}/activity`).set("Cookie", cookie);
    const types = activity.body.map((e: { type: string }) => e.type);
    expect(types).toContain("PROJECT_CREATED");
    expect(types).toContain("TASK_CREATED");
    expect(types).toContain("TASK_STATUS_CHANGED");
    expect(types).toContain("MILESTONE_CREATED");
    expect(types).toContain("DELIVERABLE_CREATED");
  });

  it("the project dashboard reports real aggregate counts that match a known fixture, never placeholders", async () => {
    const { cookie } = await signupOrg(app, { email: "owner@dashboard-test.example" });
    const projectId = await setupProject(cookie);

    const t1 = await api(app).post(`/api/v1/projects/${projectId}/tasks`).set("Cookie", cookie).send({ title: "Task 1" });
    const t2 = await api(app).post(`/api/v1/projects/${projectId}/tasks`).set("Cookie", cookie).send({ title: "Task 2" });
    await api(app).post(`/api/v1/projects/${projectId}/tasks`).set("Cookie", cookie).send({
      title: "Overdue, waiting on client",
      dueDate: new Date(Date.now() - 86_400_000).toISOString(),
      waitingOnClient: true,
      waitingOnClientNote: "Need brand colors",
    });
    await api(app)
      .patch(`/api/v1/tasks/${t1.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "DONE", version: t1.body.version });
    await api(app)
      .patch(`/api/v1/tasks/${t2.body.id}`)
      .set("Cookie", cookie)
      .send({ status: "IN_PROGRESS", version: t2.body.version });
    await api(app).post(`/api/v1/projects/${projectId}/deliverables`).set("Cookie", cookie).send({ name: "Deliverable A" });

    const dashboard = await api(app).get(`/api/v1/projects/${projectId}/dashboard`).set("Cookie", cookie);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.totalTasks).toBe(3);
    expect(dashboard.body.taskStatusBreakdown.DONE).toBe(1);
    expect(dashboard.body.taskStatusBreakdown.IN_PROGRESS).toBe(1);
    expect(dashboard.body.taskStatusBreakdown.TODO).toBe(1);
    expect(dashboard.body.overdueTasks).toHaveLength(1);
    expect(dashboard.body.overdueTasks[0].title).toBe("Overdue, waiting on client");
    expect(dashboard.body.deliverableStatusBreakdown.NOT_STARTED).toBe(1);
    expect(dashboard.body.waitingOnClient.tasks).toHaveLength(1);
    expect(dashboard.body.waitingOnClient.tasks[0].waitingOnClientNote).toBe("Need brand colors");
    expect(dashboard.body.health.status).toBeDefined();
  });

  it("activity and dashboard are tenant-isolated", async () => {
    const { cookie: ownerA } = await signupOrg(app, { email: "owner-a@dashboard-tenancy-test.example" });
    const { cookie: ownerB } = await signupOrg(app, { email: "owner-b@dashboard-tenancy-test.example" });
    const projectId = await setupProject(ownerA);

    const activity = await api(app).get(`/api/v1/projects/${projectId}/activity`).set("Cookie", ownerB);
    expect(activity.status).toBe(404);
    const dashboard = await api(app).get(`/api/v1/projects/${projectId}/dashboard`).set("Cookie", ownerB);
    expect(dashboard.status).toBe(404);
  });
});
